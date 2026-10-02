from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

    groq_api_key: str
    groq_text_model: str = "openai/gpt-oss-20b"
    groq_vision_model: str = "qwen/qwen3.8-27b"

    embed_model: str = "BAAI/bge-small-en-v1.5"

    chroma_path: str = "./data/chroma"
    storage_path: str = "./data/papers"

    def ensure_dirs(self) -> None:
        Path(self.chroma_path).mkdir(parents=True, exist_ok=True)
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()