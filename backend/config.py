import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv
load_dotenv()


@dataclass
class Settings:
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    gemini_live_model: str = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")

    audio_sample_rate: int = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))

    ws_host: str = os.getenv("WS_HOST", "0.0.0.0")
    ws_port: int = int(os.getenv("WS_PORT", "8765"))

    log_dir: str = os.getenv("LOG_DIR", "logs")

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)


settings = Settings()
