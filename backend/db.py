import contextlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Iterator, Optional

from config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    upload_path TEXT,
    duration_seconds INTEGER,
    recorded_at TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analyses (
    video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
    profile TEXT NOT NULL,
    one_liner TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    summary_markdown TEXT NOT NULL,
    transcript_chars INTEGER,
    processing_seconds REAL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
    video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    segments_json TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
    video_id UNINDEXED,
    title,
    summary,
    transcript
);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect(read_only: bool) -> sqlite3.Connection:
    if read_only:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=30.0)
    else:
        conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
        conn.executescript(
            "PRAGMA journal_mode=WAL;"
            "PRAGMA busy_timeout=30000;"
            "PRAGMA synchronous=NORMAL;"
            "PRAGMA foreign_keys=ON;"
        )
    conn.row_factory = sqlite3.Row
    return conn


@contextlib.contextmanager
def connection(read_only: bool = False) -> Iterator[sqlite3.Connection]:
    conn = _connect(read_only)
    try:
        yield conn
        if not read_only:
            conn.commit()
    except Exception:
        if not read_only:
            conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connection() as conn:
        conn.executescript(SCHEMA)


def create_video(
    video_id: str,
    title: str,
    source_type: str,
    source_url: Optional[str] = None,
    upload_path: Optional[str] = None,
    duration_seconds: Optional[int] = None,
    recorded_at: Optional[str] = None,
) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO videos
                (id, title, source_type, source_url, upload_path, duration_seconds,
                 recorded_at, created_at, status, stage, error_message, attempts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', NULL, NULL, 0)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                source_url = excluded.source_url,
                upload_path = excluded.upload_path,
                duration_seconds = excluded.duration_seconds,
                recorded_at = excluded.recorded_at,
                status = 'queued',
                stage = NULL,
                error_message = NULL
            """,
            (video_id, title, source_type, source_url, upload_path, duration_seconds,
             recorded_at, _now()),
        )


def set_stage(video_id: str, stage: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE videos SET status = 'processing', stage = ? WHERE id = ?",
            (stage, video_id),
        )


def mark_started(video_id: str) -> None:
    with connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET status = 'processing', stage = 'starting',
                error_message = NULL, attempts = attempts + 1
            WHERE id = ?
            """,
            (video_id,),
        )


def set_recorded_at(video_id: str, recorded_at: str) -> None:
    with connection() as conn:
        conn.execute("UPDATE videos SET recorded_at = ? WHERE id = ?", (recorded_at, video_id))


def mark_completed(video_id: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE videos SET status = 'completed', stage = NULL, error_message = NULL WHERE id = ?",
            (video_id,),
        )


def mark_failed(video_id: str, stage: str, message: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE videos SET status = 'failed', stage = ?, error_message = ? WHERE id = ?",
            (stage, message[:500], video_id),
        )


def save_transcript(video_id: str, text: str, segments: list) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO transcripts (video_id, text, segments_json) VALUES (?, ?, ?)",
            (video_id, text, json.dumps(segments)),
        )


def save_analysis(
    video_id: str,
    profile: str,
    one_liner: str,
    summary_json: str,
    summary_markdown: str,
    transcript_chars: int,
    processing_seconds: float,
) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO analyses
                (video_id, profile, one_liner, summary_json, summary_markdown,
                 transcript_chars, processing_seconds, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id,
                profile,
                one_liner,
                summary_json,
                summary_markdown,
                transcript_chars,
                processing_seconds,
                _now(),
            ),
        )
        _reindex(conn, video_id)


def _reindex(conn: sqlite3.Connection, video_id: str) -> None:
    row = conn.execute(
        """
        SELECT v.title, a.summary_markdown, t.text
        FROM videos v
        LEFT JOIN analyses a ON a.video_id = v.id
        LEFT JOIN transcripts t ON t.video_id = v.id
        WHERE v.id = ?
        """,
        (video_id,),
    ).fetchone()
    if not row:
        return

    conn.execute("DELETE FROM videos_fts WHERE video_id = ?", (video_id,))
    conn.execute(
        "INSERT INTO videos_fts (video_id, title, summary, transcript) VALUES (?, ?, ?, ?)",
        (video_id, row["title"], row["summary_markdown"] or "", row["text"] or ""),
    )


LIST_COLUMNS = """
    v.id, v.title, v.source_type, v.source_url, v.duration_seconds, v.recorded_at,
    v.created_at, v.status, v.stage, v.error_message,
    a.profile, a.one_liner, a.created_at AS analyzed_at
"""


def list_videos(
    query: Optional[str] = None,
    profile: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
) -> list[dict]:
    conditions = []
    params: list = []

    if query:
        conditions.append("v.id IN (SELECT video_id FROM videos_fts WHERE videos_fts MATCH ?)")
        params.append(_to_fts_query(query))
    if profile:
        conditions.append("a.profile = ?")
        params.append(profile)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    with connection(read_only=True) as conn:
        rows = conn.execute(
            f"""
            SELECT {LIST_COLUMNS}
            FROM videos v
            LEFT JOIN analyses a ON a.video_id = v.id
            {where}
            ORDER BY COALESCE(v.recorded_at, v.created_at) DESC
            LIMIT ? OFFSET ?
            """,
            params,
        ).fetchall()
    return [dict(row) for row in rows]


def _to_fts_query(query: str) -> str:
    """Quote each term so punctuation cannot be read as FTS5 operator syntax."""
    terms = [term.replace('"', "") for term in query.split() if term.strip()]
    return " ".join(f'"{term}"*' for term in terms)


def get_video(video_id: str) -> Optional[dict]:
    with connection(read_only=True) as conn:
        row = conn.execute(
            f"""
            SELECT {LIST_COLUMNS}, a.summary_json, a.summary_markdown, a.transcript_chars
            FROM videos v
            LEFT JOIN analyses a ON a.video_id = v.id
            WHERE v.id = ?
            """,
            (video_id,),
        ).fetchone()

    if not row:
        return None

    video = dict(row)
    video["summary"] = json.loads(video.pop("summary_json")) if video.get("summary_json") else None
    return video


def get_source(video_id: str) -> Optional[dict]:
    """The fields the processing pipeline needs, including the on-disk path of an upload."""
    with connection(read_only=True) as conn:
        row = conn.execute(
            "SELECT id, title, source_type, source_url, upload_path FROM videos WHERE id = ?",
            (video_id,),
        ).fetchone()
    return dict(row) if row else None


def get_transcript(video_id: str) -> Optional[dict]:
    with connection(read_only=True) as conn:
        row = conn.execute(
            "SELECT text, segments_json FROM transcripts WHERE video_id = ?", (video_id,)
        ).fetchone()

    if not row:
        return None
    return {"text": row["text"], "segments": json.loads(row["segments_json"] or "[]")}


def delete_video(video_id: str) -> tuple[bool, Optional[str]]:
    """Delete a video and its analysis. Returns whether it existed and any file left on disk."""
    with connection() as conn:
        row = conn.execute("SELECT upload_path FROM videos WHERE id = ?", (video_id,)).fetchone()
        if not row:
            return False, None
        conn.execute("DELETE FROM videos_fts WHERE video_id = ?", (video_id,))
        conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
    return True, row["upload_path"]
