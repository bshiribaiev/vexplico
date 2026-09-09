import logging
import os
import uuid
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import db
import media
from config import CORS_ORIGINS, GEMINI_API_KEY, OPENAI_API_KEY, UPLOAD_DIR
from pipeline import process_video
from schema import Profile

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vexplico", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()
UPLOAD_DIR.mkdir(exist_ok=True)


@app.get("/health")
async def health():
    database_ok = True
    try:
        with db.connection(read_only=True) as conn:
            conn.execute("SELECT 1")
    except Exception as error:
        logger.error("Health check database error: %s", error)
        database_ok = False

    return {
        "database": database_ok,
        "ffmpeg": media.ffmpeg_available(),
        "transcription": bool(OPENAI_API_KEY),
        "analysis": bool(GEMINI_API_KEY),
    }


@app.post("/api/videos", status_code=202)
async def submit_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    video_id = uuid.uuid4().hex[:12]
    upload_path = UPLOAD_DIR / f"{video_id}{Path(file.filename or '').suffix}"
    upload_path.write_bytes(await file.read())

    title = Path(file.filename or "Uploaded video").stem
    db.create_video(video_id=video_id, title=title, upload_path=str(upload_path))
    background_tasks.add_task(process_video, video_id)

    return {"id": video_id, "title": title, "status": "queued"}


@app.get("/api/videos")
async def list_videos(
    q: Optional[str] = None,
    profile: Optional[Profile] = None,
    limit: int = 30,
    offset: int = 0,
):
    videos = db.list_videos(query=q, profile=profile, limit=min(limit, 100), offset=offset)
    return {"videos": videos, "count": len(videos)}


@app.get("/api/videos/{video_id}")
async def get_video(video_id: str):
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@app.get("/api/videos/{video_id}/transcript")
async def get_transcript(video_id: str):
    transcript = db.get_transcript(video_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript for this video yet")
    return transcript


@app.post("/api/videos/{video_id}/reprocess", status_code=202)
async def reprocess(video_id: str, background_tasks: BackgroundTasks):
    if not db.get_source(video_id):
        raise HTTPException(status_code=404, detail="Video not found")

    db.set_stage(video_id, "queued")
    background_tasks.add_task(process_video, video_id)
    return {"id": video_id, "status": "queued"}


@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: str):
    existed, upload_path = db.delete_video(video_id)
    if not existed:
        raise HTTPException(status_code=404, detail="Video not found")

    if upload_path and os.path.exists(upload_path):
        os.remove(upload_path)
    return {"id": video_id, "deleted": True}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
