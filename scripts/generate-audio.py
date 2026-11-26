"""Generate unreviewed Mandarin MP3 recordings with Kokoro v1.0 ONNX (same engine as Sayback).

Set KOKORO_MODELS to a directory containing kokoro-v1.0.onnx and voices-v1.0.bin
(https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
Install kokoro-onnx==0.6.1 and soundfile==0.14.0; ffmpeg must be on PATH.
Writes whole lines to web/public/audio/zh and single words (for pauses between words, #13; silence trimmed) to
web/public/audio/words. Set SHARD=i/n to run n workers in parallel. Existing files are kept; files no longer
referenced are removed. Recordings require listening review.
"""
import os, subprocess, sys, tempfile
from pathlib import Path

from audio_lines import VOICES, key, lines, words

public = Path(__file__).resolve().parents[1] / 'web/public/audio'
# A word's own leading and trailing silence would add to the pause the learner chose.
TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'


def main():
    shard, shards = map(int, os.environ.get('SHARD', '0/1').split('/'))
    todo = []
    for folder, items, trim in [('zh', lines(), False), ('words', words(), True)]:
        out = public / folder
        wanted = {key(v, zh): (v, zh) for v, zh in items}
        out.mkdir(parents=True, exist_ok=True)
        for stale in out.glob('*.mp3'):
            if stale.stem not in wanted: stale.unlink()
        mine = [(out / f'{k}.mp3', v, zh, trim) for i, (k, (v, zh)) in enumerate(sorted(wanted.items()))
                if i % shards == shard and not (out / f'{k}.mp3').exists()]
        print(f'{folder}: {len(wanted)} clips, {len(mine)} to generate', flush=True)
        todo += mine
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
        for path, voice, zh, trim in todo:
            samples, sr = k.create(zh, voice=VOICES[voice], lang='cmn', speed=1.0)
            if not len(samples): sys.exit(f'Empty audio: {zh}')
            wav = Path(tmp) / 'clip.wav'
            sf.write(wav, samples, sr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, *(['-af', TRIM] if trim else []), '-ac', '1', '-b:a', '48k', path], check=True)
            print(path.parent.name, path.stem, voice, zh, round(len(samples) / sr, 2), flush=True)

main()
