// Scrolls to sections without leaving "#section" in the address bar.
(function () {
  function clean() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function go(id, smooth) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    clean();
    return true;
  }

  // Links to a section of this same page: "#x" or "/path#x" when /path is this page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || a.target === '_blank') return;
    var url = new URL(a.getAttribute('href'), location.href);
    var here = url.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');
    if (!here || !url.hash || url.origin !== location.origin) return;
    if (go(decodeURIComponent(url.hash.slice(1)), true)) e.preventDefault();
  });

  // Arriving from another page with "#x" (e.g. from the simulator menu).
  if (location.hash) {
    var id = decodeURIComponent(location.hash.slice(1));
    window.addEventListener('load', function () { setTimeout(function () { go(id, false); }, 50); });
  }
})();
