"""Offline single-machine editor server. Intentionally binds loopback only."""
import argparse
import base64
import binascii
import http.server
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ocr_local import recognize, OcrError
from ai_translate import translate, generate_translation, ModelUnavailable, TranslationError

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def answer(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        return self.headers.get('Host', '').split(':')[0] in ('localhost', '127.0.0.1')

    def do_POST(self):
        if not self.valid_host() or self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.answer(403, {'error': 'forbidden'})
        if self.headers.get('Origin') != 'http://' + self.headers.get('Host', ''):
            return self.answer(403, {'error': 'origin'})
        if self.path not in ('/api/ai/translate', '/api/ai/ocr'):
            return self.answer(404, {'error': 'missing'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 9 * 1024**2:
                return self.answer(413, {'error': 'request size must be 1–9 MB'})
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                return self.answer(415, {'error': 'JSON required'})
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise ValueError('JSON object required')
            if self.path == '/api/ai/ocr':
                image = payload.get('image')
                if not isinstance(image, str) or len(image) > 8 * 1024**2:
                    raise ValueError('image must be base64 PNG up to 6MB')
                png = base64.b64decode(image, validate=True)
                return self.answer(200, recognize(png))
        except (ValueError, TypeError, binascii.Error) as exc:
            return self.answer(400, {'error': str(exc)})
        except OcrError as exc:
            return self.answer(503, {'error': str(exc)})
        try:
            return self.answer(200, translate(payload, generate_translation))
        except ValueError as exc:
            return self.answer(400, {'error': str(exc)})
        except ModelUnavailable as exc:
            return self.answer(503, {'error': str(exc)})
        except TranslationError as exc:
            return self.answer(502, {'error': str(exc)})

    def do_GET(self):
        if not self.valid_host():
            return self.answer(403, {'error': 'invalid host'})
        if self.path == '/api/health':
            return self.answer(200, {'service': 'drawing-desk-local'})
        if self.path.startswith('/api/'):
            return self.answer(404, {'error': 'missing'})
        return super().do_GET()

    def do_PUT(self):
        return self.answer(404, {'error': 'missing'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'Open http://127.0.0.1:{args.port} — local-only testing', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
