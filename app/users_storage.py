import json
from pathlib import Path

from app.config import settings
def _users_path() -> Path:
    return Path(settings.storage_path).parent / "users.json"



def load_users() -> dict:
    path = _users_path()
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_users(users: dict) -> None:
    path = _users_path()
    path.write_text(json.dumps(users))