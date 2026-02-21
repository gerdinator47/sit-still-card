/**
 * Sit-Still Digital Business Card — App Logic
 *
 * Responsibilities:
 *  1. Register service worker
 *  2. Show "Add to Home Screen" prompt in browser mode
 *  3. Dark / light mode toggle (persisted in localStorage)
 *  4. Card flip between contact side and wordmark side
 *  5. Generate QR code encoding a vCard 3.0 string
 *  6. Web Share API — share .vcf file or fallback link
 *  7. DeviceOrientation parallax tilt
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
const cardFront     = document.getElementById('cardFront');
const cardBack      = document.getElementById('cardBack');
const btnTheme      = document.getElementById('btnTheme');
const btnThemeBack  = document.getElementById('btnThemeBack');
const btnFlip       = document.getElementById('btnFlip');
const btnFlipBack   = document.getElementById('btnFlipBack');
const btnShare      = document.getElementById('btnShare');
const installPrompt = document.getElementById('installPrompt');
const dismissPrompt = document.getElementById('dismissPrompt');
const qrcodeEl      = document.getElementById('qrcode');

// ─── Theme (dark / light) ─────────────────────────────────────────────────────

/**
 * Returns the current preferred theme:
 *  1. User's saved preference (localStorage)
 *  2. System preference
 *  3. Default: light
 */
function getInitialTheme() {
  const saved = localStorage.getItem('ss-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme) {
  body.classList.toggle('dark', theme === 'dark');
  body.classList.toggle('light', theme === 'light');

  // Update status bar / theme-color meta for PWA chrome
  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) {
    themeColorMeta.setAttribute(
      'content',
      theme === 'dark' ? '#1a1917' : '#f5f3ef'
    );
  }

  // Regenerate QR code in the new colour scheme
  buildQRCode();
}

function toggleTheme() {
  const next = body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('ss-theme', next);
  applyTheme(next);
}

// Apply saved/system theme immediately (before first paint)
applyTheme(getInitialTheme());

btnTheme.addEventListener('click', toggleTheme);
btnThemeBack.addEventListener('click', toggleTheme);

// ─── Card flip ────────────────────────────────────────────────────────────────

let isFlipped = false;

function setFlipped(flipped) {
  isFlipped = flipped;
  cardFront.classList.toggle('hidden', flipped);
  cardBack.classList.toggle('active', flipped);
  // Update aria-hidden for screen readers
  cardFront.setAttribute('aria-hidden', String(flipped));
  cardBack.setAttribute('aria-hidden', String(!flipped));
  btnFlip.setAttribute('aria-label', flipped ? 'Show contact side' : 'Show wordmark side');
}

btnFlip.addEventListener('click', () => setFlipped(true));
btnFlipBack.addEventListener('click', () => setFlipped(false));

// ─── QR Code generation ───────────────────────────────────────────────────────

function buildQRCode() {
  // Guard: qrcode.js may not be loaded yet (e.g. slow CDN on first visit)
  if (typeof QRCode === 'undefined') return;

  // Clear any existing QR code
  qrcodeEl.innerHTML = '';

  const isDark = body.classList.contains('dark');

  // qrcode.js options
  new QRCode(qrcodeEl, {
    text:            VCARD,
    width:           256,          // rendered at 256×256, CSS scales it down
    height:          256,
    colorDark:       isDark ? '#f5f3ef' : '#1a1917',
    colorLight:      isDark ? '#1a1917' : '#f5f3ef',
    correctLevel:    QRCode.CorrectLevel.M,
  });
}

// Build QR once the DOM and library are both ready.
// app.js is deferred, so DOM is always ready; QRCode library loaded just before
// this script tag — but guard against slow CDN with a load-event fallback.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildQRCode);
} else {
  buildQRCode();
}

// If the library wasn't ready yet (CDN slow/offline), retry once it loads
if (typeof QRCode === 'undefined') {
  window.addEventListener('load', buildQRCode);
}

// ─── Share (Web Share API / vCard file) ───────────────────────────────────────

function createVcfBlob() {
  return new Blob([VCARD], { type: 'text/vcard' });
}

btnShare.addEventListener('click', async () => {
  const vcfBlob = createVcfBlob();
  const vcfFile = new File([vcfBlob], 'will-dibernardo.vcf', { type: 'text/vcard' });

  // Prefer sharing the file directly so the system offers "Add to Contacts"
  if (navigator.share) {
    try {
      // Check if file sharing is supported (not all browsers support files)
      const canShareFile = navigator.canShare && navigator.canShare({ files: [vcfFile] });
      if (canShareFile) {
        await navigator.share({
          files: [vcfFile],
          title: 'Will DiBernardo',
        });
      } else {
        // Fall back to sharing the URL
        await navigator.share({
          title: 'Will DiBernardo — Sit-Still Landscape Architecture',
          text: 'RLA, ASLA, #6962 | will@sit-still.com | 201.452.0547',
          url: 'https://sit-still.com',
        });
      }
    } catch (err) {
      // User cancelled or share failed — not an error we need to surface
      if (err.name !== 'AbortError') {
        console.warn('Share failed:', err);
      }
    }
  } else {
    // No Web Share API — offer a direct .vcf download as fallback
    const url = URL.createObjectURL(vcfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'will-dibernardo.vcf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});

// ─── "Add to Home Screen" install prompt ─────────────────────────────────────

// Only show the install prompt when running in the browser (not standalone)
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function showInstallPrompt() {
  if (!isStandalone() && !sessionStorage.getItem('ss-prompt-dismissed')) {
    // Short delay so the card loads first
    setTimeout(() => installPrompt.classList.add('visible'), 1200);
  }
}

dismissPrompt.addEventListener('click', () => {
  installPrompt.classList.remove('visible');
  sessionStorage.setItem('ss-prompt-dismissed', '1');
});

// Wait for the page to be ready before showing the prompt
window.addEventListener('load', showInstallPrompt);

// ─── DeviceOrientation parallax tilt ─────────────────────────────────────────

const TILT_MAX_DEG = 4;   // maximum tilt angle (degrees) — keep it very subtle

let tiltEnabled = false;

function handleOrientation(event) {
  // beta  = front-to-back tilt (−180 to 180); portrait: 0 = flat, 90 = upright
  // gamma = left-to-right tilt (−90 to 90)
  const beta  = event.beta  ?? 0;
  const gamma = event.gamma ?? 0;

  // When the phone is held upright, beta ≈ 90.
  // We want 0-centred deviation from that upright position.
  const tiltX = clamp((beta - 90) / 30, -1, 1) * TILT_MAX_DEG;
  const tiltY = clamp(gamma / 30, -1, 1) * TILT_MAX_DEG;

  cardFront.style.setProperty('--tilt-x', `${(-tiltX).toFixed(2)}deg`);
  cardFront.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
  cardBack.style.setProperty('--tilt-x', `${(-tiltX).toFixed(2)}deg`);
  cardBack.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function enableTilt() {
  if (tiltEnabled) return;
  tiltEnabled = true;
  window.addEventListener('deviceorientation', handleOrientation, { passive: true });
}

// On iOS 13+ DeviceOrientationEvent requires permission
if (typeof DeviceOrientationEvent !== 'undefined') {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+: request permission on first meaningful user gesture
    // We attach a one-shot listener to any tap on the card
    const requestTiltPermission = () => {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') enableTilt();
        })
        .catch(() => {/* permission denied or not supported */});
      document.removeEventListener('touchstart', requestTiltPermission);
    };
    document.addEventListener('touchstart', requestTiltPermission, { passive: true, once: true });
  } else {
    // Non-iOS: enable immediately (Android grants permission implicitly)
    enableTilt();
  }
}
