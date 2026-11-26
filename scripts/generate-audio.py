"""Generate unreviewed Mandarin MP3 recordings with Kokoro v1.0 ONNX (same engine as Sayback).

Set KOKORO_MODELS to a directory containing kokoro-v1.0.onnx and voices-v1.0.bin
(https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
Install kokoro-onnx==0.6.1 and soundfile==0.14.0; ffmpeg must be on PATH.
Set SHARD=i/n to run n workers in parallel. Existing files are kept; files no longer referenced are removed. Recordings require listening review.
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = root / 'web/src/dialogue'
out = root / 'web/public/audio/zh'
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


def main():
    wanted = {key(v, zh): (v, zh) for v, zh in lines()}
    out.mkdir(parents=True, exist_ok=True)
    for stale in out.glob('*.mp3'):
        if stale.stem not in wanted: stale.unlink()
    shard, shards = map(int, os.environ.get('SHARD', '0/1').split('/'))
    todo = {k: vz for i, (k, vz) in enumerate(sorted(wanted.items())) if i % shards == shard and not (out / f'{k}.mp3').exists()}
    print(f'{len(wanted)} lines, {len(todo)} to generate', flush=True)
    if not todo: return
    import soundfile as sf
    from kokoro_onnx import Kokoro
    models = Path(os.environ['KOKORO_MODELS'])
    import onnxruntime as ort
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get('THREADS', '2'))  # keep parallel shards from oversubscribing
    session = ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), opts, providers=['CPUExecutionProvider'])
    k = Kokoro.from_session(session, str(models / 'voices-v1.0.bin'))
    with tempfile.TemporaryDirectory() as tmp:
        for name, (voice, zh) in todo.items():
            samples, sr = k.create(zh, voice=VOICES[voice], lang='cmn', speed=1.0)
            if not len(samples): sys.exit(f'Empty audio: {zh}')
            wav = Path(tmp) / 'line.wav'
            sf.write(wav, samples, sr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '48k', out / f'{name}.mp3'], check=True)
            print(name, voice, zh, round(len(samples) / sr, 2), flush=True)


main()
