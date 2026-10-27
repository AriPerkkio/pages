/* eslint-disable */
// Loaded in <head> so a previously picked theme applies before first paint.
// Without a stored choice, the report's `theme` option applies, then the
// color scheme of a page embedding the report, and without those, base.css
// follows `prefers-color-scheme`.
const storageKey = "istanbul-html-report-theme";
const themes = ["light", "dark", "legacy"];
const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");

// the html report's `theme` option, used until the viewer picks a theme
const defaultTheme = themes.includes(root.dataset.defaultTheme) ? root.dataset.defaultTheme : null;

// A same-origin page embedding the report, like Vitest UI, stands in for the
// viewer's preference. Firefox passes its color-scheme on to the report as
// `prefers-color-scheme`, but Chromium and WebKit keep following the OS.
const embedder = findEmbedder();

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

// Applies the stored theme to the page and the picker. Re-run whenever the
// page is shown, as pages restored from the back/forward cache, or from
// another tab's change, would otherwise keep a stale theme.
function sync() {
  const theme = storedTheme() || defaultTheme || embedderTheme();
  if (theme) {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }

  const select = document.getElementById("themeSelect");
  if (select) {
    select.value = theme || (media.matches ? "dark" : "light");
  }
}

sync();
document.addEventListener("DOMContentLoaded", () => {
  sync();
  document.getElementById("themeSelect").addEventListener("change", (event) => {
    root.dataset.theme = event.target.value;
    storeTheme(event.target.value);
  });
});
window.addEventListener("pageshow", sync);
window.addEventListener("storage", sync);
media.addEventListener("change", sync);
if (embedder) {
  // follows the embedding page's theme toggle, e.g. a class on its <html>
  new MutationObserver(sync).observe(embedder, { attributes: true });
}
