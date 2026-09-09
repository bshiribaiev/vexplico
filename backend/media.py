import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class MediaError(Exception):
    """Raised when a media file cannot be read or converted."""


def normalize_audio(source_path: str, temp_dir: str) -> str:
    """Re-encode any media file to 16kHz mono mp3, the smallest form Whisper reads well."""
    output_path = Path(temp_dir) / "normalized.mp3"
    command = [
        "ffmpeg", "-i", source_path,
        "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "48k",
        str(output_path), "-y",
    ]
    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0 or not output_path.exists():
        raise MediaError(f"ffmpeg could not extract audio: {result.stderr[-500:]}")

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("Normalized audio to %.1fMB", size_mb)
    return str(output_path)


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None
