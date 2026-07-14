/*
background.js — ambient "sonar ping" background.

Signature interaction: a grid of dots that light up as the cursor passes
near them (like a radar sweep), plus expanding ping rings that emanate
outward as the cursor moves. This ties directly into the app's theme
("read the signal") instead of being decoration for its own sake.

Runs on a <canvas> positioned behind the UI (see #bg-canvas in CSS).
*/

const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width, height;
let dots = [];
let rings = [];
let pointer = { x: -9999, y: -9999 };

const SPACING = 42;          // distance between grid dots, in pixels
const BASE_RADIUS = 1.2;     // resting dot size
const MAX_RADIUS = 3.2;      // dot size right at the cursor
const REACT_DISTANCE = 160;  // how far (px) the cursor's influence reaches

// ---- Setup ----
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  buildGrid();
}

function buildGrid() {
  dots = [];
  for (let x = SPACING / 2; x < width; x += SPACING) {
    for (let y = SPACING / 2; y < height; y += SPACING) {
      dots.push({ x, y });
    }
  }
}

// ---- Drawing ----
function drawGrid() {
  for (const dot of dots) {
    const dx = dot.x - pointer.x;
    const dy = dot.y - pointer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // proximity is 1.0 right at the cursor, fading to 0 at REACT_DISTANCE
    const proximity = Math.max(0, 1 - dist / REACT_DISTANCE);
    const radius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * proximity;
    const alpha = 0.15 + 0.5 * proximity;

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    // Dots near the cursor shift from resting amber to "signal" teal
    ctx.fillStyle = proximity > 0.05
      ? `rgba(95, 224, 210, ${alpha})`
      : `rgba(240, 174, 76, ${alpha})`;
    ctx.fill();
  }
}

function drawRings() {
  rings.forEach((ring) => {
    ring.radius += 2.4;
    ring.alpha *= 0.965; // exponential fade — feels more natural than linear

    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(240, 174, 76, ${ring.alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Drop rings once they've faded out, so the array doesn't grow forever
  rings = rings.filter((ring) => ring.alpha > 0.02);
}

function frame() {
  ctx.clearRect(0, 0, width, height);
  drawGrid();
  drawRings();
  requestAnimationFrame(frame);
}

// ---- Interaction ----
let lastRingTime = 0;

function addRing(x, y) {
  rings.push({ x, y, radius: 0, alpha: 0.35 });
}

window.addEventListener("mousemove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;

  // Throttle ring spawning — otherwise fast mouse movement floods
  // the array with hundreds of rings per second.
  const now = Date.now();
  if (now - lastRingTime > 220) {
    addRing(e.clientX, e.clientY);
    lastRingTime = now;
  }
});

window.addEventListener("mouseleave", () => {
  pointer.x = -9999;
  pointer.y = -9999;
});

// Subtle scroll parallax — the whole grid drifts slightly as you scroll,
// so the background feels connected to the page rather than glued to the viewport.
window.addEventListener("scroll", () => {
  canvas.style.transform = `translateY(${window.scrollY * 0.04}px)`;
});

window.addEventListener("resize", resize);

// ---- Boot ----
resize();

if (prefersReducedMotion) {
  // Respect the user's OS-level motion preference: draw one static
  // frame only, no animation loop, no reactive rings.
  drawGrid();
} else {
  requestAnimationFrame(frame);
}