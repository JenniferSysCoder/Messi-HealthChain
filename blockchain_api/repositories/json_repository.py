import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[2] / "data"

def read(name, default=None):
    path = BASE / name
    if not path.exists():
        return [] if default is None else default
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError):
        return [] if default is None else default

def write(name, data):
    BASE.mkdir(parents=True, exist_ok=True)
    path = BASE / name
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
    temporary.replace(path)
