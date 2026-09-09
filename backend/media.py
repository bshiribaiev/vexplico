import logging
import random
import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import yt_dlp

from config import PROXY_URL, YOUTUBE_COOKIES

logger = logging.getLogger(__name__)

PROXY_PATTERN = re.compile(r"http://brd-customer-(.+?)-zone-(.+?):(.+?)@(.+?):(\d+)")


class SourceError(Exception):
    """Raised when a video source cannot be read or downloaded."""


def _write_cookies(temp_dir: str) -> Optional[str]:
    if not YOUTUBE_COOKIES:
        return None
    cookies_path = Path(temp_dir) / "cookies.txt"
    cookies_path.write_text(YOUTUBE_COOKIES)
    return str(cookies_path)


def probe_source(url: str, temp_dir: str) -> dict:
    """Read a video's identity and duration without downloading it."""
    options = {"quiet": True, "no_warnings": True}
    cookies_path = _write_cookies(temp_dir)
    if cookies_path:
        options["cookiefile"] = cookies_path

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as error:
        raise SourceError(f"Could not read video from {url}: {error}") from error

    return {
        "id": info.get("id"),
        "title": info.get("title") or "Untitled video",
        "duration_seconds": info.get("duration"),
        "upload_date": info.get("upload_date"),
        "webpage_url": info.get("webpage_url") or url,
    }


class ProxyRotator:
    """Bright Data Web Unlocker sessions, rotated per download attempt."""

    def __init__(self, proxy_url: Optional[str]):
        self.proxy_url = proxy_url
        self.credentials = PROXY_PATTERN.match(proxy_url) if proxy_url else None
        if proxy_url and not self.credentials:
            logger.warning("PROXY_URL is set but not in the expected Bright Data format")

    @property
    def enabled(self) -> bool:
        return self.credentials is not None

    def session_url(self) -> str:
        account, zone, password, host, port = self.credentials.groups()
        session = random.randint(10_000_000, 999_999_999)
        return f"http://brd-customer-{account}-zone-{zone}-session-{session}:{password}@{host}:{port}"


_proxy = ProxyRotator(PROXY_URL)


def download_audio(url: str, temp_dir: str) -> str:
    """Download the audio track of a video, retrying on a fresh proxy session."""
    output_template = str(Path(temp_dir) / "source.%(ext)s")
    options = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "128"}
        ],
        "quiet": True,
        "retries": 3,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 1,
        "http_chunk_size": 2 * 1024 * 1024,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    cookies_path = _write_cookies(temp_dir)
    if cookies_path:
        options["cookiefile"] = cookies_path

    attempts = 3 if _proxy.enabled else 1
    last_error = None

    for attempt in range(attempts):
        if _proxy.enabled:
            options["proxy"] = _proxy.session_url()
            options["nocheckcertificate"] = True

        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                ydl.download([url])
            return _find_downloaded_audio(temp_dir)
        except Exception as error:
            last_error = error
            logger.warning("Download attempt %d/%d failed: %s", attempt + 1, attempts, error)

    raise SourceError(f"Could not download audio from {url}: {last_error}")


def _find_downloaded_audio(temp_dir: str) -> str:
    for candidate in sorted(Path(temp_dir).glob("source.*")):
        if candidate.suffix != ".txt" and candidate.stat().st_size > 0:
            return str(candidate)
    raise SourceError("Download finished but produced no audio file")


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
        raise SourceError(f"ffmpeg could not extract audio: {result.stderr[-500:]}")

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("Normalized audio to %.1fMB", size_mb)
    return str(output_path)


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None
