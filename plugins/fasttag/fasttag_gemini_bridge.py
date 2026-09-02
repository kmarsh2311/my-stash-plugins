#!/usr/bin/env python3
"""
FastTag Gemini AI Bridge via WebSocket & HTTP
Supports WebSocket (ws://) which is 100% allowed by Stash's Content-Security-Policy (connect-src ws: wss:)
Zero third-party dependencies - standard library only!
"""
import sys
import os
import json
import socket
import select
import struct
import base64
import hashlib
import urllib.request
import urllib.error
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import socketserver

PORT = 9998
WS_MAGIC_STRING = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

AVAILABLE_MODELS_CACHE = {} # api_key -> list of valid model names

def get_available_models(api_key):
    if api_key in AVAILABLE_MODELS_CACHE:
        return AVAILABLE_MODELS_CACHE[api_key]
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            models = [
                m.get("name", "").replace("models/", "")
                for m in resp_data.get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            AVAILABLE_MODELS_CACHE[api_key] = models
            return models
    except Exception as e:
        return []

def get_ordered_candidate_models(api_key, requested_model=None):
    models = get_available_models(api_key)
    ordered = []

    if requested_model and requested_model in models:
        ordered.append(requested_model)

    priority = [
        "gemini-3.6-flash", "gemini-3.0-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp",
        "gemini-1.5-flash-002", "gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-1.5-flash-latest",
        "gemini-1.5-flash-8b", "gemini-1.5-pro-002", "gemini-1.5-pro-001", "gemini-1.5-pro", "gemini-1.5-pro-latest", "gemini-pro"
    ]

    for p in priority:
        if p in models and p not in ordered:
            ordered.append(p)

    for m in models:
        if m not in ordered:
            ordered.append(m)

    if not ordered:
        ordered = ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash-002", "gemini-1.5-flash"]

    return ordered

def process_gemini_request(data):
    req_type = data.get("type", "parse")
    api_key = data.get("api_key", "").strip()
    req_model = data.get("model", "gemini-3.6-flash").strip()

    if not api_key:
        return {"error": "No API key provided"}

    candidates = get_ordered_candidate_models(api_key, req_model)

    if req_type == "test":
        if candidates:
            return {"status": "ok", "message": f"Connected! Active model: {candidates[0]}", "models": candidates}
        else:
            return {"error": "Could not verify models. Please check your API key."}

    # Parse request
    filename = data.get("filename", "").strip()
    title = data.get("title", "").strip()
    performers_context = data.get("performers_context", [])
    studios_context = data.get("studios_context", [])

    prompt = f"""You are an expert video metadata extractor and parser.
Analyze this video filename and title:
Filename: "{filename}"
Title: "{title}"

{f'Sample library performers for reference: {json.dumps(performers_context[:150])}' if performers_context else ''}
{f'Sample library studios for reference: {json.dumps(studios_context[:60])}' if studios_context else ''}

Extract and return a valid JSON object matching this schema:
{{
  "clean_title": "Clean, human-readable scene title without technical metadata, video codecs, resolutions, site prefixes, or raw date prefixes",
  "date": "Release date formatted as YYYY-MM-DD (or null if not found)",
  "studio": "Studio, Network, or Website name (or null)",
  "performers": ["Array of performer/actor names extracted from filename or title"],
  "tags": ["Array of descriptive tags/genres/themes (e.g. Twink, Solo, Interview, BDSM, Outdoor)"],
  "confidence": 95
}}"""

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
    }).encode("utf-8")

    last_error = None
    for chosen_model in candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{chosen_model}:generateContent?key={api_key}"
        try:
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_text = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                parsed = json.loads(raw_text)
                return {"status": "ok", "result": parsed, "model_used": chosen_model}
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_msg)
                err_msg = err_json.get("error", {}).get("message", err_msg)
            except Exception:
                pass
            last_error = f"Google Gemini API error ({e.code}) on model {chosen_model}: {err_msg}"
            # If 404 or model is deprecated/not available, cascade immediately to next candidate model!
            if e.code == 404 or "no longer available" in err_msg or "not found" in err_msg:
                continue
            return {"error": last_error}
        except Exception as e:
            last_error = str(e)
            continue

    return {"error": last_error or "All candidate Gemini models failed"}

class DualServerHandler(socketserver.StreamRequestHandler):
    def handle(self):
        # Read HTTP request header
        initial = b""
        while b"\r\n\r\n" not in initial and len(initial) < 4096:
            chunk = self.connection.recv(1024)
            if not chunk:
                return
            initial += chunk

        lines = initial.decode("utf-8", errors="ignore").split("\r\n")
        req_line = lines[0] if lines else ""
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        # Check if WebSocket upgrade
        if headers.get("upgrade", "").lower() == "websocket":
            sec_key = headers.get("sec-websocket-key", "")
            if not sec_key:
                return
            accept_val = base64.b64encode(hashlib.sha1(sec_key.encode("utf-8") + WS_MAGIC_STRING).digest()).decode("utf-8")
            response = (
                "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept_val}\r\n"
                "\r\n"
            )
            self.connection.sendall(response.encode("utf-8"))
            self.handle_websocket()
        else:
            # Handle normal HTTP request (health check / CORS)
            if "OPTIONS" in req_line:
                resp = (
                    "HTTP/1.1 204 No Content\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD\r\n"
                    "Access-Control-Allow-Headers: *\r\n"
                    "Access-Control-Allow-Private-Network: true\r\n"
                    "\r\n"
                )
                self.connection.sendall(resp.encode("utf-8"))
            else:
                body = json.dumps({"status": "ok", "service": "FastTag Gemini WebSocket Bridge"}).encode("utf-8")
                resp = (
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: application/json\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Access-Control-Allow-Private-Network: true\r\n"
                    f"Content-Length: {len(body)}\r\n"
                    "\r\n"
                ).encode("utf-8") + body
                self.connection.sendall(resp)

    def handle_websocket(self):
        while True:
            try:
                head = self.connection.recv(2)
                if not head or len(head) < 2:
                    break
                b1, b2 = head[0], head[1]
                fin = b1 & 0x80
                opcode = b1 & 0x0f
                if opcode == 8: # Connection close
                    break

                masked = b2 & 0x80
                payload_len = b2 & 0x7f

                if payload_len == 126:
                    ext = self.connection.recv(2)
                    payload_len = struct.unpack("!H", ext)[0]
                elif payload_len == 127:
                    ext = self.connection.recv(8)
                    payload_len = struct.unpack("!Q", ext)[0]

                mask_key = self.connection.recv(4) if masked else None
                payload = b""
                while len(payload) < payload_len:
                    chunk = self.connection.recv(min(4096, payload_len - len(payload)))
                    if not chunk:
                        break
                    payload += chunk

                if masked and mask_key:
                    unmasked = bytearray(payload)
                    for i in range(len(unmasked)):
                        unmasked[i] ^= mask_key[i % 4]
                    payload = bytes(unmasked)

                if opcode == 1: # Text frame
                    req_data = json.loads(payload.decode("utf-8"))
                    req_id = req_data.get("id")
                    res = process_gemini_request(req_data)
                    if req_id is not None:
                        res["id"] = req_id

                    # Send response frame
                    resp_bytes = json.dumps(res).encode("utf-8")
                    out_len = len(resp_bytes)
                    if out_len <= 125:
                        out_head = bytes([0x81, out_len])
                    elif out_len <= 65535:
                        out_head = struct.pack("!BBH", 0x81, 126, out_len)
                    else:
                        out_head = struct.pack("!BBQ", 0x81, 127, out_len)

                    self.connection.sendall(out_head + resp_bytes)
            except Exception as e:
                break

class ThreadingTCPServerReuse(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

def run_server():
    server = ThreadingTCPServerReuse(("0.0.0.0", PORT), DualServerHandler)
    print(f"[FastTag Gemini Bridge] WebSocket & HTTP server listening on ws://0.0.0.0:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    run_server()
