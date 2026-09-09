import json
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from openai import OpenAI

from config import AUDIO_CHUNK_SECONDS, OPENAI_API_KEY, TRANSCRIPTION_MODEL

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    """Raised when audio cannot be turned into usable text."""


@dataclass
class Transcript:
    text: str
    segments: list[dict] = field(default_factory=list)

    @property
    def is_usable(self) -> bool:
        return len(self.text.strip()) >= 100


def split_audio(audio_path: str, temp_dir: str) -> list[tuple[str, float]]:
    """Split audio into chunks small enough for the Whisper API, with each chunk's start offset."""
    if _duration_seconds(audio_path) <= AUDIO_CHUNK_SECONDS:
        return [(audio_path, 0.0)]

    chunk_dir = Path(temp_dir) / "chunks"
    chunk_dir.mkdir(exist_ok=True)
    command = [
        "ffmpeg", "-i", audio_path,
        "-f", "segment", "-segment_time", str(AUDIO_CHUNK_SECONDS),
        "-c", "copy", "-reset_timestamps", "1",
        str(chunk_dir / "chunk%04d.mp3"), "-y",
    ]
    result = subprocess.run(command, capture_output=True, text=True)

    chunk_paths = sorted(chunk_dir.glob("chunk*.mp3"))
    if result.returncode != 0 or not chunk_paths:
        raise TranscriptionError(f"ffmpeg could not split audio: {result.stderr[-500:]}")

    # Offsets accumulate measured durations rather than the nominal segment length,
    # because -c copy can only cut on frame boundaries.
    chunks = []
    offset = 0.0
    for path in chunk_paths:
        chunks.append((str(path), offset))
        offset += _duration_seconds(str(path))

    logger.info("Split audio into %d chunks", len(chunks))
    return chunks


def _duration_seconds(audio_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", audio_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise TranscriptionError(f"ffprobe could not read {audio_path}: {result.stderr[-300:]}")
    return float(json.loads(result.stdout)["format"]["duration"])


def transcribe(audio_path: str, temp_dir: str) -> Transcript:
    """Transcribe audio of any length, preserving timestamps across chunk boundaries."""
    if not OPENAI_API_KEY:
        raise TranscriptionError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=OPENAI_API_KEY)
    chunks = split_audio(audio_path, temp_dir)

    segments = []
    texts = []

    for index, (chunk_path, offset) in enumerate(chunks):
        logger.info("Transcribing chunk %d/%d", index + 1, len(chunks))
        chunk = _transcribe_chunk(client, chunk_path)
        texts.append(chunk.text.strip())
        segments.extend(
            {
                "start": round(segment.start + offset, 2),
                "end": round(segment.end + offset, 2),
                "text": segment.text.strip(),
            }
            for segment in chunk.segments or []
        )

    transcript = Transcript(text=" ".join(t for t in texts if t), segments=segments)
    if not transcript.is_usable:
        raise TranscriptionError("Transcription produced too little text to analyze")

    return transcript


def _transcribe_chunk(client: OpenAI, chunk_path: str):
    with open(chunk_path, "rb") as audio_file:
        return client.audio.transcriptions.create(
            model=TRANSCRIPTION_MODEL,
            file=audio_file,
            response_format="verbose_json",
        )
