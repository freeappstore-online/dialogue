"""Request community TTS for the Mandarin lines that need it (dialogue#10, #11, platform#727).

usage: community-audio.py [--dry-run]
Signed-in contributors' devices speak the lines with Kokoro v1.0 (the Android and iOS companions run the
Mandarin voices) and the platform verifies each upload with Whisper before the app plays it
(freeappstore-online/platform docs/community-generation.md). The bundled MP3s stay as the fallback.

One set per speaker, as generate-audio.py voices them: Kokoro v1.0, language zh, audio/mp4. Their ids are
web/src/dialogue/community-sets.json ({speaker: set id}); a missing one is created and written there (the
workflow commits it). A job is one line: key = its audio key (audio_lines.key, audio.ts audioKey), input =
the Mandarin text exactly. Only lines with no job yet are requested; the report says how many lines are
accepted, still open and newly requested, and warns about jobs for text the app no longer uses (the API
cannot delete a job). The platform is called with this GitHub Actions run's OIDC token, which it accepts
only from main of the app's pinned repository.
--dry-run requests and creates nothing: in Actions it reads the sets and reports what would be requested;
elsewhere (no OIDC) it only lists the lines.
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


def call(token, path, body=None):
    """POST body as JSON, or GET when there is no body."""
    method = 'GET' if body is None else 'POST'
    req = urllib.request.Request(f'{API}/v1{path}', data=None if body is None else json.dumps(body).encode(), method=method,
                                 headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                                          # Cloudflare refuses urllib's default agent (error 1010)
                                          'User-Agent': 'dialogue-community-audio (+https://github.com/freeappstore-online/dialogue)'})
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as err:
        sys.exit(f'{method} {path}: {err.code} {err.read().decode(errors="replace")}')


def existing_jobs(token, set_id):
    """{key: status} for every job already in the set ('open' or 'accepted')."""
    found, cursor = {}, None
    while True:
        page = call(token, f'/apps/{APP}/generation/sets/{set_id}/jobs?limit=200' + (f'&cursor={cursor}' if cursor else ''))
        found.update({job['key']: job['status'] for job in page['jobs']})
        cursor = page.get('nextCursor')
        if not cursor:
            return found


def main():
    jobs = {speaker: {} for speaker in VOICES}
    for speaker, zh in lines():
        jobs[speaker][key(speaker, zh)] = zh
    sets = json.loads(SETS.read_text())
    for speaker, voice in VOICES.items():
        print(f'{speaker} ({voice}, set {sets.get(speaker) or "new"}): {len(jobs[speaker])} lines')
    dry = '--dry-run' in sys.argv
    if dry and 'ACTIONS_ID_TOKEN_REQUEST_URL' not in os.environ:
        for speaker, todo in jobs.items():
            for k, zh in sorted(todo.items()):
                print(f'  {speaker} {k} {zh}')
        return

    token = oidc_token()
    for speaker, voice in VOICES.items():
        if not sets.get(speaker):
            if dry:
                print(f'{speaker}: would create the set and request all {len(jobs[speaker])} lines')
                continue
            sets[speaker] = call(token, f'/apps/{APP}/generation/sets', {
                'kind': 'tts', 'model': 'kokoro', 'modelVersion': 'v1.0', 'params': {'voice': voice},
                'language': 'zh', 'formats': ['audio/mp4'], 'maxBytes': MAX_BYTES, 'replicas': 1})['set']['id']
            SETS.write_text(json.dumps(sets, indent=2) + '\n')
            print(f'created {speaker} set {sets[speaker]}')
        have = existing_jobs(token, sets[speaker])
        needed = {k: zh for k, zh in jobs[speaker].items() if k not in have}
        accepted = sum(1 for k in jobs[speaker] if have.get(k) == 'accepted')
        waiting = sum(1 for k in jobs[speaker] if have.get(k) == 'open')
        stale = sorted(k for k in have if k not in jobs[speaker])
        print(f'{speaker} set {sets[speaker]}: {accepted} accepted, {waiting} waiting for a contributor, '
              f'{len(needed)} {"to request" if dry else "requested"}')
        if stale:
            print(f'::warning::{speaker}: {len(stale)} jobs are for text the app no longer uses '
                  f'(contributors may still generate them; the API cannot delete jobs): {", ".join(stale[:20])}')
        for k, zh in sorted(needed.items()):
            print(f'  {"would request" if dry else "requested"} {k} {zh}')
        if dry or not needed:
            continue
        todo = [{'key': k, 'input': {'text': zh}} for k, zh in sorted(needed.items())]
        for i in range(0, len(todo), BATCH):
            call(token, f'/apps/{APP}/generation/sets/{sets[speaker]}/jobs', {'jobs': todo[i:i + BATCH]})

main()
