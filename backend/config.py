import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PROXY_URL = os.getenv("PROXY_URL")
YOUTUBE_COOKIES = os.getenv("YOUTUBE_COOKIES")

DB_PATH = Path(os.getenv("DB_PATH", "explico.db"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

TRANSCRIPTION_MODEL = "whisper-1"
ANALYSIS_MODEL = "gemini-2.5-flash"

# The Whisper API rejects uploads over 25MB. Fifteen minutes of 16kHz mono mp3
# lands near 7MB, which leaves room for unusually dense audio.
AUDIO_CHUNK_SECONDS = 900

ANALYSIS_CHUNK_CHARS = 15000
