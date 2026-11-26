"""Queue every Mandarin line as a FreeAppStore community generation job (dialogue#10, platform#727).

usage: community-audio.py [--dry-run]
Signed-in contributors' devices speak the lines with Kokoro v1.0 (the Android and iOS companions run the
Mandarin voices) and the platform verifies each upload with Whisper before the app plays it
(freeappstore-online/platform docs/community-generation.md). The bundled MP3s stay as the fallback.

One set per speaker, as generate-audio.py voices them: Kokoro v1.0, language zh, audio/mp4. Their ids are
web/src/dialogue/community-sets.json ({speaker: set id}); a missing one is created and written there (the
workflow commits it). A job is one line: key = its audio key (audio_lines.key, audio.ts audioKey), input =
the Mandarin text exactly. Re-sending a job changes nothing. The platform is called with this GitHub
Actions run's OIDC token, which it accepts only from main of the app's pinned repository.
--dry-run lists the jobs and calls nothing.
"""
import json, os, sys, urllib.error, urllib.request
from pathlib import Path

from audio_lines import VOICES, key, lines

API = 'https://api.freeappstore.online'
APP = json.loads((Path(__file__).resolve().parents[1] / 'fas.json').read_text())['appId']
SETS = Path(__file__).resolve().parents[1] / 'web/src/dialogue/community-sets.json'
MAX_BYTES = 1_000_000  # the longest line is 26 characters, about 13 s at the slowest rate verification allows
BATCH = 500  # jobs the platform takes per request


def oidc_token():
    """This workflow run's GitHub Actions OIDC token for the platform (needs `id-token: write`)."""
    url = f"{os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']}&audience={API}"
    req = urllib.request.Request(url, headers={'Authorization': f"Bearer {os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']}"})
    with urllib.request.urlopen(req) as res:
        return json.load(res)['value']


def call(token, path, body):
    req = urllib.request.Request(f'{API}/v1{path}', data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                                          # Cloudflare refuses urllib's default agent (error 1010)
                                          'User-Agent': 'dialogue-community-audio (+https://github.com/freeappstore-online/dialogue)'})
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as err:
        sys.exit(f'POST {path}: {err.code} {err.read().decode(errors="replace")}')


def main():
    jobs = {speaker: {} for speaker in VOICES}
    for speaker, zh in lines():
        jobs[speaker][key(speaker, zh)] = zh
    sets = json.loads(SETS.read_text())
    for speaker, voice in VOICES.items():
        print(f'{speaker} ({voice}, set {sets.get(speaker) or "new"}): {len(jobs[speaker])} lines')
    if '--dry-run' in sys.argv:
        for speaker, todo in jobs.items():
            for k, zh in sorted(todo.items()):
                print(f'  {speaker} {k} {zh}')
        return

    token = oidc_token()
    for speaker, voice in VOICES.items():
        if not sets.get(speaker):
            sets[speaker] = call(token, f'/apps/{APP}/generation/sets', {
                'kind': 'tts', 'model': 'kokoro', 'modelVersion': 'v1.0', 'params': {'voice': voice},
                'language': 'zh', 'formats': ['audio/mp4'], 'maxBytes': MAX_BYTES, 'replicas': 1})['set']['id']
            SETS.write_text(json.dumps(sets, indent=2) + '\n')
            print(f'created {speaker} set {sets[speaker]}')
        todo = [{'key': k, 'input': {'text': zh}} for k, zh in sorted(jobs[speaker].items())]
        status = {}
        for i in range(0, len(todo), BATCH):
            for job in call(token, f'/apps/{APP}/generation/sets/{sets[speaker]}/jobs', {'jobs': todo[i:i + BATCH]})['jobs']:
                status[job['status']] = status.get(job['status'], 0) + 1
        print(f'{speaker} set {sets[speaker]}: ' + ', '.join(f'{n} {s}' for s, n in sorted(status.items())))


main()
