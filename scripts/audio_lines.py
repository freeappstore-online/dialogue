"""Every Mandarin line the app plays, with its speaker and audio key (generate-audio.py, community-audio.py)."""
import json
from pathlib import Path

data = Path(__file__).resolve().parents[1] / 'web/src/dialogue'
VOICES = {'them': 'zf_xiaobei', 'you': 'zm_yunxi'}


def key(voice, zh):  # FNV-1a 32-bit, must match web/src/dialogue/audio.ts
    h = 0x811c9dc5
    for b in f'{voice}:{zh}'.encode('utf8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def lines():
    for path in sorted((data / 'scenarios').glob('*.json')):
        for node in json.loads(path.read_text('utf8'))['nodes'].values():
            yield 'them', node['zh']
            for v in node.get('variants', []): yield 'them', v['zh']
            if 'rephrase' in node: yield 'them', node['rephrase']['zh']
            for c in node['choices']: yield 'you', c['zh']
    for r in json.loads((data / 'repairs.json').read_text('utf8')):
        yield 'you', r['zh']
        yield 'them', r['response']['zh']
    for p in json.loads((data / 'phrases.json').read_text('utf8')):
        yield 'them', p['zh']
        for r in p['replies']: yield 'you', r['zh']
