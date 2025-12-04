import os
import json
from mutagen import File

AUDIO_ROOT = "audio/"
COLLECTIONS_PATH = "data/collections.json"

def get_metadata(filepath):
    audio = File(filepath, easy=True)
    if not audio:
        return {"title": None, "year": None, "artists": []}
    title = audio.get("title", [None])[0]
    year_raw = audio.get("date", [None])[0] or audio.get("year", [None])[0]
    year = None
    if year_raw:
        if len(year_raw) >= 4 and year_raw[:4].isdigit():
            year = int(year_raw[:4])
    artists = audio.get("artist", [""])
    if artists:
        artists = [a.strip() for a in artists[0].replace(";", ",").split(",") if a.strip()]
    return {"title": title, "year": year, "artists": artists}

def load_collections():
    if os.path.exists(COLLECTIONS_PATH):
        with open(COLLECTIONS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("collections", [])
    return []

def save_collections(collections):
    with open(COLLECTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump({"collections": collections}, f, indent=2, ensure_ascii=False)

def main():
    existing = {c["id"] for c in load_collections()}
    collections = load_collections()
    for folder in os.listdir(AUDIO_ROOT):
        folder_path = os.path.join(AUDIO_ROOT, folder)
        if not os.path.isdir(folder_path) or folder in existing:
            continue
        songs = []
        for fname in os.listdir(folder_path):
            if not fname.lower().endswith((".mp3", ".flac", ".wav", ".ogg", ".m4a")):
                continue
            fpath = os.path.join(folder_path, fname)
            meta = get_metadata(fpath)
            songs.append({
                "artists": meta["artists"],
                "title": meta["title"],
                "audioFile": fpath.replace("\\", "/"),
                "startTime": 0,
                "year": meta["year"]
            })
        collections.append({
			"id": folder,
			"title": None,
			"description": None,
			"difficulty": None,
			"rounds": None,
			"guessSongOnly": False,
			"songs": songs
		})
    save_collections(collections)

if __name__ == "__main__":
    main()