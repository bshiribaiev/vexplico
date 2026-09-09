from schema import VideoSummary


def format_timestamp(seconds: int) -> str:
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _at(seconds: int) -> str:
    return f" _({format_timestamp(seconds)})_" if seconds else ""


def md_from_summary(summary: VideoSummary, title: str) -> str:
    lines = [f"# {title}", "", f"**{summary.one_liner}**", "", "## Overview", "", summary.executive_summary, ""]

    if summary.topics:
        lines += ["## What was covered", ""]
        for index, topic in enumerate(summary.topics, start=1):
            lines += [f"### {index}. {topic.title}{_at(topic.start_seconds)}", ""]
            if topic.speakers:
                lines += [f"**Speakers:** {', '.join(topic.speakers)}", ""]
            lines += [topic.summary, ""]
            if topic.key_points:
                lines += [f"- {point}" for point in topic.key_points] + [""]

    if summary.decisions:
        lines += ["## Decisions", ""]
        for decision in summary.decisions:
            lines += [f"- **{decision.item}** — {decision.outcome}{_at(decision.start_seconds)}"]
            if decision.rationale:
                lines += [f"  - {decision.rationale}"]
        lines += [""]

    if summary.action_items:
        lines += ["## Action items", ""]
        for item in summary.action_items:
            attribution = " · ".join(part for part in [item.owner, item.due] if part)
            suffix = f" ({attribution})" if attribution else ""
            lines += [f"- {item.task}{suffix}{_at(item.start_seconds)}"]
        lines += [""]

    for section in summary.adaptive_sections:
        if not section.items:
            continue
        lines += [f"## {section.title}", ""] + [f"- {item}" for item in section.items] + [""]

    if summary.open_questions:
        lines += ["## Open questions", ""] + [f"- {question}" for question in summary.open_questions] + [""]

    if summary.notable_quotes:
        lines += ["## Notable quotes", ""]
        for quote in summary.notable_quotes:
            attribution = f" — {quote.speaker}" if quote.speaker else ""
            lines += [f"> {quote.text}{attribution}{_at(quote.start_seconds)}", ""]

    if summary.participants:
        lines += ["## Participants", ""]
        for person in summary.participants:
            role = f" — {person.role}" if person.role else ""
            lines += [f"- **{person.name}**{role}"]
            if person.contribution:
                lines += [f"  - {person.contribution}"]
        lines += [""]

    return "\n".join(lines).strip() + "\n"
