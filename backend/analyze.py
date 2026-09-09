import json
import logging
from typing import Type, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from config import ANALYSIS_CHUNK_CHARS, ANALYSIS_MODEL, GEMINI_API_KEY
from schema import PROFILE_GUIDANCE, ChunkExtraction, ProfileDetection, VideoSummary
from transcribe import Transcript

logger = logging.getLogger(__name__)

Model = TypeVar("Model", bound=BaseModel)

SYSTEM_INSTRUCTION = """
You analyze recorded video of any kind — meetings, interviews, lectures, calls, panels, hearings,
podcasts — and produce a summary for someone who will not watch the recording.

Rules that apply to every video:
- Be specific. Name people, organizations, places, figures, and dates as they were said.
- Prefer substance over process. "The team chose Postgres over DynamoDB for relational joins" is
  useful; "the team discussed databases" is not.
- Never invent detail. If something was not said, leave the field empty rather than guessing.
- Attribute claims to whoever made them when the speaker is identifiable.
- Timestamps are given in the transcript as [seconds] markers. Use those exact numbers when a
  field asks for start_seconds; use 0 only when you genuinely cannot place the moment.
- Lines are labelled with the speaker turn that produced them (Speaker A, Speaker B, and so on).
  These are anonymous labels, not names. When someone is introduced or addressed by name, map the
  label to that name and use the real name; otherwise keep the label as given.
""".strip()


class AnalysisError(Exception):
    """Raised when the model cannot produce a valid summary."""


_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def _generate(prompt: str, response_model: Type[Model]) -> Model:
    """Ask for structured output, giving the model one chance to repair an invalid response."""
    if not _client:
        raise AnalysisError("GEMINI_API_KEY is not set")

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        response_mime_type="application/json",
        response_schema=response_model,
    )

    raw = _client.models.generate_content(
        model=ANALYSIS_MODEL, contents=prompt, config=config
    ).text

    try:
        return response_model.model_validate_json(raw)
    except ValidationError as error:
        schema_errors = str(error)
        logger.warning("Model returned invalid %s, retrying once", response_model.__name__)

    repair_prompt = (
        f"{prompt}\n\n"
        f"Your previous response did not satisfy the schema:\n{raw}\n\n"
        f"The validation errors were:\n{schema_errors}\n\n"
        "Return corrected JSON that satisfies the schema exactly."
    )
    repaired = _client.models.generate_content(
        model=ANALYSIS_MODEL, contents=repair_prompt, config=config
    ).text

    try:
        return response_model.model_validate_json(repaired)
    except ValidationError as error:
        raise AnalysisError(
            f"Model could not produce a valid {response_model.__name__}: {error}"
        ) from error


def detect_profile(title: str, transcript: Transcript) -> ProfileDetection:
    """Identify what kind of recording this is, so later passes can ask the right questions."""
    prompt = f"""
Identify what kind of recording this is from its title and opening.

Title: {title}

Opening of the transcript:
{transcript.text[:6000]}

Return:
- profile: the closest match to what this recording actually is
- subject: a short noun phrase naming what it is about (e.g. "Q3 roadmap review", "intro to
  convolutional networks", "zoning variance for 215 West 95th Street")
- stated_date: the date the recording states for itself as YYYY-MM-DD, or an empty string if none
  is stated
""".strip()
    return _generate(prompt, ProfileDetection)


def chunk_transcript(transcript: Transcript) -> list[str]:
    """Split the transcript into model-sized pieces that keep their timestamp markers."""
    if not transcript.segments:
        return _chunk_plain_text(transcript.text)

    chunks = []
    current: list[str] = []
    current_length = 0

    for segment in transcript.segments:
        speaker = f"Speaker {segment['speaker']}: " if segment.get("speaker") else ""
        line = f"[{int(segment['start'])}] {speaker}{segment['text']}"
        if current_length + len(line) > ANALYSIS_CHUNK_CHARS and current:
            chunks.append("\n".join(current))
            current, current_length = [], 0
        current.append(line)
        current_length += len(line) + 1

    if current:
        chunks.append("\n".join(current))
    return chunks


def _chunk_plain_text(text: str) -> list[str]:
    chunks = []
    for start in range(0, len(text), ANALYSIS_CHUNK_CHARS):
        chunk = text[start : start + ANALYSIS_CHUNK_CHARS]
        boundary = chunk.rfind(". ")
        if start + ANALYSIS_CHUNK_CHARS < len(text) and boundary > ANALYSIS_CHUNK_CHARS * 0.8:
            chunk = chunk[: boundary + 1]
        chunks.append(chunk)
    return chunks


def extract_from_chunk(chunk: str, index: int, total: int, detection: ProfileDetection) -> ChunkExtraction:
    prompt = f"""
This is part {index} of {total} of a transcript.

Recording type: {detection.profile}
Subject: {detection.subject}
{PROFILE_GUIDANCE[detection.profile]}

Extract everything of substance from this part:
- narrative: two or three paragraphs covering what actually happened or was said here
- topics: each distinct thing discussed, with a specific title, a summary of 3-5 sentences, the
  key points made, who spoke, and the [seconds] marker where it starts
- decisions: anything settled, chosen, agreed, ruled on, or committed to
- action_items: anything someone said they or another person would do
- participants: everyone identifiable, with their role and what they contributed
- open_questions: questions raised here that were not answered
- notable_quotes: statements worth reading verbatim

Transcript part {index}:
{chunk}
""".strip()
    return _generate(prompt, ChunkExtraction)


def consolidate(detection: ProfileDetection, title: str, extractions: list[ChunkExtraction]) -> VideoSummary:
    extracted = [item.model_dump() for item in extractions]

    prompt = f"""
Build one coherent summary of this entire recording from the parts extracted below.

Title: {title}
Recording type: {detection.profile}
Subject: {detection.subject}
{PROFILE_GUIDANCE[detection.profile]}

Requirements:
- one_liner: a single sentence naming what this recording is and its most important content. It
  appears alone on a list card, so it must stand on its own.
- executive_summary: two or three paragraphs that read like a well-reported article. Lead with what
  matters most. Name people and specifics. Someone who reads only this should know what happened.
- topics: merge duplicates across parts into coherent topics, ordered as they occurred, each
  keeping the earliest [seconds] marker where it began.
- decisions, action_items, participants, open_questions, notable_quotes: deduplicate and keep the
  most substantive. Leave a list empty if this kind of recording genuinely has none — an interview
  usually has no decisions, and a lecture usually has no action items.
- adaptive_sections: two to four sections that fit THIS recording and are not already covered by
  the fields above. Choose them from what the content actually offers. For a lecture that might be
  "Concepts introduced" or "Worked examples"; for a sales call, "Objections raised"; for a public
  hearing, "Testimony from the public"; for a panel, "Points of disagreement". Do not force
  sections that the content does not support.
- overall_sentiment: the prevailing tone across the recording.

Extracted parts:
{json.dumps(extracted, indent=2)}
""".strip()

    summary = _generate(prompt, VideoSummary)
    summary.profile = detection.profile
    summary.stated_date = summary.stated_date or detection.stated_date
    return summary


def analyze(title: str, transcript: Transcript) -> VideoSummary:
    detection = detect_profile(title, transcript)
    chunks = chunk_transcript(transcript)
    logger.info("Analyzing %s as '%s' across %d chunks", title, detection.profile, len(chunks))

    extractions = [
        extract_from_chunk(chunk, index, len(chunks), detection)
        for index, chunk in enumerate(chunks, start=1)
    ]
    return consolidate(detection, title, extractions)
