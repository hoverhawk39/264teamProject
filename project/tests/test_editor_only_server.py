"""The editor-only service must not expose legacy case storage APIs."""
import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer
from server.local import Handler


class EditorOnlyServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        host = f'127.0.0.1:{self.server.server_port}'
        conn.request(method, path, body=body, headers={'Host': host, 'Origin': 'http://' + host})
        response = conn.getresponse()
        status, content = response.status, response.read()
        conn.close()
        return status, content

    def test_legacy_project_listing_is_not_exposed(self):
        self.assertEqual(self.request('GET', '/api/projects')[0], 404)

    def test_legacy_project_download_is_not_exposed(self):
        self.assertEqual(self.request('GET', '/api/projects/old-case')[0], 404)

    def test_legacy_project_upload_is_not_exposed(self):
        self.assertEqual(self.request('PUT', '/api/projects/old-case', b'invalid')[0], 404)

    def test_local_health_remains(self):
        status, content = self.request('GET', '/api/health')
        self.assertEqual(status, 200)
        self.assertIn(b'drawing-desk-local', content)


if __name__ == '__main__':
    unittest.main()
