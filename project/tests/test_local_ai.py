"""Offline AI route contract tests; no proprietary drawing files."""
import http.client
import base64
import importlib.util
import json
import pathlib
import subprocess
import struct
import threading
import tempfile
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('drawing_local', ROOT / 'server/local.py')
assert spec is not None and spec.loader is not None
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


class LocalAiTest(unittest.TestCase):
    def setUp(self):
        # Synthetic, deterministic terms keep tests independent of private local-data.
        terms = {'lead in': {'導引'}, 'guide pin': {'導梢', '導銷'},
                 'greater than 1.66': {'>1.66', '>1.67'},
                 'wide': {'寬'}, 'deep': {'深'}}
        glossary_patch = patch('ai_translate.database_terms', return_value=terms)
        glossary_patch.start()
        self.addCleanup(glossary_patch.stop)

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), local.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, payload, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=120)
        request_headers = {
            'Content-Type': 'application/json', 'Host': f'127.0.0.1:{self.server.server_port}',
            'Origin': f'http://127.0.0.1:{self.server.server_port}', **(headers or {})
        }
        conn.request('POST', path, json.dumps(payload, ensure_ascii=False).encode(), {
            key: value for key, value in request_headers.items() if value is not None
        })
        response = conn.getresponse()
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def test_skip_all_han_and_dimension_without_model(self):
        code, data = self.request('/api/ai/translate', {'items': [
            {'id': 'a', 'text': '原始圖面'}, {'id': 'b', 'text': 'Ø12 ±0.05 mm'}
        ], 'glossary': {}})
        self.assertEqual(code, 200)
        self.assertEqual(data['model'], 'gemma3:4b')
        self.assertEqual([(x['id'], x['translation'], x['skipped']) for x in data['items']], [
            ('a', '原始圖面', True), ('b', 'Ø12 ±0.05 mm', True)
        ])

    def test_post_rejects_cross_origin_and_invalid_host(self):
        payload = {'items': [], 'glossary': {}}
        for headers in ({'Origin': 'http://evil.test'}, {'Host': 'evil.test'},
                        {'Sec-Fetch-Site': 'cross-site'}, {'Origin': None}):
            with self.subTest(headers=headers):
                code, data = self.request('/api/ai/translate', payload, headers)
                self.assertEqual(code, 403)
                self.assertIn('error', data)

    def test_ocr_synthetic_png_returns_top_left_pixel_line_blocks(self):
        image = subprocess.run(['swift', str(ROOT / 'tests/synthetic_ocr_image.swift')],
                               capture_output=True, check=True, timeout=90).stdout
        width, height = struct.unpack('>II', image[16:24])
        code, data = self.request('/api/ai/ocr', {'image': base64.b64encode(image).decode()})
        self.assertEqual(code, 200)
        self.assertIn('warnings', data)
        block = next(block for block in data['blocks'] if 'EJECTOR PIN' in block['text'])
        self.assertTrue(0 < block['x'] < width / 2, block)
        self.assertTrue(0 < block['y'] < height / 2, block)
        self.assertTrue(100 < block['w'] < width, block)
        self.assertTrue(0 < block['h'] < height / 2, block)
        self.assertTrue(0 < block['confidence'] <= 1, block)

    def test_translation_protects_glossary_dimensions_and_ids(self):
        text = 'CUSTOM COMPONENT Ø12 ±0.05 mm PART-123'
        with patch.object(local, 'generate_translation', return_value='ZXQ0QXZ ZXQ1QXZ ZXQ2QXZ') as model:
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 'note-1', 'text': text}], 'glossary': {'CUSTOM COMPONENT': '自訂元件'}
            })
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['text'], text)
        self.assertEqual(data['items'][0]['translation'], '自訂元件 Ø12 ±0.05 mm PART-123')
        self.assertIn('protected', data['items'][0]['warning'].lower())
        model.assert_not_called()  # Every span is protected; no Ollama call needed.

    def test_invalid_model_output_isolated_per_item_without_fabricated_note(self):
        with patch.object(local, 'generate_translation', side_effect=['保留譯文', 'STILL ENGLISH', '另一譯文']):
            code, data = self.request('/api/ai/translate', {'items': [
                {'id': 'ok-1', 'text': 'Please inspect item'},
                {'id': 'bad', 'text': 'Please verify item'},
                {'id': 'ok-2', 'text': 'Please check item'},
            ]})
        self.assertEqual(code, 200, data)
        self.assertEqual([item['id'] for item in data['items']], ['ok-1', 'bad', 'ok-2'])
        self.assertEqual(data['items'][0]['translation'], '保留譯文')
        self.assertEqual(data['items'][2]['translation'], '另一譯文')
        self.assertNotIn('translation', data['items'][1])
        self.assertIn('Traditional Chinese', data['items'][1]['error'])

    def test_corrupted_protected_placeholder_rejected_as_item(self):
        with patch.object(local, 'generate_translation', return_value='頂針 Φ12 mm'):
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 'a', 'text': 'EJECTOR PIN Ø12 mm'}], 'glossary': {}
            })
        self.assertEqual(code, 200, data)
        self.assertNotIn('translation', data['items'][0])
        self.assertIn('protected tokens', data['items'][0]['error'])

    def test_malformed_placeholder_can_retry_unprotected_segments(self):
        calls = []
        def model(text):
            calls.append(text)
            if 'ZXQ' in text:
                return '模型改掉佔位符'
            if 'WIDE' in text:
                return '寬'
            if 'DEEP' in text:
                return '深'
            return text
        with patch.object(local, 'generate_translation', side_effect=model):
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 'drawing', 'text': '.01 WIDE X .01 DEEP'}]
            })
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'].count('.01'), 2)
        self.assertIn('寬', data['items'][0]['translation'])
        self.assertIn('深', data['items'][0]['translation'])
        self.assertGreaterEqual(len(calls), 1, 'unmatched connective still reaches the model')

    def test_rejects_bad_translation_payload_without_model_call(self):
        with patch.object(local, 'generate_translation') as model:
            for payload in ({'items': 'not an array'},
                            {'items': [{'id': 'a', 'text': 123}]},
                            {'items': [], 'glossary': {'a': 5}}):
                with self.subTest(payload=payload):
                    code, _ = self.request('/api/ai/translate', payload)
                    self.assertEqual(code, 400)
        model.assert_not_called()

    def test_live_local_ollama_translates_to_traditional_chinese(self):
        code, data = self.request('/api/ai/translate', {
            'items': [{'id': 'sample', 'text': 'Remove sharp edges before assembly.'}],
            'glossary': {}
        })
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['text'], 'Remove sharp edges before assembly.')
        self.assertRegex(data['items'][0]['translation'], '[\u3400-\u9fff]')

    def test_live_model_preserves_dimension_and_glossary(self):
        source = 'LEAD IN Ø12 ±0.05 mm'
        code, data = self.request('/api/ai/translate', {
            'items': [{'id': 'tech', 'text': source}], 'glossary': {}
        })
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '導引 Ø12 ±0.05 mm')

    def test_customer_database_exact_precedes_model_and_ambiguous_falls_back(self):
        with patch.object(local, 'generate_translation', return_value='需人工確認') as model:
            code, data = self.request('/api/ai/translate', {'items': [
                {'id': 'unique', 'text': '  LEAD IN  '},
                {'id': 'ambiguous', 'text': 'GUIDE PIN'},
                {'id': 'mistake', 'text': 'GREATER THAN 1.66'},
                {'id': 'unknown', 'text': 'Please inspect item'},
            ], 'glossary': {}})
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '導引')
        self.assertEqual(data['items'][0]['source'], 'database')
        self.assertEqual([item['translation'] for item in data['items'][1:]], ['需人工確認'] * 3)
        self.assertEqual(model.call_count, 3)

    def test_customer_database_phrase_keeps_unique_term_without_model_rewriting(self):
        with patch.object(local, 'generate_translation', return_value='ZXQ0QXZ 前請仔細檢查') as model:
            code, data = self.request('/api/ai/translate', {'items': [
                {'id': 'phrase', 'text': 'Inspect LEAD IN carefully'}
            ]})
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '導引 前請仔細檢查')
        self.assertIn('ZXQ0QXZ', model.call_args.args[0])
        self.assertNotIn('LEAD IN', model.call_args.args[0])

    def test_importer_preserves_collisions_without_picking_first_row(self):
        from server import import_translation_database as importer
        with tempfile.TemporaryDirectory() as directory:
            source = pathlib.Path(directory) / 'sample.csv'
            output = pathlib.Path(directory) / 'database.json'
            header = ['編號', 'Chinese\n中文', 'English 1\n英文 1'] + ['English'] * 14
            rows = [header, ['', '導梢', 'GUIDE PIN'] + [''] * 14,
                    ['', '導銷', 'GUIDE PIN'] + [''] * 14]
            import csv
            with source.open('w', newline='', encoding='utf-8') as stream:
                csv.writer(stream).writerows(rows)
            with patch.object(importer, 'OUTPUT', output):
                importer.import_csv(source)
            entries = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual([entry['zh'] for entry in entries], ['導梢', '導銷'])
            self.assertEqual([entry['en'] for entry in entries], [['GUIDE PIN']] * 2)

    def test_unit_without_number_is_protected_in_mixed_text(self):
        with patch.object(local, 'generate_translation', return_value='單位 ZXQ0QXZ') as model:
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 1, 'text': 'Unit mm'}], 'glossary': {}
            })
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '單位 mm')
        self.assertNotIn('mm', model.call_args.args[0])

    def test_multiplier_prefix_remains_unchanged(self):
        with patch.object(local, 'generate_translation', return_value='ZXQ0QXZ 銳角') as model:
            code, data = self.request('/api/ai/translate', {'items': [{'id': 'qty', 'text': '4X SHARP'}]})
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '4X 銳角')
        self.assertNotIn('4X', model.call_args.args[0])

    def test_standalone_tolerance_and_alphanumeric_part_are_not_translated(self):
        with patch.object(local, 'generate_translation') as model:
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 1, 'text': '+0.02/-0.00'}, {'id': 2, 'text': 'AB1234'}]
            })
        self.assertEqual(code, 200, data)
        self.assertEqual([entry['translation'] for entry in data['items']], ['+0.02/-0.00', 'AB1234'])
        self.assertTrue(all(entry['skipped'] for entry in data['items']))
        model.assert_not_called()

    def test_ocr_rejects_corrupt_png_without_internal_error(self):
        invalid_png = b'\x89PNG\r\n\x1a\n' + b'\x00\x00\x00\x0dIHDR' + b'\x00\x00\x00\x01' * 2 + b'junk data'
        code, data = self.request('/api/ai/ocr', {'image': base64.b64encode(invalid_png).decode()})
        self.assertEqual(code, 400, data)
        self.assertIn('PNG', data['error'])

    def test_japanese_source_reaches_local_model(self):
        with patch.object(local, 'generate_translation', return_value='表面拋光') as model:
            code, data = self.request('/api/ai/translate', {'items': [{'id': 'jp', 'text': '表面仕上げ'}]})
        self.assertEqual(code, 200, data)
        self.assertEqual(data['items'][0]['translation'], '表面拋光')
        model.assert_called_once()

    def test_ocr_recognizes_synthetic_traditional_chinese_line(self):
        image = subprocess.run(['swift', str(ROOT / 'tests/synthetic_ocr_image.swift')],
                               capture_output=True, check=True, timeout=90).stdout
        code, data = self.request('/api/ai/ocr', {'image': base64.b64encode(image).decode()})
        self.assertEqual(code, 200, data)
        self.assertTrue(any('頂針' in block['text'] for block in data['blocks']), data['blocks'])

    def test_missing_glossary_warns_terminology_unverified(self):
        with patch.object(local, 'generate_translation', return_value='組裝前去除銳邊。'):
            code, data = self.request('/api/ai/translate', {
                'items': [{'id': 'a', 'text': 'Remove sharp edges before assembly.'}],
                'glossary': {}
            })
        self.assertEqual(code, 200, data)
        self.assertIn('unverified', data['items'][0]['warning'].lower())


if __name__ == '__main__':
    unittest.main()
