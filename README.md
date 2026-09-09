# Vexplico

Turn any recorded video into a summary worth reading.

## Problem

Recorded video is the worst place to store information. A two-hour meeting, a conference talk, a
lecture, a customer call — the substance is in there, but retrieving it means watching the whole
thing at 1x. Transcripts alone do not fix this; they just move the wall of words.

Generic summarizers make it worse by flattening everything into the same shape. A lecture summarized
as "key decisions and action items" produces empty sections, because a lecture has neither.

## What it does

Paste a link or upload a file. Vexplico pulls the audio, transcribes it with timestamps, works out
what kind of recording it is, and writes a summary shaped to fit it.

Every video gets the same core: an executive summary, topics, participants, open questions, and
notable quotes. On top of that, the model chooses two to four sections that fit *this* recording —
"Concepts introduced" for a lecture, "Objections raised" for a sales call, "Points of disagreement"
for a panel, "Testimony from the public" for a hearing. Sections a recording cannot support are left
out rather than filled with filler.

Every topic, decision, quote, and action item is anchored to the moment it happened, and those
timestamps link back into the source video.

## How it works

1. **Ingest** — `yt-dlp` for links, direct upload for local files. Everything is normalized to
   16kHz mono mp3.
2. **Transcribe** — audio is split into chunks that fit the Whisper API's 25MB limit, transcribed
   with timestamps, and stitched back together with offsets preserved. Length is not a constraint.
3. **Profile** — one pass over the transcript's opening identifies what the recording actually is:
   meeting, interview, lecture, presentation, panel, call, hearing, podcast, or other.
4. **Analyze** — a map/reduce over the transcript extracts the core fields, then a consolidation
   pass merges them and picks the adaptive sections. Invalid model output is retried once with the
   validation error fed back, then fails loudly rather than degrading to an empty summary.
5. **Read** — the summary renders structurally, with a Markdown export and the full transcript
   underneath.

## Running it

Backend:

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # add OPENAI_API_KEY and GEMINI_API_KEY
uvicorn main:app --reload
```

Requires `ffmpeg` on the path.

Frontend:

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Dependency check |
| `POST` | `/api/videos` | Queue a video by URL |
| `POST` | `/api/videos/upload` | Queue an uploaded file |
| `GET` | `/api/videos` | List and search (`q`, `profile`, `limit`, `offset`) |
| `GET` | `/api/videos/{id}` | Video with its summary |
| `GET` | `/api/videos/{id}/transcript` | Transcript with timestamped segments |
| `POST` | `/api/videos/{id}/reprocess` | Re-run the pipeline |
| `DELETE` | `/api/videos/{id}` | Delete a video and its analysis |

Processing runs in the background. A queued video reports `status` and `stage` until it reaches
`completed` or `failed`, and a failure records the stage it died at.

## Built with

TypeScript and React on the front, FastAPI and SQLite on the back, `ffmpeg` for audio, OpenAI
Whisper for transcription, and Gemini 2.5 Flash for analysis. Search runs on SQLite FTS5 over
titles, summaries, and transcripts.
