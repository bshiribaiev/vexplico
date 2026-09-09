import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

DB_PATH = Path(os.getenv("DB_PATH", "vexplico.db"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Tried in order; the second is a cheaper fallback if the first is unavailable.
TRANSCRIPTION_MODELS = ["universal-3-5-pro", "universal-2"]
ANALYSIS_MODEL = "gemini-2.5-flash"

ANALYSIS_CHUNK_CHARS = 15000
