/**
 * Sit-Still Digital Business Card — App Logic
 *
 * Responsibilities:
 *  1. Register service worker
 *  2. Show "Add to Home Screen" prompt in browser mode
 *  3. Dark / light mode toggle (persisted in localStorage)
 *  4. Generate QR code encoding a vCard 3.0 string
 *  5. Web Share API — share .vcf file or fallback link
 *  6. DeviceOrientation parallax tilt
 */

'use strict';

// ─── vCard data ───────────────────────────────────────────────────────────────

const VCARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Will DiBernardo',
  'N:DiBernardo;Will;;;',
  'ORG:Sit-Still Landscape Architecture',
  'TITLE:RLA\\, ASLA\\, #6962',
  'TEL;TYPE=CELL:+12014520547',
  'EMAIL;TYPE=INTERNET:will@sit-still.com',
  'URL:https://sit-still.com',
  'ADR;TYPE=WORK:;;Los Angeles;;CA;;US',
  'END:VCARD',
].join('\r\n');

// ─── Service worker registration ──────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ─── DOM references ───────────────────────────────────────────────────────────

const body          = document.body;
const card          = document.getElementById('card');
const btnTheme      = document.getElementById('btnTheme');
const btnShare      = document.getElementById('btnShare');
const installPrompt = document.getElementById('installPrompt');
const dismissPrompt = document.getElementById('dismissPrompt');
const qrcodeEl      = document.getElementById('qrcode');

// ─── Theme (dark / light) ─────────────────────────────────────────────────────

/**
 * Priority order:
 *  1. User's saved preference (localStorage)
 *  2. System preference
 *  3. Default: dark (per design spec)
 */
function getInitialTheme() {
  const saved = localStorage.getItem('ss-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';   // default is dark
}

function applyTheme(theme) {
  body.classList.toggle('dark',  theme === 'dark');
  body.classList.toggle('light', theme === 'light');

  // Update PWA status-bar theme-color meta
  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#1a1917' : '#f5f3ef');
  }

  // Rebuild QR in the new colour scheme
  buildQRCode();
}

function toggleTheme() {
  const next = body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('ss-theme', next);
  applyTheme(next);
}

// Apply on load (before first paint — body already has class="dark" from HTML)
applyTheme(getInitialTheme());

btnTheme.addEventListener('click', toggleTheme);

// ─── QR Code generation ───────────────────────────────────────────────────────

function buildQRCode() {
  if (typeof QRCode === 'undefined') {
    // Library not loaded yet — retry after a short delay
    setTimeout(buildQRCode, 100);
    return;
  }

  // Clear previous render
  qrcodeEl.innerHTML = '';

  const isDark = body.classList.contains('dark');

  new QRCode(qrcodeEl, {
    text:         VCARD,
    width:        512,        // render at high resolution; CSS scales it down
    height:       512,
    colorDark:    isDark ? '#f5f3ef' : '#1a1917',
    colorLight:   isDark ? '#1a1917' : '#f5f3ef',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// Trigger QR build once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildQRCode);
} else {
  buildQRCode();
}

// ─── Share (Web Share API / vCard file) ───────────────────────────────────────

function createVcfBlob() {
  return new Blob([VCARD], { type: 'text/vcard' });
}

btnShare.addEventListener('click', async () => {
  const vcfBlob = createVcfBlob();
  const vcfFile = new File([vcfBlob], 'will-dibernardo.vcf', { type: 'text/vcard' });

  if (navigator.share) {
    try {
      const canShareFile = navigator.canShare && navigator.canShare({ files: [vcfFile] });
      if (canShareFile) {
        await navigator.share({ files: [vcfFile], title: 'Will DiBernardo' });
      } else {
        await navigator.share({
          title: 'Will DiBernardo — Sit-Still Landscape Architecture',
          text:  'RLA, ASLA, #6962 | will@sit-still.com | 201.452.0547',
          url:   'https://sit-still.com',
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Share failed:', err);
    }
  } else {
    // Fallback: download .vcf file
    const url = URL.createObjectURL(vcfBlob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'will-dibernardo.vcf' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});

// ─── Install prompt ───────────────────────────────────────────────────────────

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function showInstallPrompt() {
  if (!isStandalone() && !sessionStorage.getItem('ss-prompt-dismissed')) {
    setTimeout(() => installPrompt.classList.add('visible'), 1400);
  }
}

dismissPrompt.addEventListener('click', () => {
  installPrompt.classList.remove('visible');
  sessionStorage.setItem('ss-prompt-dismissed', '1');
});

window.addEventListener('load', showInstallPrompt);

// ─── DeviceOrientation parallax tilt ─────────────────────────────────────────

const TILT_MAX = 4;   // degrees
let tiltEnabled = false;

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

function handleOrientation(e) {
  const beta  = e.beta  ?? 0;
  const gamma = e.gamma ?? 0;
  const tx = clamp((beta  - 90) / 30, -1, 1) * TILT_MAX;
  const ty = clamp(gamma        / 30, -1, 1) * TILT_MAX;
  card.style.setProperty('--tilt-x', `${(-tx).toFixed(2)}deg`);
  card.style.setProperty('--tilt-y', `${ty.toFixed(2)}deg`);
}

function enableTilt() {
  if (tiltEnabled) return;
  tiltEnabled = true;
  window.addEventListener('deviceorientation', handleOrientation, { passive: true });
}

if (typeof DeviceOrientationEvent !== 'undefined') {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+: request on first touch
    document.addEventListener('touchstart', () => {
      DeviceOrientationEvent.requestPermission()
        .then(s => { if (s === 'granted') enableTilt(); })
        .catch(() => {});
    }, { passive: true, once: true });
  } else {
    enableTilt();
  }
}
