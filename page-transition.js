/* ───────────────────────────────────────────────
   Spirit Map · page transitions
   A shared crossfade so navigating between scenes
   dips through a deep cosmic ink and fades in.

   Mount: <script src="page-transition.js"></script> in <head>.
   Per-page veil color: <meta name="page-fade" content="#06080f">
   Programmatic nav:  window.pageTransitionTo(href [, inColor])
     - inColor: the color THIS page covers with AND the color the
       NEXT page fades in from — use it to hand off a matching tone
       (e.g. the landing's blue blooming straight into the map).
   Opt a link out: add data-no-transition to the <a>.
─────────────────────────────────────────────── */
(function () {
  var FADE_MS = 560;

  // page's own default veil color
  var DEFAULT_COLOR = '#06080f';
  var meta = document.querySelector('meta[name="page-fade"]');
  if (meta && meta.content) DEFAULT_COLOR = meta.content;

  // one-shot override: the color the PREVIOUS page asked us to fade in from
  var inColor = null;
  try {
    inColor = sessionStorage.getItem('__pfInColor');
    if (inColor) sessionStorage.removeItem('__pfInColor');
  } catch (_) {}

  var style = document.createElement('style');
  style.textContent =
    '#__pf{position:fixed;inset:0;z-index:2147483646;pointer-events:none;' +
    'background:' + DEFAULT_COLOR + ';opacity:1;transition:opacity ' + FADE_MS + 'ms ease;}' +
    '#__pf.clear{opacity:0;}';
  (document.head || document.documentElement).appendChild(style);

  var fade = document.createElement('div');
  fade.id = '__pf';
  if (inColor) fade.style.background = inColor;       // fade in from the handed-off tone
  (document.body || document.documentElement).appendChild(fade);

  function clearFade() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fade.classList.add('clear'); });
    });
  }

  function onReady() {
    if (document.body && fade.parentNode !== document.body) document.body.appendChild(fade);
    clearFade();
    // once the incoming fade is done, revert to this page's own veil color
    // so later outgoing transitions use the default ink, not the handoff tone
    if (inColor) {
      setTimeout(function () { fade.style.background = ''; }, FADE_MS + 120);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  // browser back/forward (bfcache): make sure the veil isn't left covering
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { fade.style.background = ''; fade.classList.add('clear'); }
  });

  function go(href, outColor) {
    var url;
    try { url = new URL(href, location.href); } catch (_) { location.href = href; return; }
    if (url.origin !== location.origin) { location.href = url.href; return; }
    if (outColor) {
      fade.style.background = outColor;
      try { sessionStorage.setItem('__pfInColor', outColor); } catch (_) {}
    }
    fade.classList.remove('clear');
    void fade.offsetWidth; // restart transition
    setTimeout(function () { location.href = url.href; }, FADE_MS - 30);
  }
  window.pageTransitionTo = go;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    var url;
    try { url = new URL(href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && (url.hash || url.search)) return;
    e.preventDefault();
    go(url.href);
  }, true);
})();
