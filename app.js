'use strict';

// ─── vCard ────────────────────────────────────────────────────────────────────

const VCARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Will DiBernardo',
  'N:DiBernardo;Will;;;',
  'ORG:Sit-Still Landscape Architecture',
  'TITLE:Founding Principal',
  'TEL;TYPE=CELL:+12014520547',
  'EMAIL;TYPE=INTERNET:will@sit-still.com',
  'URL:https://sit-still.com',
  'ADR;TYPE=WORK:;;Los Angeles;;CA;;US',
  'END:VCARD',
].join('\r\n');

// ─── Service worker ───────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ─── DOM ──────────────────────────────────────────────────────────────────────

const body          = document.body;
const card          = document.getElementById('card');
const qrcodeEl      = document.getElementById('qrcode');
const btnTheme      = document.getElementById('btnTheme');
const themeLabel    = document.getElementById('themeLabel');
const btnShare      = document.getElementById('btnShare');
const installPrompt = document.getElementById('installPrompt');
const dismissPrompt = document.getElementById('dismissPrompt');
const themeColorMeta = document.getElementById('theme-color-meta');

// ─── Theme ────────────────────────────────────────────────────────────────────

function getInitialTheme() {
  const saved = localStorage.getItem('ss-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  // Default: light (matches body class in HTML)
  return 'light';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  body.classList.toggle('dark',  isDark);
  body.classList.toggle('light', !isDark);

  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#0f0f0f' : '#ffffff');
  }
  if (themeLabel) {
    themeLabel.textContent = isDark ? 'light mode' : 'dark mode';
  }
  if (btnTheme) {
    btnTheme.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  buildQRCode();
}

function toggleTheme() {
  const next = body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('ss-theme', next);
  applyTheme(next);
}

applyTheme(getInitialTheme());
btnTheme.addEventListener('click', toggleTheme);

// ─── QR code ──────────────────────────────────────────────────────────────────

function buildQRCode() {
  if (typeof QRCode === 'undefined') {
    setTimeout(buildQRCode, 80);
    return;
  }

  qrcodeEl.innerHTML = '';

  const isDark = body.classList.contains('dark');

  new QRCode(qrcodeEl, {
    text:         VCARD,
    width:        512,
    height:       512,
    colorDark:    isDark ? '#f5f3ef' : '#0f0f0f',
    colorLight:   isDark ? '#0f0f0f' : '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildQRCode);
} else {
  buildQRCode();
}

// ─── Share ────────────────────────────────────────────────────────────────────

btnShare.addEventListener('click', async () => {
  const blob = new Blob([VCARD], { type: 'text/vcard' });
  const file = new File([blob], 'will-dibernardo.vcf', { type: 'text/vcard' });

  if (navigator.share) {
    try {
      const canFile = navigator.canShare && navigator.canShare({ files: [file] });
      if (canFile) {
        await navigator.share({ files: [file], title: 'Will DiBernardo' });
      } else {
        await navigator.share({
          title: 'Will DiBernardo — Sit-Still Landscape Architecture',
          text:  'will@sit-still.com · 201.452.0547',
          url:   'https://sit-still.com',
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Share failed:', err);
    }
  } else {
    // Fallback: download .vcf
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url, download: 'will-dibernardo.vcf'
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});

// ─── Install prompt ───────────────────────────────────────────────────────────

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

window.addEventListener('load', () => {
  if (!isStandalone() && !sessionStorage.getItem('ss-prompt-dismissed')) {
    setTimeout(() => installPrompt.classList.add('visible'), 1400);
  }
});

dismissPrompt.addEventListener('click', () => {
  installPrompt.classList.remove('visible');
  sessionStorage.setItem('ss-prompt-dismissed', '1');
});

// ─── Tilt parallax ───────────────────────────────────────────────────────────

const TILT_MAX = 3;
let tiltEnabled = false;

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

function handleOrientation(e) {
  const tx = clamp((( e.beta  ?? 0) - 90) / 30, -1, 1) * TILT_MAX;
  const ty = clamp(   e.gamma ?? 0         / 30, -1, 1) * TILT_MAX;
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
    document.addEventListener('touchstart', () => {
      DeviceOrientationEvent.requestPermission()
        .then(s => { if (s === 'granted') enableTilt(); })
        .catch(() => {});
    }, { passive: true, once: true });
  } else {
    enableTilt();
  }
}
