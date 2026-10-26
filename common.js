/* Shared by both pages: mobile menu and footer year */
(function () {
  document.addEventListener('click', function (e) {
    var m = e.target.closest('[data-menu-toggle]');
    if (m) {
      var nav = document.getElementById('site-nav');
      var open = nav.classList.toggle('open');
      m.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (e.target.closest('#site-nav a')) {
      var n = document.getElementById('site-nav');
      if (n) n.classList.remove('open');
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();