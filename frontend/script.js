// Base URL of our Flask backend.
const API_BASE = "http://localhost:5000";

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

// ---- Step 1: Search ----
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = '<p class="loading-state">Searching...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    const tracks = await response.json();
    renderSearchResults(tracks);
  } catch (err) {
    searchResults.innerHTML = '<p class="empty-state">Something went wrong. Is the backend running?</p>';
    console.error(err);
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
  recommendHeading.textContent = `Because you liked "${track}" by ${artist}`;

  recommendResults.classList.remove("results-enter");
  recommendResults.innerHTML = buildLoaderHTML();
  startLoaderProgress();

  try {
    const url = `${API_BASE}/api/recommend?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`;
    const response = await fetch(url);
    const recommendations = await response.json();

    // Snap the liquid the rest of the way to full, then zoom/fade the
    // note out and swap in the real cards underneath it.
    finishLoaderProgress(() => {
      const loaderWrap = document.getElementById("loader-wrap");
      if (loaderWrap) loaderWrap.classList.add("zoom-out");

      // Timing matches the .zoom-out CSS transition duration (0.9s)
      // so the swap happens right as the note has faded away.
      setTimeout(() => {
        renderRecommendations(recommendations);
      }, 900);
    });
  } catch (err) {
    cancelAnimationFrame(loaderRAF);
    recommendResults.innerHTML = '<p class="empty-state">Couldn\'t load recommendations.</p>';
    console.error(err);
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
      </div>
    `;
    recommendResults.appendChild(card);
  });

  // Force a reflow before adding the animation class so the entrance
  // animation reliably replays even if this container was just filled
  // a moment ago (browsers skip re-triggering an animation otherwise).
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
// LIQUID-NOTE LOADER
// An SVG music note whose interior is clipped so a
// "liquid" rect + wavy crest can rise inside it while
// we wait on the /api/recommend request.
// ============================================

function buildLoaderHTML() {
  return `
    <div class="loader-wrap" id="loader-wrap">
      <svg class="note-svg" viewBox="0 0 100 140">
        <defs>
          <!-- The note's silhouette, reused both as the visible outline
               and as a clip path for the liquid layer below. -->
          <clipPath id="noteClip">
            <ellipse cx="28" cy="112" rx="19" ry="14" transform="rotate(-15 28 112)"/>
            <rect x="44" y="14" width="7" height="98"/>
            <path d="M51 14 C 75 20, 80 40, 70 55 C 78 46, 74 30, 51 34 Z"/>
          </clipPath>
        </defs>

        <!-- Dim outline, always visible -->
        <g class="note-outline">
          <ellipse cx="28" cy="112" rx="19" ry="14" transform="rotate(-15 28 112)"/>
          <rect x="44" y="14" width="7" height="98"/>
          <path d="M51 14 C 75 20, 80 40, 70 55 C 78 46, 74 30, 51 34 Z"/>
        </g>

        <!-- Liquid layer: clipped to the note's shape, so only the
             part of the rect/wave inside the note silhouette shows. -->
        <g clip-path="url(#noteClip)">
          <g id="liquid-rise">
            <rect x="-10" y="20" width="120" height="130" class="liquid-fill"/>
            <path class="wave-path"
                  d="M-50 20 Q -37.5 12 -25 20 T 0 20 T 25 20 T 50 20 T 75 20 T 100 20 T 125 20 T 150 20 V40 H-50 Z"/>
          </g>
        </g>
      </svg>
      <p class="loader-label">Reading the signal…</p>
    </div>
  `;
}

// How far (in SVG units) the liquid group travels from fully-hidden
// (below the note) to fully-risen (covering it).
const LIQUID_TRAVEL = 140;

function updateLiquidPosition(progress) {
  const liquidRise = document.getElementById("liquid-rise");
  if (!liquidRise) return;
  liquidRise.style.transform = `translateY(${(1 - progress) * LIQUID_TRAVEL}px)`;
}

// Eases toward 85% while we wait on the real network request — we don't
// know how long it'll take, so we never claim to reach 100% until the
// data has actually arrived.
function startLoaderProgress() {
  loaderProgress = 0;
  function tick() {
    loaderProgress += (0.85 - loaderProgress) * 0.025;
    updateLiquidPosition(loaderProgress);
    loaderRAF = requestAnimationFrame(tick);
  }
  tick();
}

// Once real data has arrived, quickly tween the remaining distance to
// 100% instead of jumping instantly — reads as "finishing", not "cutting off".
function finishLoaderProgress(onDone) {
  cancelAnimationFrame(loaderRAF);
  const start = loaderProgress;
  const startTime = performance.now();
  const duration = 350;

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

// Basic sanitization so track/artist names with special characters
// can't break our HTML or enable injection.
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}