'use strict';

// ── vCard ─────────────────────────────────────────────────────

const VCARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Will DiBernardo',
  'N:DiBernardo;Will;;;',
  'ORG:Sit\u2014Still Landscape Architecture',
  'TEL;TYPE=CELL:+12014520547',
  'EMAIL;TYPE=INTERNET:will@sit-still.com',
  'URL:https://sit-still.com',
  'ADR;TYPE=WORK:;;Los Angeles;;CA;;US',
  'END:VCARD',
].join('\r\n');

// MECARD format — shorter than vCard, natively parsed by phone cameras.
// Scan popup shows the contact name instead of a URL.
// Note: uses plain hyphen (not em-dash) because qrcodejs chokes on multi-byte UTF-8.
// The phone's contact app will display the ORG as saved.
const MECARD = 'MECARD:N:DiBernardo,Will;ORG:Sit-Still Landscape Architecture;TEL:+12014520547;EMAIL:will@sit-still.com;URL:https://sit-still.com;ADR:Los Angeles, CA;;';

// ── Service worker ────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(function (err) { console.warn('SW:', err); });
  });
}

// ── Boot ──────────────────────────────────────────────────────
// Wait for the DOM to be fully parsed before touching anything.

document.addEventListener('DOMContentLoaded', function () {

  var body           = document.body;
  var card           = document.getElementById('card');
  var qrcodeEl       = document.getElementById('qrcode');
  var btnTheme       = document.getElementById('btnTheme');
  var themeLabel     = document.getElementById('themeLabel');
  var btnShare       = document.getElementById('btnShare');
  var installPrompt  = document.getElementById('installPrompt');
  var dismissPrompt  = document.getElementById('dismissPrompt');
  var themeColorMeta = document.getElementById('theme-color-meta');

  // ── Theme ───────────────────────────────────────────────────

  function applyTheme(theme) {
    var dark = theme === 'dark';
    body.classList.toggle('dark',  dark);
    body.classList.toggle('light', !dark);
    if (themeColorMeta) themeColorMeta.setAttribute('content', dark ? '#111111' : '#ffffff');
    if (themeLabel)     themeLabel.textContent = dark ? 'light' : 'dark';
    if (btnTheme)       btnTheme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    buildQRCode();
  }

  function toggleTheme() {
    var next = body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('ss-theme', next);
    applyTheme(next);
  }

  var saved = localStorage.getItem('ss-theme');
  var initialTheme = (saved === 'dark' || saved === 'light') ? saved : 'light';
  applyTheme(initialTheme);

  if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

  // ── QR code ─────────────────────────────────────────────────

  function buildQRCode() {
    try {
      if (typeof QRCode === 'undefined') {
        setTimeout(buildQRCode, 100);
        return;
      }
      if (!qrcodeEl) return;

      var w = qrcodeEl.offsetWidth;
      if (!w || w < 10) {
        setTimeout(buildQRCode, 100);
        return;
      }

      qrcodeEl.innerHTML = '';

      var dark = body.classList.contains('dark');
      new QRCode(qrcodeEl, {
        text:         MECARD,
        width:        w,
        height:       w,
        colorDark:    dark ? '#f0f0f0' : '#111111',
        colorLight:   dark ? '#111111' : '#ffffff',
        correctLevel: QRCode.CorrectLevel.L,
      });
    } catch (err) {
      console.warn('QR build error:', err);
    }
  }

  // ── Share ───────────────────────────────────────────────────

  if (btnShare) {
    btnShare.addEventListener('click', function () {
      var blob = new Blob([VCARD], { type: 'text/vcard' });
      var file = new File([blob], 'will-dibernardo.vcf', { type: 'text/vcard' });

      if (navigator.share) {
        var canFile = navigator.canShare && navigator.canShare({ files: [file] });
        if (canFile) {
          navigator.share({ files: [file], title: 'Will DiBernardo' })
            .catch(function (err) { if (err.name !== 'AbortError') console.warn('Share failed:', err); });
        } else {
          navigator.share({
            title: 'Will DiBernardo — Sit-Still Landscape Architecture',
            text:  'will@sit-still.com · 201.452.0547',
            url:   'https://sit-still.com',
          }).catch(function (err) { if (err.name !== 'AbortError') console.warn('Share failed:', err); });
        }
      } else {
        var url = URL.createObjectURL(blob);
        var a   = document.createElement('a');
        a.href = url;
        a.download = 'will-dibernardo.vcf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }

  // ── Install prompt ──────────────────────────────────────────

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }

  window.addEventListener('load', function () {
    if (!isStandalone() && !sessionStorage.getItem('ss-prompt-dismissed')) {
      setTimeout(function () {
        if (installPrompt) installPrompt.classList.add('visible');
      }, 1400);
    }
  });

  if (dismissPrompt) {
    dismissPrompt.addEventListener('click', function () {
      if (installPrompt) installPrompt.classList.remove('visible');
      sessionStorage.setItem('ss-prompt-dismissed', '1');
    });
  }

  // ── Tilt parallax ──────────────────────────────────────────

  var TILT_MAX = 3;
  var tiltEnabled = false;

  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function handleOrientation(e) {
    var tx = clamp(((e.beta  || 0) - 90) / 30, -1, 1) * TILT_MAX;
    var ty = clamp( (e.gamma || 0)        / 30, -1, 1) * TILT_MAX;
    if (card) {
      card.style.setProperty('--tilt-x', (-tx).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', ty.toFixed(2) + 'deg');
    }
  }

  function enableTilt() {
    if (tiltEnabled) return;
    tiltEnabled = true;
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
  }

  if (typeof DeviceOrientationEvent !== 'undefined') {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.addEventListener('touchstart', function () {
        DeviceOrientationEvent.requestPermission()
          .then(function (s) { if (s === 'granted') enableTilt(); })
          .catch(function () {});
      }, { passive: true, once: true });
    } else {
      enableTilt();
    }
  }

});
