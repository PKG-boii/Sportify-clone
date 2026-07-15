# Sonar: Interactive Music Recommender & MP3 Pipeline

**Live Project:** [sportify-clone-production.up.railway.app](https://sportify-clone-production.up.railway.app/)

I built Sonar because I wanted a music discovery tool that doesn't just keep you locked inside a streaming ecosystem. I wanted to build something where you search for a song, get highly customized recommendations based on actual similarity metrics, and download the audio stream directly to your local drive.

This project is a full-stack application featuring a Python (Flask) backend, a custom hybrid recommendation algorithm, a typo-tolerant search fallback, and a glassmorphic front-end that responds to user and network activity in real time.

---

## 🚀 Key Engineering & Architectural Highlights

When preparing this for production, I focused on solving a few core engineering challenges that typically break basic media scrapers and API integrations.

### 1. The Hybrid Recommendation Engine
Rather than relying purely on external black-box recommendation lists, Sonar runs its own hybrid matching system to re-score candidate tracks.
* **Collaborative Signal:** It pulls initial similarity lists using Last.fm's API (which uses collective user listening habits).
* **Content Signal:** It queries the top genre, mood, and style tags for the seed track and all candidate tracks, converting them into tag sets.
* **Jaccard Similarity Blend:** The backend calculates the overlap of these tag sets using Jaccard Similarity:
  $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
* **Blended Score:** It blends the signals using a weighted score:
  $$\text{Final Score} = (0.6 \times \text{Last.fm Match}) + (0.4 \times \text{Jaccard Similarity Tag Score})$$
This ensures that recommendations are not just popular associations, but also share matching genre and vibe characteristics.

### 2. Typo-Tolerant Search Fallback (Fuzzy Matching)
Standard text-matching APIs fail when a user makes a simple spelling mistake. To handle this:
* If Last.fm's track search returns zero matches, the backend automatically triggers a fallback route to the **MusicBrainz API**.
* The query is parsed and formatted using **Lucene fuzzy syntax** (appending a `~` operator to each term, which allows matches within an edit distance of ~2 characters).
* This provides a seamless, fail-safe search experience without forcing the user to retype their query.

### 3. Concurrency-Safe MP3 Pipeline
Downloading and converting media streams in a cloud environment introduces scaling and blocking challenges.
* **Stream Delivery:** Instead of saving permanent files on the server, Sonar queries YouTube with `yt-dlp`, uses `ffmpeg` to extract and convert the audio stream to a 192kbps MP3 on-the-fly, and reads the binary data into memory.
* **UUID Isolation & Cleanup:** To support concurrent users, the downloader creates temporary, isolated directories utilizing UUIDs. A strict `try...finally` block guarantees that these temporary folders are deleted from disk the moment the data is sent back to the browser.
* **Anti-Blocking Measures (Netscape Cookie Parser):** Cloud hosting IPs (like Railway or Render) are aggressively flagged by YouTube's rate limiters. To bypass bot detection, the backend supports injecting Netscape-format login cookies via environment variables (`YOUTUBE_COOKIES`), allowing the server to authenticate and pull audio streams reliably.

### 4. Containerized Deployments
Deploying applications that depend on system-level binaries (like `ffmpeg`) can be painful on cloud platforms. I wrote a multi-stage `Dockerfile` that:
* Uses a lightweight Python base image.
* Installs `ffmpeg` and system dependencies via `apt-get`.
* Copies over the Flask app and static assets.
* Spins up a production-ready **Gunicorn** server to handle concurrent connections efficiently.

---

## 🎨 Frontend UI/UX Details

I designed the interface to feel like tuning into radio signals.
* **Interactive Canvas:** A custom HTML5 Canvas background renders ambient "sonar waves" and a grid that shifts dynamically based on cursor coordinates.
* **State-Driven Animations:** During active downloads, the background canvas waves speed up and emit glowing particles to show background processing.
* **Visual Polish:** CSS glassmorphism, animated equalizer-style loading states, and custom alert toast messages for network and download states.

---

## 📂 Project Structure

```text
├── backend/
│   ├── app.py                   # HTTP routing layer (Flask API / Static Asset server)
│   ├── lastfm_client.py         # Recommendation algorithms, fuzzy search & Jaccard logic
│   ├── youtube_downloader.py    # yt-dlp & ffmpeg media pipeline
│   ├── requirements.txt         # Python dependencies
│   └── temp_downloads/          # Ephemeral directory for conversion tasks
├── frontend/
│   ├── index.html               # Semantic HTML structure
│   ├── style.css                # Glassmorphic layout & layout tokens
│   ├── script.js                # Core frontend controller & API caller
│   └── background.js            # HTML5 Canvas visualizer
├── Dockerfile                   # Deployment wrapper including system binaries
└── README.md
```

---

## 💻 Local Setup

### Prerequisites
* **Python 3.10+**
* **FFmpeg** (Ensure `ffmpeg` is installed on your machine and accessible in your shell's `PATH`)

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/PKG-boii/Sportify-clone.git
   cd Sportify-clone
   ```

2. **Configure Environment:**
   Create a `.env` file inside the `backend/` directory:
   ```env
   LASTFM_API_KEY=your_lastfm_key_here
   YOUTUBE_COOKIES=your_optional_netscape_cookies_here
   ```

3. **Install & Run:**
   Create a virtual environment, install the packages, and launch the server:
   ```bash
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r backend/requirements.txt

   # Start the server
   python backend/app.py
   ```
   Open your browser and head to `http://localhost:5000`.

---

## 🧠 Lessons Learned & Future Iterations
* **Memory Optimization:** Reading the entire MP3 binary into RAM before sending it via `send_file` works fine for lightweight 192kbps files, but for longer files, it can cause memory spikes. A future improvement is to stream the output directly from the ffmpeg process pipe into the Flask HTTP response stream.
* **API Rate Limiting:** Mixing content and collaborative signals requires multiple API queries to Last.fm (1 to get recommendations, and $N$ to fetch tags for the candidates). Caching popular tracks in an in-memory database like Redis would dramatically cut down on API roundtrips and speed up the recommendations from seconds to milliseconds.
