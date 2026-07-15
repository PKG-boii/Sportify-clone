/*
background.js — Antigravity-themed interactive cosmic background.

Features:
1. Spacetime Warp Grid: A mesh of dots that physically bend/warp away from the cursor
   (gravitational lensing effect) and glow with transition states.
2. Floating Starfield: Ethereal ambient dust particles that slowly float UPWARD, defying gravity.
   They react dynamically to cursor proximity by swirling around the mouse pointer.
3. Gravitational Waves: Smooth, overlapping cosmic energy waves that float across the screen
   and react to search/download activity levels.
4. Active Data Bursts: Accelerated drift rates and glowing light streams during operations.
*/

const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width, height;
let dots = [];
let stars = [];
let rings = [];
let pointer = { x: -9999, y: -9999, easedX: -9999, easedY: -9999 };

// Activity states
let activityLevel = 1.0; 
let isSearchActive = false;
let activeDownloadsCount = 0;

// Configs
const SPACING = 48;             // grid density
const BASE_RADIUS = 1.0;        // resting dot size
const MAX_RADIUS = 3.5;         // dot size under cursor influence
const GRAVITY_RADIUS = 200;     // reach of pointer gravity field
const WARP_FACTOR = 28;         // how much the grid bends away from mouse (gravitational push)

// ---- Setup ----
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  buildGrid();
  buildStars();
}

function buildGrid() {
  dots = [];
  for (let x = SPACING / 2; x < width + SPACING; x += SPACING) {
    for (let y = SPACING / 2; y < height + SPACING; y += SPACING) {
      dots.push({
        x,
        y,
        currentRadius: BASE_RADIUS,
        currentAlpha: 0.08,
      });
    }
  }
}

function buildStars() {
  stars = [];
  const count = Math.min(60, Math.floor((width * height) / 25000));
  for (let i = 0; i < count; i++) {
    stars.push(createStar(true));
  }
}

function createStar(randomY = false) {
  return {
    x: Math.random() * width,
    y: randomY ? Math.random() * height : height + 10,
    vy: -(0.3 + Math.random() * 0.7), // float upward (negative y velocity)
    vx: (Math.random() - 0.5) * 0.2,
    size: 0.6 + Math.random() * 1.4,
    alpha: 0.1 + Math.random() * 0.5,
    colorType: Math.random() > 0.45 ? '46, 196, 182' : '255, 159, 28' // Teal/Amber
  };
}

// ---- Drawing & Physics Loops ----
function drawGrid() {
  // Smoothly interpolate pointer for fluid responsiveness
  pointer.easedX += (pointer.x - pointer.easedX) * 0.12;
  pointer.easedY += (pointer.y - pointer.easedY) * 0.12;

  for (const dot of dots) {
    const dx = dot.x - pointer.easedX;
    const dy = dot.y - pointer.easedY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let warpX = 0;
    let warpY = 0;
    let proximity = 0;

    if (dist < GRAVITY_RADIUS) {
      // Warp calculation: push dots outward from cursor, mimicking a gravitational lens
      proximity = 1 - dist / GRAVITY_RADIUS;
      const force = proximity * WARP_FACTOR;
      warpX = (dx / dist) * force;
      warpY = (dy / dist) * force;
    }

    // Target attributes
    const targetRadius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * proximity * Math.sqrt(activityLevel);
    const targetAlpha = (0.06 + 0.45 * proximity) * (0.8 + 0.2 * activityLevel);

    // Easing the updates
    dot.currentRadius += (targetRadius - dot.currentRadius) * 0.15;
    dot.currentAlpha += (targetAlpha - dot.currentAlpha) * 0.15;

    // Draw the dot warped
    ctx.beginPath();
    ctx.arc(dot.x + warpX, dot.y + warpY, dot.currentRadius, 0, Math.PI * 2);

    if (proximity > 0.05) {
      ctx.fillStyle = `rgba(46, 196, 182, ${dot.currentAlpha})`; // Teal
    } else {
      ctx.fillStyle = `rgba(255, 159, 28, ${dot.currentAlpha})`; // Amber
    }
    ctx.fill();
  }
}

function drawStars() {
  stars.forEach((star) => {
    // Basic upward drift
    let currentVy = star.vy * activityLevel;
    let currentVx = star.vx;

    // Check interaction with mouse pointer (push stars away)
    const dx = star.x - pointer.x;
    const dy = star.y - pointer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 150) {
      const force = (1 - dist / 150) * 2.0;
      // deflect stars sideways/away
      currentVx += (dx / dist) * force;
      currentVy += (dy / dist) * force - 0.2; // push upwards extra
    }

    star.x += currentVx;
    star.y += currentVy;

    // Slowly damp horizontal deflection velocity back to normal
    star.vx += ((Math.random() - 0.5) * 0.1 - star.vx) * 0.05;

    // Draw glowing star
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${star.colorType}, ${star.alpha * (0.7 + 0.3 * activityLevel)})`;
    ctx.fill();

    // Reset star when it floats off the top boundary
    if (star.y < -10) {
      Object.assign(star, createStar(false));
    }
  });
}

function drawRings() {
  rings.forEach((ring) => {
    ring.radius += 1.8 * Math.sqrt(activityLevel);
    ring.alpha *= 0.965; 

    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color || `rgba(255, 159, 28, ${ring.alpha})`;
    ctx.lineWidth = 1.0;
    ctx.stroke();
  });

  rings = rings.filter((ring) => ring.alpha > 0.015);
}

// Undulating cosmic waves (gravitational signals)
let waveOffset = 0;
function drawWaves() {
  const waveCount = 3;
  waveOffset += 0.012 * activityLevel;

  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath();
    const amplitude = (12 + i * 6) * Math.sqrt(activityLevel);
    const frequency = 0.0025 - i * 0.0005;
    const speed = waveOffset + i * 2.2;
    
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 10) {
      const y = height - 50 - i * 12 + Math.sin(x * frequency + speed) * amplitude;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    
    const waveAlpha = (0.02 - i * 0.006) * (0.8 + 0.2 * activityLevel);
    const color = i === 1 ? '255, 159, 28' : '46, 196, 182'; 
    ctx.fillStyle = `rgba(${color}, ${waveAlpha})`;
    ctx.fill();
  }
}

// ---- Core Draw Frame Loop ----
function frame() {
  ctx.clearRect(0, 0, width, height);
  
  // Ease activityLevel back to 1.0 resting state
  const targetActivity = (isSearchActive || activeDownloadsCount > 0) ? 2.5 : 1.0;
  activityLevel += (targetActivity - activityLevel) * 0.04;

  drawGrid();
  drawStars();
  drawRings();
  drawWaves();
  
  requestAnimationFrame(frame);
}

// ---- Interaction ----
let lastRingTime = 0;

function addRing(x, y, color) {
  rings.push({ x, y, radius: 0, alpha: 0.4, color });
}

window.addEventListener("mousemove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;

  const now = Date.now();
  const throttleInterval = activityLevel > 1.5 ? 140 : 250;
  if (now - lastRingTime > throttleInterval) {
    const ringColor = activityLevel > 1.5 
      ? `rgba(46, 196, 182, 0.35)` // Teal pulse on active operations
      : `rgba(255, 159, 28, 0.25)`; // Amber pulse on rest state
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
  canvas.style.transform = `translateY(${window.scrollY * 0.04}px)`;
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
  
  // Create ripple waves on activity start
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      addRing(
        Math.random() * width, 
        Math.random() * height, 
        Math.random() > 0.5 ? 'rgba(46, 196, 182, 0.2)' : 'rgba(255, 159, 28, 0.2)'
      );
    }, i * 200);
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