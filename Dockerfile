FROM python:3.11-slim

# Install system dependencies (FFmpeg is required by yt-dlp to convert audio to MP3, Node.js is required for YouTube signature decryption)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire workspace (backend and frontend static assets)
COPY . .

# Flask default port
EXPOSE 5000

# Start production server running Flask from the backend directory, binding to the PORT environment variable if set
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --chdir backend app:app"]
