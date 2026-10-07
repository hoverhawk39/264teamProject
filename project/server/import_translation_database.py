"""Import the customer's CSV into private local-data; never serve or commit the source."""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'local-data' / 'translation-database.json'


def import_csv(path):
    with open(path, encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.reader(stream))
    if not rows or 'Chinese' not in rows[0][1] or 'English 1' not in rows[0][2]:
        raise ValueError('unexpected translation CSV columns')
    entries = []
    for number, row in enumerate(rows[1:], 2):
        if len(row) < 17:
            raise ValueError(f'row {number} has fewer than 17 columns')
        chinese = row[1].strip()
        sources = list(dict.fromkeys(part.strip() for value in
            row[2:10] + row[14:16] for part in value.splitlines() if part.strip()))
        if chinese and sources:
            entries.append({'zh': chinese, 'en': sources})
    if not entries:
        raise ValueError('no translated entries found')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Imported {len(entries)} entries to {OUTPUT}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 server/import_translation_database.py FILE.csv')
    import_csv(sys.argv[1])
