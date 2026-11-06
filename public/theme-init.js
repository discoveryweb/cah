/* Runs before the app and stylesheet paint; stays compatible with script-src 'self'. */
(function () {
  var theme;
  try { theme = localStorage.getItem('cahen-theme'); } catch (_) { /* storage can be denied */ }
  if (theme !== 'light' && theme !== 'dark') theme = 'light';
  document.documentElement.dataset.theme = theme;
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute('content', theme === 'dark' ? '#0a0a1e' : '#f8f7fc');
})();
