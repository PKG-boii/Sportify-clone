"""
app.py — HTTP layer. Thin on purpose: routes just call lastfm_client
functions and return JSON. No business logic lives here.
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import io
import os
import lastfm_client
import youtube_downloader

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


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


@app.route("/api/diagnose_cookies")
def diagnose_cookies():
    import sys
    import yt_dlp
    cookie_env = os.environ.get("YOUTUBE_COOKIES", "").strip()
    browser_env = os.environ.get("YOUTUBE_COOKIES_FROM_BROWSER", "").strip()
    
    report = {
        "cookie_env_length": len(cookie_env),
        "cookie_env_empty": not cookie_env,
        "browser_env": browser_env,
        "python_version": sys.version,
    }
    
    test_cookie_path = ""
    if cookie_env:
        lines = cookie_env.splitlines()
        report["total_lines"] = len(lines)
        
        # Check first 5 lines (masked values)
        masked_lines = []
        for i, line in enumerate(lines[:5]):
            parts = line.split()
            if len(parts) >= 6:
                masked_parts = parts[:6] + ["***MASKED***"]
                masked_lines.append(f"Line {i+1}: {' '.join(masked_parts)} (fields: {len(parts)}, tabs: {line.count('\t')})")
            else:
                masked_lines.append(f"Line {i+1}: {line[:30]}... (fields: {len(parts)}, tabs: {line.count('\t')})")
        report["first_5_lines_preview"] = masked_lines
        
        try:
            normalized = youtube_downloader.normalize_netscape_cookies(cookie_env)
            norm_lines = normalized.splitlines()
            report["normalized_total_lines"] = len(norm_lines)
            
            # Count lines with 7 fields
            seven_fields_count = 0
            for line in norm_lines:
                clean_line = line.strip()
                if clean_line.startswith("#HttpOnly_"):
                    clean_line = clean_line[10:]
                if not clean_line.startswith("#") and len(clean_line.split("\t")) == 7:
                    seven_fields_count += 1
            report["normalized_lines_with_7_tab_fields"] = seven_fields_count
            
        except Exception as norm_err:
            report["normalization_error"] = str(norm_err)
            
    # Try running a test download with a strict timeout to avoid Gunicorn 502 killing the worker
    try:
        test_dir = os.path.join(os.path.dirname(__file__), "temp_downloads")
        os.makedirs(test_dir, exist_ok=True)
        test_cookie_path = os.path.join(test_dir, "diagnose_cookies_temp.txt")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 8,  # strict timeout
            'js_runtimes': {'node': {}},
            'remote_components': ['ejs:github'],
        }
        
        if cookie_env:
            with open(test_cookie_path, 'w', encoding='utf-8') as cf:
                cf.write(youtube_downloader.normalize_netscape_cookies(cookie_env))
            ydl_opts['cookiefile'] = test_cookie_path
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info("ytsearch1:Tum Hi Ho", download=False)
            report["test_search_success"] = True
            report["test_search_title"] = info.get('entries', [{}])[0].get('title')
    except Exception as test_err:
        report["test_search_success"] = False
        report["test_search_error"] = str(test_err)
    finally:
        if test_cookie_path and os.path.exists(test_cookie_path):
            try:
                os.remove(test_cookie_path)
            except:
                pass
                
    return jsonify(report)


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
