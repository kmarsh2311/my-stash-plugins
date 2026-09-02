#!/usr/bin/env python3
"""
FastTag Gemini AI Bridge
A lightweight, zero-dependency bridge using Python standard library to bypass browser CSP restrictions.
"""
import sys
import json
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = 9998

class GeminiBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[FastTag Gemini Bridge] {self.address_string()} - {format % args}\n")

    def _send_cors(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "86400")
        if content_type:
            self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        self._send_cors(204, None)

    def do_GET(self):
        if self.path in ["/health", "/"]:
            self._send_cors(200)
            self.wfile.write(json.dumps({"status": "ok", "service": "FastTag Gemini AI Bridge"}).encode("utf-8"))
        else:
            self._send_cors(404)
            self.wfile.write(b'{"error": "Not found"}')

    def do_POST(self):
        if self.path == "/gemini_test":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                api_key = body.get("api_key", "").strip()
                model = body.get("model", "gemini-1.5-flash").strip()

                if not api_key:
                    self._send_cors(400)
                    self.wfile.write(json.dumps({"error": "No API key provided"}).encode("utf-8"))
                    return

                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = json.dumps({
                    "contents": [{"parts": [{"text": "Respond with JSON: {\"status\": \"ok\", \"message\": \"Connected to Gemini\"}"}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
                }).encode("utf-8")

                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    raw_text = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    parsed = json.loads(raw_text)

                self._send_cors(200)
                self.wfile.write(json.dumps({"status": "ok", "result": parsed}).encode("utf-8"))
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="ignore")
                try:
                    err_json = json.loads(err_msg)
                    err_msg = err_json.get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                self._send_cors(e.code)
                self.wfile.write(json.dumps({"error": f"Google Gemini API error ({e.code}): {err_msg}"}).encode("utf-8"))
            except Exception as e:
                self._send_cors(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

        elif self.path == "/gemini_parse":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                api_key = body.get("api_key", "").strip()
                model = body.get("model", "gemini-1.5-flash").strip()
                filename = body.get("filename", "").strip()
                title = body.get("title", "").strip()
                performers_context = body.get("performers_context", [])
                studios_context = body.get("studios_context", [])

                if not api_key:
                    self._send_cors(400)
                    self.wfile.write(json.dumps({"error": "No API key provided"}).encode("utf-8"))
                    return

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

                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = json.dumps({
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
                }).encode("utf-8")

                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    raw_text = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    parsed = json.loads(raw_text)

                self._send_cors(200)
                self.wfile.write(json.dumps({"status": "ok", "result": parsed}).encode("utf-8"))
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="ignore")
                try:
                    err_json = json.loads(err_msg)
                    err_msg = err_json.get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                self._send_cors(e.code)
                self.wfile.write(json.dumps({"error": f"Google Gemini API error ({e.code}): {err_msg}"}).encode("utf-8"))
            except Exception as e:
                self._send_cors(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self._send_cors(404)
            self.wfile.write(b'{"error": "Not found"}')

def run_server():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), GeminiBridgeHandler)
    server.daemon_threads = True
    print(f"[FastTag Gemini Bridge] Listening on http://0.0.0.0:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    run_server()
