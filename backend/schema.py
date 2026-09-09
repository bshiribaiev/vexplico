from typing import Literal

from pydantic import BaseModel, Field

Profile = Literal[
    "meeting",
    "interview",
    "lecture",
    "presentation",
    "panel",
    "call",
    "hearing",
    "podcast",
    "other",
]

Sentiment = Literal["positive", "neutral", "negative", "mixed"]

PROFILE_GUIDANCE = {
    "meeting": "Emphasize what was agreed, who owns what next, and where the group disagreed.",
    "interview": "Emphasize the questions asked, the substance of each answer, and what the interviewee revealed or avoided.",
    "lecture": "Emphasize the concepts taught, the order they build in, examples used, and what a learner should take away.",
    "presentation": "Emphasize the argument being made, the evidence shown, and the audience's questions.",
    "panel": "Emphasize each panelist's position, where they agreed, and where they genuinely disagreed.",
    "call": "Emphasize the caller's goal, objections raised, commitments made, and the state the call ended in.",
    "hearing": "Emphasize testimony given, positions on the record, and any rulings or formal outcomes.",
    "podcast": "Emphasize the through-line of the conversation, the strongest claims made, and references worth following up.",
    "other": "Emphasize whatever carries the most information for someone who will not watch this.",
}


class Participant(BaseModel):
    name: str
    role: str = ""
    contribution: str = ""


class Topic(BaseModel):
    title: str
    summary: str
    key_points: list[str] = Field(default_factory=list)
    speakers: list[str] = Field(default_factory=list)
    start_seconds: int = 0


class Decision(BaseModel):
    item: str
    outcome: str
    rationale: str = ""
    start_seconds: int = 0


class ActionItem(BaseModel):
    task: str
    owner: str = ""
    due: str = ""
    start_seconds: int = 0


class Quote(BaseModel):
    text: str
    speaker: str = ""
    start_seconds: int = 0


class AdaptiveSection(BaseModel):
    """A section the model chooses because it fits this particular video."""

    title: str
    items: list[str] = Field(default_factory=list)


class ProfileDetection(BaseModel):
    profile: Profile
    subject: str
    stated_date: str = ""


class ChunkExtraction(BaseModel):
    narrative: str
    topics: list[Topic] = Field(default_factory=list)
    decisions: list[Decision] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    participants: list[Participant] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    notable_quotes: list[Quote] = Field(default_factory=list)


class VideoSummary(BaseModel):
    profile: Profile
    subject: str
    one_liner: str
    executive_summary: str
    stated_date: str = ""
    topics: list[Topic] = Field(default_factory=list)
    decisions: list[Decision] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    participants: list[Participant] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    notable_quotes: list[Quote] = Field(default_factory=list)
    adaptive_sections: list[AdaptiveSection] = Field(default_factory=list)
    overall_sentiment: Sentiment = "neutral"
