"""
app.py — HTTP layer. Thin on purpose: routes just call lastfm_client
functions and return JSON. No business logic lives here.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import lastfm_client
import youtube_downloader

app = Flask(__name__)
CORS(app)


@app.route("/api/search")
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "missing query param 'q'"}), 400
    return jsonify(lastfm_client.search_tracks(query))


@app.route("/api/recommend")
def recommend():
    artist = request.args.get("artist", "").strip()
    track = request.args.get("track", "").strip()
    if not artist or not track:
        return jsonify({"error": "missing 'artist' or 'track'"}), 400

    candidates = lastfm_client.get_similar_tracks(artist, track)
    reranked = lastfm_client.rerank_by_tags(artist, track, candidates)
    return jsonify(reranked[:10])  # only send the top 10 back to the frontend


@app.route("/api/download")
def download():
    artist = request.args.get("artist", "").strip()
    track = request.args.get("track", "").strip()
    if not artist or not track:
        return jsonify({"error": "missing 'artist' or 'track'"}), 400

    try:
        data, filename = youtube_downloader.download_audio_as_mp3(artist, track)
        return send_file(
            io.BytesIO(data),
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        app.logger.error(f"Download failed for {track} by {artist}: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
