/* Runs before the app and stylesheet paint; stays compatible with script-src 'self'. */
(function () {
  var theme;
  try { theme = localStorage.getItem('cahen-theme'); } catch (_) { /* storage can be denied */ }
  if (theme !== 'light' && theme !== 'dark') theme = 'light';
  document.documentElement.dataset.theme = theme;
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute('content', theme === 'dark' ? '#0a0a1e' : '#f8f7fc');
  /* A device tier, decided once here so CSS can drop its most expensive paint
     on a machine that cannot afford it. Same signals the renderers use. */
  try {
    var nav = navigator;
    var weak = (nav.hardwareConcurrency || 8) <= 4
      || (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 4)
      || Boolean(nav.connection && nav.connection.saveData);
    if (weak) document.documentElement.dataset.perf = 'low';
  } catch (_) { /* no navigator (tests, exotic hosts): keep the full experience */ }
})();
