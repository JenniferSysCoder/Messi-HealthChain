import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[2] / "data"


def read(name, default=None):

    path = BASE / name

    if not path.exists():

        if default is None:
            return []

        return default

    try:

        with path.open("r", encoding="utf-8") as file:

            return json.load(file)

    except (json.JSONDecodeError, OSError):

        if default is None:
            return []

        return default


def write(name, data):

    BASE.mkdir(parents=True, exist_ok=True)

    path = BASE / name

    with path.open("w", encoding="utf-8") as file:

        json.dump(data, file, ensure_ascii=False, indent=2)
