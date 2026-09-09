# Explico

Turn any recorded video into a summary worth reading.

Paste a link or upload a file. Explico pulls the audio, transcribes it with timestamps, works out
what kind of recording it is — a meeting, an interview, a lecture, a sales call, a public hearing —
and writes a summary shaped to fit it. A lecture gets concepts and worked examples; a meeting gets
decisions and action items; an interview gets neither, because it has neither.

## How it works

1. **Ingest** — `yt-dlp` for links, direct upload for local files. Everything is normalized to
   16kHz mono mp3.
2. **Transcribe** — audio is split into chunks that fit the Whisper API's 25MB limit, transcribed
   with timestamps, and stitched back together with offsets preserved. Length is not a constraint.
3. **Profile** — one pass over the transcript's opening identifies what the recording actually is.
4. **Analyze** — a map/reduce over the transcript extracts topics, decisions, action items,
   participants, open questions, and quotes, each anchored to the moment it happened. The model
   also chooses two to four sections that fit this particular recording.
5. **Read** — the summary renders with timestamps that link back into the source video.

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

## Built with

TypeScript and React on the front, FastAPI and SQLite on the back, `ffmpeg` for audio, OpenAI
Whisper for transcription, and Gemini 2.5 Flash for analysis. Search runs on SQLite FTS5 over
titles, summaries, and transcripts.
