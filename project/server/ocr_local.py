"""Local Apple Vision OCR bridge. PNG is piped, never written to disk."""
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import threading

SOURCE = Path(__file__).with_name('vision_ocr.swift')
_LOCK = threading.Lock()


class OcrError(Exception):
    pass


def _binary():
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()[:16]
    path = Path(tempfile.gettempdir()) / ('gam264-vision-ocr-' + digest)
    with _LOCK:
        if not path.is_file():
            temporary = path.with_name(path.name + '.' + str(os.getpid()) + '.tmp')
            try:
                subprocess.run(['swiftc', str(SOURCE), '-o', str(temporary)],
                               check=True, capture_output=True, timeout=180)
                os.replace(temporary, path)
            except (OSError, subprocess.SubprocessError) as exc:
                raise OcrError('Apple Vision OCR unavailable or compile failed') from exc
            finally:
                temporary.unlink(missing_ok=True)
    return path


def recognize(png):
    if len(png) < 33 or png[:8] != b'\x89PNG\r\n\x1a\n' or png[12:16] != b'IHDR':
        raise ValueError('image must be PNG')
    width, height = struct.unpack('>II', png[16:24])
    if not width or not height or width * height > 32_000_000:
        raise ValueError('image dimensions exceed 32MP limit')
    try:
        proc = subprocess.run([str(_binary())], input=png, capture_output=True,
                              check=True, timeout=60)
        return json.loads(proc.stdout)
    except subprocess.CalledProcessError as exc:
        if exc.returncode == 2:
            raise ValueError('invalid PNG or image dimensions') from exc
        raise OcrError('Apple Vision OCR failed') from exc
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise OcrError('Apple Vision OCR failed or timed out') from exc
