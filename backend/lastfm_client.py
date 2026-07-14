

import os
import requests
from dotenv import load_dotenv

load_dotenv()  # reads .env into environment variables

API_KEY = os.environ.get("LASTFM_API_KEY", "")
BASE_URL = "http://ws.audioscrobbler.com/2.0/"


def _get(params: dict) -> dict:
    
    params.update({"api_key": API_KEY, "format": "json"})
    response = requests.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    return response.json()

def search_tracks(query: str, limit: int = 8) -> list[dict]:
    
    data = _get({"method": "track.search", "track": query, "limit": limit})
    matches = data.get("results", {}).get("trackmatches", {}).get("track", [])
    return [{"title": t["name"], "artist": t["artist"]} for t in matches]

def get_similar_tracks(artist: str, track: str, limit: int = 15) -> list[dict]:
    
    data = _get({
        "method": "track.getsimilar",
        "artist": artist,
        "track": track,
        "limit": limit,
    })
    raw = data.get("similartracks", {}).get("track", [])
    return [
        {
            "title": t["name"],
            "artist": t["artist"]["name"],
            "lastfm_match": float(t.get("match", 0)),  # 0.0–1.0
        }
        for t in raw
    ]

def get_top_tags(artist: str, track: str) -> set[str]:
    """
    Fetch genre/mood tags for a track (e.g. {'synthpop', '80s', 'dance'}).
    Returns a set because we only care about tag overlap, not order.
    """
    data = _get({"method": "track.gettoptags", "artist": artist, "track": track})
    tags = data.get("toptags", {}).get("tag", [])
    return {t["name"].lower() for t in tags}

def jaccard_similarity(set_a: set, set_b: set) -> float:
    """
    Jaccard similarity = size of intersection / size of union.
    
    """
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union

def rerank_by_tags(seed_artist: str, seed_track: str, candidates: list[dict]) -> list[dict]:
    """
    Takes Last.fm's raw similar-tracks list and re-scores each candidate
    using a blend of:
      - Last.fm's own match score (their collaborative-filtering signal)
      - our own tag-overlap score (a content-based signal)

    Blending two different signal types is a real recommender-systems
    technique — it's called a 'hybrid' recommender.
    """
    seed_tags = get_top_tags(seed_artist, seed_track)

    scored = []
    for candidate in candidates:
        candidate_tags = get_top_tags(candidate["artist"], candidate["title"])
        tag_score = jaccard_similarity(seed_tags, candidate_tags)

        # Weighted blend: tune these weights and you're tuning your "algorithm"
        final_score = (0.6 * candidate["lastfm_match"]) + (0.4 * tag_score)

        scored.append({
            **candidate,
            "tag_score": round(tag_score * 100, 1),
            "final_score": round(final_score * 100, 1),
        })

    # Highest blended score first
    scored.sort(key=lambda t: t["final_score"], reverse=True)
    return scored