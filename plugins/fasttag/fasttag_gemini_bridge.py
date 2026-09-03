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
                and not any(bad in m.get("name", "").lower() for bad in ["tts", "audio", "image", "embedding", "aqa", "realtime", "robotics"])
            ]
            AVAILABLE_MODELS_CACHE[api_key] = models
            log_path = os.path.expanduser("~/.stash/fasttag_gemini_bridge.log")
            with open(log_path, "a") as f:
                f.write(f"AVAILABLE MODELS FOR KEY: {models}\n")
            return models
    except Exception as e:
        log_path = os.path.expanduser("~/.stash/fasttag_gemini_bridge.log")
        with open(log_path, "a") as f:
            f.write(f"ERROR FETCHING MODELS: {e}\n")
        return []

def get_ordered_candidate_models(api_key, requested_model=None):
    models = get_available_models(api_key)
    ordered = []

    priority = [
        "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.8-flash",
        "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite",
        "gemini-pro-latest", "gemini-2.5-flash-lite"
    ]

    if requested_model and not any(bad in requested_model.lower() for bad in ["tts", "audio", "image", "embedding"]):
        ordered.append(requested_model)

    for p in priority:
        if p not in ordered and (not models or p in models):
            ordered.append(p)

    for m in models:
        if m not in ordered:
            ordered.append(m)

    if not ordered:
        ordered = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-3.6-flash"]

    return ordered

def process_gemini_request(data):
    req_type = data.get("type", "parse")
    api_key = data.get("api_key", "").strip()
    req_model = data.get("model", "gemini-flash-latest").strip()

    if not api_key:
        return {"error": "No API key provided"}

    candidates = get_ordered_candidate_models(api_key, req_model)

    if req_type == "test":
        # Candidate names can include local fallbacks, so they are not proof that
        # Google accepted the API key. Only report success when listModels returned
        # at least one model from the authenticated Gemini API.
        verified_models = get_available_models(api_key)
        if not verified_models:
            return {"error": "Could not verify Gemini access. Please check your API key and network connection."}
        active_model = req_model if req_model in verified_models else candidates[0]
        return {"status": "ok", "message": f"Connected! Active model: {active_model}", "models": verified_models}

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

    log_path = os.path.expanduser("~/.stash/fasttag_gemini_bridge.log")
    def log(msg):
        try:
            with open(log_path, "a") as f:
                f.write(f"[{threading.current_thread().name}] {msg}\n")
        except Exception:
            pass

    log(f"Received {req_type} request. Model requested: '{req_model}', filename: '{filename}'")

    last_error = None
    import time
    for chosen_model in candidates[:5]: # Try up to 5 models on rate limits
        start_t = time.time()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{chosen_model}:generateContent?key={api_key}"
        log(f"Attempting model: {chosen_model}...")
        try:
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as resp: # 5s fast timeout
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_text = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                parsed = json.loads(raw_text)
                elapsed = time.time() - start_t
                log(f"Model {chosen_model} SUCCEEDED in {elapsed:.2f}s!")
                return {"status": "ok", "result": parsed, "model_used": chosen_model}
        except urllib.error.HTTPError as e:
            elapsed = time.time() - start_t
            err_msg = e.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_msg)
                err_msg = err_json.get("error", {}).get("message", err_msg)
            except Exception:
                pass
            last_error = f"Google Gemini API error ({e.code}) on model {chosen_model}: {err_msg}"
            log(f"Model {chosen_model} FAILED ({e.code}) in {elapsed:.2f}s: {err_msg}")
            continue
        except Exception as e:
            elapsed = time.time() - start_t
            last_error = str(e)
            log(f"Model {chosen_model} EXCEPTION in {elapsed:.2f}s: {e}")
            continue

    log(f"All candidates failed. Last error: {last_error}")
    return {"error": last_error or "Google Gemini API did not respond in time"}

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
