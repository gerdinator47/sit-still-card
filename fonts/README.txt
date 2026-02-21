FONT SETUP
──────────
Drop your custom font files into this /fonts/ directory,
then update the @font-face declarations in style.css.

STEP 1 — Add your font files here
  Accepted formats (preferred order):
    .woff2   ← smallest, best browser support
    .woff
    .otf
    .ttf

  Recommended filenames (or rename yours to match):
    YourFont-Regular.woff2   (or .woff / .otf / .ttf)
    YourFont-Light.woff2     (lighter weight for credentials & labels)

STEP 2 — Update style.css
  Find the two @font-face blocks near the top of style.css
  and update the src: url() paths to match your actual filenames.

  Example — if your files are named "Freight-Book.woff2" and "Freight-Light.woff2":

    @font-face {
      font-family: 'SitStillFont';
      src: url('fonts/Freight-Book.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'SitStillFont';
      src: url('fonts/Freight-Light.woff2') format('woff2');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }

STEP 3 — Update service-worker.js (optional but recommended for offline)
  In service-worker.js, uncomment and update the font file paths
  in the PRECACHE_ASSETS array so fonts are cached for offline use:

    './fonts/Freight-Book.woff2',
    './fonts/Freight-Light.woff2',

That's it. The rest of the app uses font-family: var(--font-card)
which already points to 'SitStillFont' with the correct weight mappings.
