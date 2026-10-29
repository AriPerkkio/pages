/* eslint-disable */
// Loaded in <head> so the theme applies before first paint, unless the
// report's `theme` option fixes the theme, which leaves this script out.
// Standalone, a theme picked by the viewer applies. Embedded in a same-origin
// page, like Vitest UI, that page's color scheme applies instead, and the
// picker is hidden. Without either, base.css follows `prefers-color-scheme`.
const storageKey = "istanbul-html-report-theme";
const themes = ["light", "dark", "legacy"];
const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");

// A same-origin page embedding the report, like Vitest UI, owns the theme.
// Firefox passes its color-scheme on to the report as `prefers-color-scheme`,
// but Chromium and WebKit keep following the OS, so it's read from the page.
const embedder = findEmbedder();
if (embedder) {
  // hides the picker, see base.css
  root.dataset.themeEmbedded = "";
}

function findEmbedder() {
  // Reading a cross-origin parent fails, and WebKit logs an error for even
  // trying, so skip file:// pages and parents known to be cross-origin.
  const ancestor = location.ancestorOrigins?.[0];
  if (
    window.parent === window ||
    location.protocol === "file:" ||
    (ancestor && ancestor !== location.origin)
  ) {
    return null;
  }
  try {
    return window.frameElement ? window.parent.document.documentElement : null;
  } catch {
    // a cross-origin parent can't be read, so the OS preference applies
    return null;
  }
}

function embedderTheme() {
  if (!embedder) {
    return null;
  }
  const scheme = window.parent.getComputedStyle(embedder).colorScheme;
  const dark = /\bdark\b/.test(scheme);
  const light = /\blight\b/.test(scheme);
  // "normal" or "light dark" leave the choice to the OS preference
  return dark === light ? null : dark ? "dark" : "light";
}

// Firefox gives every file:// page its own localStorage, but shares cookies
// between them. Chromium shares localStorage but has no file:// cookies.
// So file:// pages keep the theme in both, preferring the cookie.
const useCookie = location.protocol === "file:";
const cookiePattern = new RegExp(`(?:^|; )${storageKey}=(\\w+)`);

function storedTheme() {
  let stored = useCookie ? document.cookie.match(cookiePattern)?.[1] : null;
  if (!stored) {
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      // storage may be unavailable
    }
  }
  return themes.includes(stored) ? stored : null;
}

function storeTheme(theme) {
  if (useCookie) {
    document.cookie = `${storageKey}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  }
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // the theme still applies to the current page
  }
}

// The theme the page shows, or is transitioning to. Tracked separately from
// `data-theme`, which a transition only updates asynchronously, so that a
// change reported twice (e.g. Firefox fires both the media query and the
// embedder's attribute change) starts one transition.
let shownTheme = root.dataset.theme ?? null;

// With `animate`, crossfades to the theme (see `::view-transition-*` in
// base.css) where View Transitions are supported, and switches otherwise.
function showTheme(theme, animate) {
  shownTheme = theme;
  const update = () => {
    if (theme) {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
  };
  if (animate && document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

// Applies the theme to the page and the picker. Re-run whenever the
// page is shown, as pages restored from the back/forward cache, or from
// another tab's change, would otherwise keep a stale theme. Only changes
// while the page is open animate, as page loads have nothing to fade from.
function sync(animate = false) {
  const theme = embedder ? embedderTheme() : storedTheme();
  if (theme !== shownTheme) {
    showTheme(theme, animate);
  }

  const select = document.getElementById("themeSelect");
  if (select) {
    select.value = theme || (media.matches ? "dark" : "light");
  }
}

const syncAnimated = () => sync(true);

sync();
document.addEventListener("DOMContentLoaded", () => {
  sync();
  document.getElementById("themeSelect").addEventListener("change", (event) => {
    storeTheme(event.target.value);
    showTheme(event.target.value, true);
  });
});
window.addEventListener("pageshow", () => sync());
window.addEventListener("storage", syncAnimated);
media.addEventListener("change", syncAnimated);
if (embedder) {
  // follows the embedding page's theme toggle, e.g. a class on its <html>
  new MutationObserver(syncAnimated).observe(embedder, { attributes: true });
}
