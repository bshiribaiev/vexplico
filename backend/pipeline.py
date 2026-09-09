import logging
import tempfile
import time
import traceback

import db
import media
from analyze import analyze
from render_md import md_from_summary
from transcribe import transcribe

logger = logging.getLogger(__name__)


def process_video(video_id: str) -> None:
    """Run a queued video through download, transcription, and analysis."""
    video = db.get_source(video_id)
    if not video:
        logger.error("Cannot process %s: no such video", video_id)
        return

    started_at = time.time()
    stage = "starting"
    db.mark_started(video_id)

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            stage = "audio"
            db.set_stage(video_id, stage)
            audio_path = _prepare_audio(video, temp_dir)

            stage = "transcription"
            db.set_stage(video_id, stage)
            transcript = transcribe(audio_path, temp_dir)
            db.save_transcript(video_id, transcript.text, transcript.segments)

        stage = "analysis"
        db.set_stage(video_id, stage)
        summary = analyze(video["title"], transcript)

        stage = "saving"
        db.set_stage(video_id, stage)
        db.save_analysis(
            video_id=video_id,
            profile=summary.profile,
            one_liner=summary.one_liner,
            summary_json=summary.model_dump_json(),
            summary_markdown=md_from_summary(summary, video["title"]),
            transcript_chars=len(transcript.text),
            processing_seconds=time.time() - started_at,
        )
        if summary.stated_date:
            db.set_recorded_at(video_id, summary.stated_date)

        db.mark_completed(video_id)
        logger.info("Processed %s in %.1fs", video_id, time.time() - started_at)

    except Exception as error:
        logger.error("Processing %s failed at stage '%s': %s", video_id, stage, error)
        logger.debug(traceback.format_exc())
        db.mark_failed(video_id, stage, str(error))


def _prepare_audio(video: dict, temp_dir: str) -> str:
    if video["source_type"] == "upload":
        return media.normalize_audio(video["upload_path"], temp_dir)

    downloaded = media.download_audio(video["source_url"], temp_dir)
    return media.normalize_audio(downloaded, temp_dir)
