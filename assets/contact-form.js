/* GEN-73 · formulario de contacto (portal-dkagora.html#contacto).
   Valida en el cliente que los campos obligatorios estén rellenos (todos
   menos Teléfono, marcado opcional) y, si está todo correcto, envía los
   datos al backend, endpoint POST /api/contacto — Linus/GR13, infraestructura
   y despliegue: Vint.

   Actualización 260728 (a petición de Alán): backend movido de Node/Express
   en Render a Cloudflare Pages Functions (ver functions/api/contacto.js),
   alojado en el mismo proyecto que esta web estática. Al ser mismo origen,
   CONTACT_ENDPOINT vuelve a la ruta relativa '/api/contacto' — ya no hace
   falta apuntar a http://localhost:3000 ni resolver CORS entre dominios.
   Para probar en local con este backend hace falta `wrangler pages dev`
   (CLI de Cloudflare), no `npm start` (eso era de la versión Express/Render,
   ahora histórica en backend/).

   Antispam (260724): se manda también el campo honeypot "empresa_web" (vacío
   para una persona real) y "ts_carga" (momento de carga de la página, en ms).
   El backend descarta en silencio cualquier envío con el honeypot relleno o
   demasiado rápido. Todavía sin límite de peticiones por IP (a propósito, a
   la espera de que se pida).

   Cloudflare Turnstile (260724): el widget (ver .cf-turnstile en el HTML)
   genera un campo "cf-turnstile-response" dentro del propio <form>, así que
   viaja solo con el resto de FormData, sin código adicional para recogerlo.
   Aquí solo comprobamos que no llegue vacío antes de enviar, y reseteamos el
   widget tras un envío correcto (los tokens de Turnstile son de un solo uso).
   La verificación real del token contra Cloudflare la hace el backend. */
(function () {
  var form = document.querySelector('.contact-form');
  if (!form) return;

  var CONTACT_ENDPOINT = '/api/contacto';

  // Antispam (GEN-73): momento en que se cargó la página, para que el backend
  // pueda descartar envíos "demasiado rápidos" para ser de una persona.
  // Se guarda en una variable, no solo en el input oculto, porque form.reset()
  // borraría el valor del input tras un envío correcto.
  var loadedAt = Date.now();

  var error = form.querySelector('.form-error');
  var success = form.querySelector('.form-success');
  var submitBtn = form.querySelector('button[type="submit"]');

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Enviando…' : 'Enviar mensaje';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (success) success.classList.remove('show');

    if (!form.checkValidity()) {
      if (error) error.classList.add('show');
      return;
    }

    var turnstileToken = form.querySelector('[name="cf-turnstile-response"]');
    if (!turnstileToken || !turnstileToken.value) {
      if (error) {
        error.textContent = 'Completa la verificación de seguridad antes de enviar.';
        error.classList.add('show');
      }
      return;
    }
    if (error) error.classList.remove('show');

    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    data.privacidad = form.querySelector('[name="privacidad"]').checked;
    data.ts_carga = String(loadedAt);

    setLoading(true);

    fetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        setLoading(false);
        if (result.ok && result.body.ok) {
          form.reset();
          if (window.turnstile) window.turnstile.reset(); // token de un solo uso
          if (success) success.classList.add('show');
        } else if (error) {
          if (window.turnstile) window.turnstile.reset(); // por si el token ya no era válido
          var mensaje = result.body && result.body.error === 'verificación de seguridad fallida, inténtalo de nuevo'
            ? 'No se pudo verificar que no eres un robot. Vuelve a intentarlo.'
            : 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.';
          error.textContent = mensaje;
          error.classList.add('show');
        }
      })
      .catch(function () {
        setLoading(false);
        if (window.turnstile) window.turnstile.reset();
        if (error) {
          error.textContent = 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.';
          error.classList.add('show');
        }
      });
  });

  // Oculta el aviso en cuanto el usuario empieza a corregir el formulario.
  form.addEventListener('input', function () {
    if (error) error.classList.remove('show');
  });
})();
