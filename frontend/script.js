// Base URL of our Flask backend. Automatically falls back to relative paths in production.
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:5000" 
  : "";

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const searchResults = document.getElementById("search-results");
const recommendSection = document.getElementById("recommendations-section");
const recommendHeading = document.getElementById("recommend-heading");
const recommendResults = document.getElementById("recommend-results");

// ---- Event listeners ----
searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

// ---- Global Toast System ----
function showToast(message, type = 'info', duration = 6000) {
  const container = document.getElementById("status-toast-container");
  if (!container) return null;

  const toast = document.createElement("div");
  toast.className = `status-toast ${type}`;

  let iconHTML = '';
  if (type === 'info') {
    iconHTML = '<span class="spinner"></span>';
  } else if (type === 'success') {
    iconHTML = '<svg style="width:16px;height:16px;color:var(--signal);flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconHTML = '<svg style="width:16px;height:16px;color:#FF6F59;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }

  toast.innerHTML = `
    ${iconHTML}
    <span style="line-height: 1.4;">${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  const timeoutId = setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, duration);

  // Expose manual dismiss
  toast.remove = () => {
    clearTimeout(timeoutId);
    toast.classList.add("toast-out");
    // Ensure cleanup
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  return toast;
}

// ---- Step 1: Search ----
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = '<p class="loading-state">Tuning sonar receiver...</p>';
  window.dispatchEvent(new CustomEvent('sonar-activity-start', { detail: { type: 'search' } }));

  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    const tracks = await response.json();
    renderSearchResults(tracks);
  } catch (err) {
    searchResults.innerHTML = '<p class="empty-state">Something went wrong. Is the backend running?</p>';
    console.error(err);
  } finally {
    window.dispatchEvent(new CustomEvent('sonar-activity-end', { detail: { type: 'search' } }));
  }
}

function renderSearchResults(tracks) {
  searchResults.innerHTML = "";

  if (tracks.length === 0) {
    searchResults.innerHTML = '<p class="empty-state">No results found.</p>';
    return;
  }

  tracks.forEach((track) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="card-title">${escapeHTML(track.title)}</p>
          <p class="card-artist">${escapeHTML(track.artist)}</p>
        </div>
      </div>
      <div class="card-actions">
        <button data-artist="${escapeHTML(track.artist)}" data-track="${escapeHTML(track.title)}">
          Get recommendations
        </button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", (e) => {
      const { artist, track: trackName } = e.target.dataset;
      handleGetRecommendations(artist, trackName);
    });
    searchResults.appendChild(card);
  });
}

// ---- Step 2: Recommendations, with the liquid-note loader ----
let loaderProgress = 0;
let loaderRAF = null;

async function handleGetRecommendations(artist, track) {
  recommendSection.classList.remove("hidden");
  setTimeout(() => {
    recommendSection.classList.add("show");
    // Scroll immediately to the recommendations container so they see the loading animation!
    recommendSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  recommendHeading.textContent = `Because you liked "${track}" by ${artist}`;

  recommendResults.classList.remove("results-enter");
  recommendResults.innerHTML = buildLoaderHTML();

  // Dispatch active background trigger
  window.dispatchEvent(new CustomEvent('sonar-activity-start', { detail: { type: 'recommend' } }));

  // Loading Telemetry subtext sequence
  const telemetryTexts = [
    "Tuning digital signals...",
    "Querying acoustics indexes...",
    "Extracting spectrum tags...",
    "Mapping similarity grids...",
    "Calculating wave weights...",
    "Resolving recommendations...",
    "Finalizing acoustic data..."
  ];
  let telemetryIndex = 0;
  const telemetryInterval = setInterval(() => {
    const sublabel = document.getElementById("loader-sublabel");
    if (sublabel) {
      telemetryIndex = (telemetryIndex + 1) % telemetryTexts.length;
      sublabel.textContent = telemetryTexts[telemetryIndex];
    }
  }, 850);

  startLoaderProgress();

  try {
    const url = `${API_BASE}/api/recommend?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`;
    const response = await fetch(url);
    const recommendations = await response.json();

    finishLoaderProgress(() => {
      clearInterval(telemetryInterval);
      const loaderWrap = document.getElementById("loader-wrap");
      if (loaderWrap) loaderWrap.classList.add("zoom-out");

      setTimeout(() => {
        renderRecommendations(recommendations);
        window.dispatchEvent(new CustomEvent('sonar-activity-end', { detail: { type: 'recommend' } }));
      }, 750);
    });
  } catch (err) {
    clearInterval(telemetryInterval);
    cancelAnimationFrame(loaderRAF);
    recommendResults.innerHTML = '<p class="empty-state">Couldn\'t load recommendations. Is the backend running?</p>';
    window.dispatchEvent(new CustomEvent('sonar-activity-end', { detail: { type: 'recommend' } }));
    console.error(err);
  }
}

async function handleDownload(button, artist, track) {
  const card = button.closest(".card");
  if (card) {
    card.classList.add("is-downloading");
  }

  const originalHTML = button.innerHTML;
  button.innerHTML = '<span class="spinner"></span> Downloading...';
  button.disabled = true;

  // Notify background for high animation activity
  window.dispatchEvent(new CustomEvent('sonar-activity-start', { detail: { type: 'download' } }));
  const downloadToast = showToast(`Tuning downloader for "${track}" by ${artist}. Please wait...`, 'info', 30000);

  try {
    const url = `${API_BASE}/api/download?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Acoustic stream unavailable.");
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;

    // Sanitize filename for client side
    let safeTitle = `${track} - ${artist}`;
    for (const char of ['<', '>', ':', '"', '/', '\\', '|', '?', '*']) {
      safeTitle = safeTitle.replaceAll(char, '');
    }
    a.download = `${safeTitle}.mp3`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);

    if (downloadToast) downloadToast.remove();
    showToast(`Successfully downloaded "${track}" MP3!`, 'success', 5000);
  } catch (err) {
    if (downloadToast) downloadToast.remove();
    showToast(`Failed download for "${track}": ${err.message}`, 'error', 7000);
    console.error(err);
  } finally {
    if (card) {
      card.classList.remove("is-downloading");
    }
    button.innerHTML = originalHTML;
    button.disabled = false;
    window.dispatchEvent(new CustomEvent('sonar-activity-end', { detail: { type: 'download' } }));
  }
}

function renderRecommendations(tracks) {
  recommendResults.innerHTML = "";

  if (tracks.length === 0) {
    recommendResults.innerHTML = '<p class="empty-state">No similar tracks found.</p>';
    return;
  }

  tracks.forEach((track) => {
    const card = document.createElement("div");
    card.className = "card";

    const searchQuery = encodeURIComponent(`${track.title} ${track.artist}`);
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="card-title">${escapeHTML(track.title)}</p>
          <p class="card-artist">${escapeHTML(track.artist)}</p>
        </div>
        ${buildWaveformHTML(track.final_score)}
      </div>
      <p class="card-score">${track.final_score}% match</p>
      <div class="card-actions">
        <a href="${youtubeSearchUrl}" target="_blank" rel="noopener noreferrer">
          Play on YouTube
        </a>
        <button class="download-btn">
          Download MP3
        </button>
      </div>
    `;

    const downloadBtn = card.querySelector(".download-btn");
    downloadBtn.addEventListener("click", () => {
      handleDownload(downloadBtn, track.artist, track.title);
    });

    recommendResults.appendChild(card);
  });

  void recommendResults.offsetWidth;
  recommendResults.classList.add("results-enter");
}

// ---- Waveform match meter (unchanged logic, just markup) ----
function buildWaveformHTML(score) {
  const totalBars = 8;
  const litBars = Math.round((score / 100) * totalBars);
  const heights = [6, 12, 18, 10, 20, 8, 14, 6];

  const bars = heights
    .map((h, i) => {
      const litClass = i < litBars ? "lit" : "";
      return `<div class="waveform-bar ${litClass}" style="height:${h}px"></div>`;
    })
    .join("");

  return `<div class="waveform">${bars}</div>`;
}

// ============================================
// HIGH-TECH NOTE SVG RADAR LOADER
// ============================================
function buildLoaderHTML() {
  return `
    <div class="loader-wrap" id="loader-wrap">
      <div class="radar-container">
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="note-svg-container">
          <svg class="note-svg" viewBox="0 0 100 140">
            <defs>
              <clipPath id="noteClip">
                <ellipse cx="28" cy="112" rx="19" ry="14" transform="rotate(-15 28 112)"/>
                <rect x="44" y="14" width="7" height="98"/>
                <path d="M51 14 C 75 20, 80 40, 70 55 C 78 46, 74 30, 51 34 Z"/>
              </clipPath>
            </defs>

            <!-- Base outline -->
            <g class="note-outline">
              <ellipse cx="28" cy="112" rx="19" ry="14" transform="rotate(-15 28 112)"/>
              <rect x="44" y="14" width="7" height="98"/>
              <path d="M51 14 C 75 20, 80 40, 70 55 C 78 46, 74 30, 51 34 Z"/>
            </g>

            <!-- Dual-liquid layers clipped to note shape -->
            <g clip-path="url(#noteClip)">
              <g id="liquid-rise">
                <rect x="-10" y="20" width="120" height="130" class="liquid-fill"/>
                <!-- Background slow wave -->
                <path class="wave-path-2"
                      d="M-50 20 Q -37.5 8 -25 20 T 0 20 T 25 20 T 50 20 T 75 20 T 100 20 T 125 20 T 150 20 V40 H-50 Z"/>
                <!-- Foreground fast wave -->
                <path class="wave-path-1"
                      d="M-50 20 Q -37.5 12 -25 20 T 0 20 T 25 20 T 50 20 T 75 20 T 100 20 T 125 20 T 150 20 V40 H-50 Z"/>
              </g>
            </g>
          </svg>
        </div>
      </div>
      <p class="loader-label">Reading the signal</p>
      <p class="loader-sublabel" id="loader-sublabel">Tuning digital signals...</p>
    </div>
  `;
}

// Distance the liquid travels from bottom to top
const LIQUID_TRAVEL = 140;

function updateLiquidPosition(progress) {
  const liquidRise = document.getElementById("liquid-rise");
  if (!liquidRise) return;
  liquidRise.style.transform = `translateY(${(1 - progress) * LIQUID_TRAVEL}px)`;
}

// Ease slowly towards 88% while the API call is in progress
function startLoaderProgress() {
  loaderProgress = 0;
  function tick() {
    loaderProgress += (0.88 - loaderProgress) * 0.022;
    updateLiquidPosition(loaderProgress);
    loaderRAF = requestAnimationFrame(tick);
  }
  tick();
}

// Swiftly sweep to 100% when data is returned
function finishLoaderProgress(onDone) {
  cancelAnimationFrame(loaderRAF);
  const start = loaderProgress;
  const startTime = performance.now();
  const duration = 400;

  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    loaderProgress = start + (1 - start) * t;
    updateLiquidPosition(loaderProgress);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      onDone();
    }
  }
  requestAnimationFrame(tick);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}