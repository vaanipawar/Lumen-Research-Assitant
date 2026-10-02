import json
from pathlib import Path

from app.config import settings


def _highlights_path(paper_id: str) -> Path:
    return Path(settings.storage_path) / paper_id / "highlights.json"


def load_highlights(paper_id: str) -> list[dict]:
    path = _highlights_path(paper_id)
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_highlights(paper_id: str, highlights: list[dict]) -> None:
    path = _highlights_path(paper_id)
    path.write_text(json.dumps(highlights))

def _chat_path(paper_id: str) -> Path:
    return Path(settings.storage_path) / paper_id / "chat_history.json"


def load_chat_history(paper_id: str) -> list[dict]:
    path = _chat_path(paper_id)
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_chat_history(paper_id: str, messages: list[dict]) -> None:
    path = _chat_path(paper_id)
    path.write_text(json.dumps(messages))    


def _notes_path(paper_id: str) -> Path:
    return Path(settings.storage_path) / paper_id / "notes.json"


def load_notes(paper_id: str) -> list[dict]:
    path = _notes_path(paper_id)
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_notes(paper_id: str, notes: list[dict]) -> None:
    path = _notes_path(paper_id)
    path.write_text(json.dumps(notes))    
def _annotations_path(paper_id: str) -> Path:
    return Path(settings.storage_path) / paper_id / "annotations.json"


def load_annotations(paper_id: str) -> list[dict]:
    path = _annotations_path(paper_id)
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_annotations(paper_id: str, annotations: list[dict]) -> None:
    path = _annotations_path(paper_id)
    path.write_text(json.dumps(annotations))
