/* GEN-73 · menú móvil (hamburguesa), compartido por todas las páginas del
   portal. Por debajo de 860px, .site-nav está oculto por CSS y no había
   ninguna forma de llegar a "Cómo funciona" / "Por qué dkagora" en móvil —
   este botón despliega esos enlaces como panel bajo el header. A partir de
   860px el CSS ya muestra los enlaces directamente y el botón se oculta solo
   (ver .nav-toggle en assets/styles.css), así que este script no hace nada
   en desktop. */
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function closeMenu() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Cierra el menú en cuanto se elige un enlace.
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Si la ventana se agranda por encima del punto de corte (860px), el CSS ya
  // muestra el menú en horizontal — nos aseguramos de no dejarlo "abierto" a
  // medias si luego se vuelve a estrechar la ventana.
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 860) closeMenu();
  });
})();
