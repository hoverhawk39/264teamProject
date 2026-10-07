"""Conservative local translation; never trust model output with engineering tokens."""
import http.client
import json
import os
import pathlib
import re
import threading
from functools import lru_cache

MODEL = os.environ.get('GAM264_OLLAMA_MODEL', 'gemma3:4b')
MODEL_SLOTS = threading.BoundedSemaphore(2)
HAN = re.compile(r'^[\u3400-\u9fff\uf900-\ufaff\s，。、：（）()；;！!？?「」『』]+$')
NON_HAN_LETTER = re.compile(r'[A-Za-z\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]')
# Protected: part/drawing identifiers, dimensional values, tolerances, and units.
PART = r'(?<![\w])(?=[A-Z0-9_-]*\d)[A-Z]{2,}[A-Z0-9]*(?:[-_][A-Z0-9]+)*(?![\w])'
DIMENSION = (r'(?<![\w])(?:[Ø⌀ΦφRrMm]\s*)?[+−-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)'
             r'(?:\s*[×xX]\s*\d+(?:[.,]\d+)?)*'
             r'(?:\s*[±+−-]\s*\d+(?:[.,]\d+)?)?'
             r'(?:\s*/\s*[+−-]?\d+(?:[.,]\d+)?)?'
             r'(?:\s*(?:mm|cm|µm|um|in|inch|°))?(?![\w])')
UNIT = r'(?<![\w])(?:mm|cm|µm|um|kg|inch)(?![\w])'
COUNT = r'(?<![\w])\d+[xX](?![\w])'
TOKEN = re.compile(PART + '|' + COUNT + '|' + DIMENSION + '|' + UNIT, re.IGNORECASE)
PLACEHOLDER = re.compile(r'ZXQ\d+QXZ')
DATABASE_PATH = pathlib.Path(__file__).resolve().parents[1] / 'local-data/translation-database.json'


def database_terms():
    try:
        return _database_terms_at_mtime(DATABASE_PATH.stat().st_mtime_ns)
    except FileNotFoundError as exc:
        raise TranslationError('translation database missing; import the customer CSV first') from exc


@lru_cache(maxsize=2)
def _database_terms_at_mtime(_mtime_ns):
    """Reload when the private database changes, without a server restart."""
    try:
        with DATABASE_PATH.open(encoding='utf-8') as stream:
            entries = json.load(stream)
    except (ValueError, OSError) as exc:
        raise TranslationError('translation database is unreadable or invalid') from exc
    if not isinstance(entries, list):
        raise TranslationError('translation database is invalid')
    terms = {}
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get('zh'), str) or not isinstance(entry.get('en'), list):
            raise TranslationError('translation database is invalid')
        for source in entry['en']:
            if not isinstance(source, str) or not source.strip():
                raise TranslationError('translation database is invalid')
            terms.setdefault(source.strip().casefold(), set()).add(entry['zh'].strip())
    return terms


@lru_cache(maxsize=4)
def term_matcher(db_keys, glossary_keys):
    patterns = [r'(?<!\w)' + re.escape(term) + r'(?!\w)' for term in db_keys]
    return re.compile('|'.join([PART, COUNT, *patterns,
                                *[re.escape(term) for term in glossary_keys], DIMENSION, UNIT]), re.IGNORECASE)


class TranslationError(Exception):
    pass


class ModelUnavailable(Exception):
    pass


def generate_translation(text):
    """Use a fixed loopback destination; never accept a client-selected URL."""
    prompt = ('Translate the following technical drawing text to Traditional Chinese (Taiwan). '
              'Reply ONLY with the translated text, without labels, markdown, explanations or quotation marks. '
              + ('Keep every ZXQ<number>QXZ token EXACTLY, in the same order, once each. '
                 'Never translate or alter those protected tokens. ' if PLACEHOLDER.search(text) else '')
              + 'Preserve line breaks.\n\n'
              + json.dumps(text, ensure_ascii=False))
    body = json.dumps({'model': MODEL, 'prompt': prompt, 'stream': False,
                       'options': {'temperature': 0, 'num_predict': 512},
                       'keep_alive': '5m'}).encode()
    if not MODEL_SLOTS.acquire(blocking=False):
        raise ModelUnavailable('local model busy; retry later')
    try:
        conn = http.client.HTTPConnection('127.0.0.1', 11434, timeout=90)
        try:
            conn.request('POST', '/api/generate', body, {'Content-Type': 'application/json'})
            response = conn.getresponse()
            raw = response.read(65537)
            if len(raw) > 65536 or response.status != 200:
                raise ModelUnavailable('local Ollama model unavailable or response too large')
            output = json.loads(raw)
            if output.get('done') is not True or not isinstance(output.get('response'), str):
                raise TranslationError('local model returned an incomplete response')
            result = output['response'].strip()
            if not result:
                raise TranslationError('local model returned empty translation')
            return result
        finally:
            conn.close()
    except (OSError, TimeoutError) as exc:
        raise ModelUnavailable('local Ollama model unavailable or timed out') from exc
    except (ValueError, KeyError) as exc:
        raise TranslationError('local model returned invalid JSON') from exc
    finally:
        MODEL_SLOTS.release()


def validate_payload(payload):
    items = payload.get('items')
    glossary = payload.get('glossary', {})
    if not isinstance(items, list) or len(items) > 20 or not isinstance(glossary, dict) or len(glossary) > 100:
        raise ValueError('items must be an array of up to 20; glossary an object of up to 100 entries')
    if any(not isinstance(entry, dict) or not isinstance(entry.get('id'), (str, int))
           or isinstance(entry.get('id'), bool) or len(str(entry['id'])) > 100
           or not isinstance(entry.get('text'), str) or len(entry['text']) > 2000
           for entry in items):
        raise ValueError('each item requires id (string/integer) and text (up to 2000 characters)')
    if any(not isinstance(term, str) or not term or len(term) > 100 or not isinstance(value, str)
           or not value or len(value) > 100 for term, value in glossary.items()):
        raise ValueError('glossary keys and values must be nonempty strings up to 100 characters')
    return items, glossary


def translate_one(entry, glossary, model_call, terms=None):
    text = entry['text']
    result = {'id': entry['id'], 'text': text}
    if PLACEHOLDER.search(text):
        raise ValueError('text contains reserved placeholder sequence')
    # An exact, unambiguous database match never calls Ollama. Ambiguous source
    # spellings must fall through to the model rather than using row order.
    choices = (terms or {}).get(text.strip().casefold(), set())
    if len(choices) == 1:
        return {**result, 'translation': next(iter(choices)), 'source': 'database',
                'warning': 'Database translation; review against original.'}
    if not text.strip() or HAN.fullmatch(text.strip()):
        return {**result, 'translation': text, 'skipped': True, 'warning': 'Already Chinese or empty; kept original.'}
    if TOKEN.fullmatch(text.strip()):
        return {**result, 'translation': text, 'skipped': True, 'warning': 'Protected dimension, tolerance, unit or identifier; kept original.'}
    # Longest glossary terms first; part/dimension protection is applied across remaining text.
    glossary_keys = sorted(glossary, key=len, reverse=True)
    db_terms = terms or {}
    # Include ambiguous spellings in the longest-first match to prevent a
    # shorter unique term from winning inside an ambiguous phrase.
    db_keys = sorted(db_terms, key=len, reverse=True)
    matcher = term_matcher(tuple(db_keys), tuple(glossary_keys))
    protected = []
    ambiguous = []
    database_matches = []
    def replace(match):
        value = match.group()
        db_match = db_terms.get(value.casefold())
        if db_match and len(db_match) > 1:
            ambiguous.append(value)
            return value
        if db_match:
            database_matches.append(value)
        translated = (next(iter(db_match)) if db_match else
                      next((glossary[term] for term in glossary_keys if term.casefold() == value.casefold()), value))
        key = 'ZXQ' + str(len(protected)) + 'QXZ'
        protected.append((key, translated))
        return key
    masked = matcher.sub(replace, text)
    if not protected and not NON_HAN_LETTER.search(masked):
        return {**result, 'translation': text, 'skipped': True, 'warning': 'No translatable non-Chinese text; kept original.'}
    if protected and not ambiguous and not NON_HAN_LETTER.search(PLACEHOLDER.sub('', masked)):
        generated = masked
        if database_matches:
            result['source'] = 'database'
    else:
        generated = model_call(masked)
    expected = [key for key, _ in protected]
    if PLACEHOLDER.findall(generated) != expected or any(generated.count(key) != 1 for key in expected):
        # A local model may edit marker spelling. Retry only the unprotected
        # spans; reinsert every engineering value ourselves, never from AI.
        fragments = re.split(r'(ZXQ\d+QXZ)', masked)
        translated_fragments = []
        for fragment in fragments:
            if PLACEHOLDER.fullmatch(fragment) or not re.search(r'[A-Za-z]{2,}|[\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]', fragment):
                translated_fragments.append(fragment)
                continue
            part = model_call(fragment)
            if re.search(r'\d', part) or PLACEHOLDER.search(part) or not re.search(r'[\u3400-\u9fff]', part):
                raise TranslationError('local model changed protected tokens; translation rejected')
            translated_fragments.append(part)
        generated = ''.join(translated_fragments)
    if PLACEHOLDER.findall(generated) != expected or any(generated.count(key) != 1 for key in expected):
        raise TranslationError('local model changed protected tokens; translation rejected')
    if re.search(r'\d', PLACEHOLDER.sub('', generated)):
        raise TranslationError('local model introduced an unprotected number; translation rejected')
    for key, value in protected:
        generated = generated.replace(key, value)
    if not re.search(r'[\u3400-\u9fff]', generated):
        raise TranslationError('local model did not produce Traditional Chinese; translation rejected')
    result['translation'] = generated
    result['warning'] = 'Unverified technical terminology; review against original.'
    if protected:
        result['warning'] += ' Protected glossary terms and/or dimensions, tolerances, units, identifiers.'
    if ambiguous:
        result['warning'] += ' Ambiguous database term(s) sent to Ollama: ' + ', '.join(dict.fromkeys(ambiguous))
    return result


def translate(payload, model_call=generate_translation):
    items, glossary = validate_payload(payload)
    terms = database_terms()
    results = []
    for item in items:
        try:
            results.append(translate_one(item, glossary, model_call, terms))
        except TranslationError as exc:
            # A rejected model output is not a translation. Keep the original
            # identifier and reason so the editor can flag the source for review.
            results.append({'id': item['id'], 'text': item['text'], 'error': str(exc)})
    return {'items': results, 'model': MODEL}
