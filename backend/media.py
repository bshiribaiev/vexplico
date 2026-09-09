import json
import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class MediaError(Exception):
    """Raised when a media file cannot be read or converted."""


def normalize_audio(source_path: str, temp_dir: str) -> str:
    """Extract audio as 16kHz mono FLAC, which is lossless at the rate ASR models run on."""
    output_path = Path(temp_dir) / "normalized.flac"
    command = [
        "ffmpeg", "-i", source_path,
        "-vn", "-acodec", "flac", "-ar", "16000", "-ac", "1",
        str(output_path), "-y",
    ]
    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0 or not output_path.exists():
        raise MediaError(f"ffmpeg could not extract audio: {result.stderr[-500:]}")

    logger.info("Normalized audio to %.1fMB", output_path.stat().st_size / (1024 * 1024))
    return str(output_path)


def duration_seconds(audio_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", audio_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise MediaError(f"ffprobe could not read {audio_path}: {result.stderr[-300:]}")
    return float(json.loads(result.stdout)["format"]["duration"])


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None
