# Audio status

Every Mandarin line, reply, repair phrase and common phrase has an MP3 in `web/public/audio/zh/`,
named by `audioKey(voice, text)` in `audio.ts`. They are precached by the service worker, so playback
works offline after the first visit.

The recordings are **synthetic and unreviewed**. They were generated locally with Kokoro v1.0 ONNX,
the engine Sayback uses (`zf_xiaobei` for the other speaker, `zm_yunxi` for learner replies). They are
not native-speaker recordings. Tone sandhi, polyphonic characters (for example 一 read as yāo in phone
numbers), pacing and naturalness have not been checked by a listener. The app labels them as a guide,
not a pronunciation model. Professionally recorded or native-reviewed audio is still outstanding.

Regenerate after changing any Mandarin text: `scripts/generate-audio.py` (see its docstring). It adds
missing files and removes unreferenced ones. `dialogue.test.ts` fails if any line has no file.

## Word clips (pauses between words, #13)

With *Pause between words* on, a line plays word by word with the chosen gap. Words are the groups the pinyin
spells (`pinyinWords` in `pinyin.ts`: 欢迎光临 "Huānyíng guānglín" → 欢迎 · 光临). Each word is recorded once per
voice at `web/public/audio/words/<audioKey(voice, word)>.mp3`, silence trimmed, by the same
`scripts/generate-audio.py` (it lists words through `scripts/word_list.mts`, which runs the app's aligner;
Node 22). They are not precached (#8); offline, or if a clip is missing, the whole line plays instead.
`dialogue.test.ts` fails if any word has no clip. Speed applies to both.

## Community audio (dialogue#10)

Contributors' devices can generate the same lines through FreeAppStore community generation
(freeappstore-online/platform `docs/community-generation.md`): the *Community audio jobs* workflow
(`.github/workflows/community-audio.yml`, `scripts/community-audio.py`) queues one job per line in two
sets, `zf_xiaobei` for the other speaker and `zm_yunxi` for learner replies (Kokoro `v1.0`,
`language: zh`, `audio/mp4`). A job's key is the line's audio key and its input the Mandarin text
exactly. The first real run creates the sets, commits their ids to `community-sets.json` and redeploys.
It also runs by itself on every push to `main` that changes the dialogue text (#11): it reads each
set's jobs and requests only lines that have none yet, reporting how many are accepted, waiting and newly
requested, and warning about jobs for text the app no longer uses (the API cannot delete jobs). A manual
`dry_run` reports what would be requested without creating anything. The lines are listed
once, in `scripts/audio_lines.py`, for both scripts.

Mandarin is generated today only by the Android and iOS companions; the browser runner speaks English
only. The model request for Kokoro v1.0's Mandarin voices in the browser is freeappstore-online/platform#818.

The platform verifies every upload with Whisper before publishing it. `audio.ts` reads both sets'
public manifests once per visit and plays an accepted recording in place of the bundled MP3. Until the
manifests arrive, offline, or when a community file fails to load, the bundled MP3 plays.

Kokoro is Apache-2.0: https://github.com/hexgrad/kokoro/blob/main/LICENSE. Model files:
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (not committed).
