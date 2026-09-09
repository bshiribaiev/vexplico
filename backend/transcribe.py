import logging
from dataclasses import dataclass, field

import assemblyai as aai

from config import ASSEMBLYAI_API_KEY, TRANSCRIPTION_MODELS

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


def transcribe(audio_path: str) -> Transcript:
    """Transcribe a recording of any length, with speaker turns and timestamps."""
    if not ASSEMBLYAI_API_KEY:
        raise TranscriptionError("ASSEMBLYAI_API_KEY is not set")

    aai.settings.api_key = ASSEMBLYAI_API_KEY
    config = aai.TranscriptionConfig(
        speech_models=TRANSCRIPTION_MODELS,
        speaker_labels=True,
        language_detection=True,
    )

    logger.info("Transcribing %s", audio_path)
    result = aai.Transcriber().transcribe(audio_path, config=config)

    if result.status == aai.TranscriptStatus.error:
        raise TranscriptionError(f"Transcription failed: {result.error}")

    transcript = Transcript(text=(result.text or "").strip(), segments=_to_segments(result))
    if not transcript.is_usable:
        raise TranscriptionError("Transcription produced too little text to analyze")

    logger.info("Transcribed %d characters across %d turns", len(transcript.text), len(transcript.segments))
    return transcript


def _to_segments(result) -> list[dict]:
    """One segment per speaker turn. The API reports timestamps in milliseconds."""
    return [
        {
            "start": round(utterance.start / 1000, 2),
            "end": round(utterance.end / 1000, 2),
            "speaker": utterance.speaker,
            "text": utterance.text.strip(),
        }
        for utterance in result.utterances or []
    ]
