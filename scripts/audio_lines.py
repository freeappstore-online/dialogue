"""Every Mandarin line the app plays, with its speaker and audio key (generate-audio.py, community-audio.py),
and the words they split into for word-by-word playback (#13)."""
import json, subprocess
from pathlib import Path

data = Path(__file__).resolve().parents[1] / 'web/src/dialogue'
VOICES = {'them': 'zf_xiaobei', 'you': 'zm_yunxi'}


def key(voice, zh):  # FNV-1a 32-bit, must match web/src/dialogue/audio.ts
    h = 0x811c9dc5
    for b in f'{voice}:{zh}'.encode('utf8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def entries():
    """(speaker, zh, pinyin) for every line."""
    for path in sorted((data / 'scenarios').glob('*.json')):
        for node in json.loads(path.read_text('utf8'))['nodes'].values():
            yield 'them', node['zh'], node['pinyin']
            for v in node.get('variants', []): yield 'them', v['zh'], v['pinyin']
            if 'rephrase' in node: yield 'them', node['rephrase']['zh'], node['rephrase']['pinyin']
            for c in node['choices']: yield 'you', c['zh'], c['pinyin']
    for r in json.loads((data / 'repairs.json').read_text('utf8')):
        yield 'you', r['zh'], r['pinyin']
        yield 'them', r['response']['zh'], r['response']['pinyin']
    for p in json.loads((data / 'phrases.json').read_text('utf8')):
        yield 'them', p['zh'], p['pinyin']
        for r in p['replies']: yield 'you', r['zh'], r['pinyin']


def lines():
    """(speaker, zh) for every line."""
    for speaker, zh, _ in entries(): yield speaker, zh


def words():
    """Unique (speaker, word) pairs, split by the app's own aligner (scripts/word_list.mts, needs Node 22)."""
    script = Path(__file__).resolve().parent / 'word_list.mts'
    out = subprocess.run(['node', script], input=json.dumps(list(entries())), capture_output=True, text=True, check=True)
    return [tuple(pair) for pair in json.loads(out.stdout)]
