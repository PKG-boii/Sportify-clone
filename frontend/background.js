/*
background.js — ambient "sonar signal" interactive background.

Features:
1. Grid of dots that light up and scale responsively as the cursor approaches, with smooth easing.
2. Expanding sonar ping rings generated on mouse movement, with higher density during activity.
3. Ambient, undulating audio wave lines floating across the canvas bottom.
4. Active "data streams" (flowing particles) triggered during search/download/recommend activities.
*/

const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width, height;
let dots = [];
let rings = [];
let particles = [];
let pointer = { x: -9999, y: -9999, easedX: -9999, easedY: -9999 };

// Activity states
let activityLevel = 1.0; // 1.0 = resting, rises to 2.5+ during active operations
let isSearchActive = false;
let activeDownloadsCount = 0;

// Configs
const SPACING = 44;          // distance between grid dots, in pixels
const BASE_RADIUS = 1.0;     // resting dot size
const MAX_RADIUS = 3.5;      // dot size right at the cursor
const REACT_DISTANCE = 180;  // how far pointer influence reaches

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
      dots.push({
        x,
        y,
        currentRadius: BASE_RADIUS,
        currentAlpha: 0.1,
        colorType: 0 // 0 = amber, 1 = teal
      });
    }
  }
}

// ---- Drawing Helpers ----
function drawGrid() {
  // Smoothly ease the pointer coordinates for natural drag effects
  pointer.easedX += (pointer.x - pointer.easedX) * 0.15;
  pointer.easedY += (pointer.y - pointer.easedY) * 0.15;

  for (const dot of dots) {
    const dx = dot.x - pointer.easedX;
    const dy = dot.y - pointer.easedY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Proximity value: 1.0 under mouse, 0.0 at REACT_DISTANCE
    const proximity = Math.max(0, 1 - dist / REACT_DISTANCE);

    // Target state based on proximity
    const targetRadius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * proximity * Math.sqrt(activityLevel);
    const targetAlpha = (0.08 + 0.5 * proximity) * (0.8 + 0.2 * activityLevel);

    // Interpolate/Ease dot states so they respond smoothly instead of popping
    dot.currentRadius += (targetRadius - dot.currentRadius) * 0.2;
    dot.currentAlpha += (targetAlpha - dot.currentAlpha) * 0.2;

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.currentRadius, 0, Math.PI * 2);

    // Grid dots transition to teal near cursor, and amber when resting
    if (proximity > 0.05) {
      ctx.fillStyle = `rgba(46, 196, 182, ${dot.currentAlpha})`; // Teal
    } else {
      ctx.fillStyle = `rgba(255, 159, 28, ${dot.currentAlpha * 0.85})`; // Amber
    }
    ctx.fill();
  }
}

function drawRings() {
  rings.forEach((ring) => {
    // Rings expand faster and fade slower during active states
    ring.radius += 1.8 * Math.sqrt(activityLevel);
    ring.alpha *= 0.97;

    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color || `rgba(255, 159, 28, ${ring.alpha})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  rings = rings.filter((ring) => ring.alpha > 0.015);
}

// Undulating ocean/signal waves at the bottom
let waveOffset = 0;
function drawWaves() {
  const waveCount = 3;
  waveOffset += 0.015 * activityLevel;

  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath();
    const amplitude = (15 + i * 8) * Math.sqrt(activityLevel);
    const frequency = 0.003 - i * 0.0006;
    const speed = waveOffset + i * 2.5;

    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 10) {
      const y = height - 40 - i * 15 + Math.sin(x * frequency + speed) * amplitude;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    // Wave styling
    const waveAlpha = (0.025 - i * 0.008) * (0.8 + 0.2 * activityLevel);
    const color = i === 1 ? '255, 159, 28' : '46, 196, 182'; // Amber & Teal blend
    ctx.fillStyle = `rgba(${color}, ${waveAlpha})`;
    ctx.fill();
  }
}

// Spawns flowing particles during activity
function spawnDataParticles() {
  if (activityLevel > 1.2 && Math.random() < 0.15 * activityLevel) {
    particles.push({
      x: Math.random() * width,
      y: height + 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -(2 + Math.random() * 3) * activityLevel,
      size: 1 + Math.random() * 2,
      alpha: 0.8,
      color: Math.random() > 0.4 ? 'rgba(46, 196, 182,' : 'rgba(255, 159, 28,'
    });
  }
}

function drawParticles() {
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.012;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `${p.color} ${p.alpha})`;
    ctx.fill();
  });

  particles = particles.filter((p) => p.alpha > 0.02 && p.y > -10);
}

// ---- Core Draw Frame Loop ----
function frame() {
  ctx.clearRect(0, 0, width, height);

  // Ease activityLevel back to 1.0 resting state
  const targetActivity = (isSearchActive || activeDownloadsCount > 0) ? 2.8 : 1.0;
  activityLevel += (targetActivity - activityLevel) * 0.05;

  drawGrid();
  drawRings();
  drawWaves();

  if (activityLevel > 1.1) {
    spawnDataParticles();
    drawParticles();
  }

  requestAnimationFrame(frame);
}

// ---- Interaction ----
let lastRingTime = 0;

function addRing(x, y, color) {
  rings.push({ x, y, radius: 0, alpha: 0.45, color });
}

window.addEventListener("mousemove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;

  const now = Date.now();
  // Spawns rings more frequently when active
  const throttleInterval = activityLevel > 1.5 ? 120 : 220;
  if (now - lastRingTime > throttleInterval) {
    const ringColor = activityLevel > 1.5
      ? `rgba(46, 196, 182, 0.4)` // Teal during activity
      : `rgba(255, 159, 28, 0.3)`; // Rest state amber
    addRing(e.clientX, e.clientY, ringColor);
    lastRingTime = now;
  }
});

window.addEventListener("mouseleave", () => {
  pointer.x = -9999;
  pointer.y = -9999;
});

// Subtle scroll parallax
window.addEventListener("scroll", () => {
  canvas.style.transform = `translateY(${window.scrollY * 0.05}px)`;
});

window.addEventListener("resize", resize);

// ---- Event Listeners for Activity Updates ----
window.addEventListener("sonar-activity-start", (e) => {
  const type = e.detail?.type;
  if (type === 'recommend' || type === 'search') {
    isSearchActive = true;
  } else if (type === 'download') {
    activeDownloadsCount++;
  }

  // Spawn a wave of bursts on start
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      addRing(
        Math.random() * width,
        Math.random() * height,
        Math.random() > 0.5 ? 'rgba(46, 196, 182, 0.25)' : 'rgba(255, 159, 28, 0.25)'
      );
    }, i * 150);
  }
});

window.addEventListener("sonar-activity-end", (e) => {
  const type = e.detail?.type;
  if (type === 'recommend' || type === 'search') {
    isSearchActive = false;
  } else if (type === 'download') {
    activeDownloadsCount = Math.max(0, activeDownloadsCount - 1);
  }
});

// ---- Boot ----
resize();

if (prefersReducedMotion) {
  drawGrid();
  drawWaves();
} else {
  requestAnimationFrame(frame);
}