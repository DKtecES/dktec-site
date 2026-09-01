# dktec.es — backend del formulario de contacto, en espera de proyecto propio

**Fecha:** 2026-08-28 · **Prepara:** Linus, a petición de Alán · **Activa:** Vint (infraestructura/despliegue)

## Qué es esto

Alán confirmó que **dktec.es va a ser un proyecto de Cloudflare Pages aparte**, no el
mismo repo/carpeta que dkagora.ai (que hoy es literalmente esta carpeta `07 Taller/GENESIS/`,
ya en producción como `www.dkagora.ai`).

Esta subcarpeta (`dktec-es-backend/`) contiene el código del backend del formulario de
contacto de dktec.es, ya escrito y listo, esperando a que exista ese proyecto nuevo. No se
ha metido directamente en `functions/` ni `_redirects` de la raíz de GENESIS porque esos
ficheros son los que usa el proyecto de dkagora.ai en producción ahora mismo — mezclarlos
habría hecho que Cloudflare desplegara este código como parte del sitio equivocado.

## Contenido

- `functions/api/contacto.js` — copia de `07 Taller/GENESIS/functions/api/contacto.js`
  (la función de dkagora.ai), con el asunto del correo cambiado de "dkagora.ai" a
  "dktec.es". Resto de la lógica idéntica: antispam (honeypot + control de tiempo),
  verificación de Cloudflare Turnstile, envío por Microsoft Graph.
- `_redirects` — una sola regla: la home de dktec.es es `portal-dktec.html`, no
  `index.html` (Cloudflare ya sirve el resto de páginas en su ruta limpia automáticamente,
  no hace falta nada más).

El frontend (`contacto.html`, `assets/contact-form.js`, y el resto de páginas de
dktec.es) ya vive en la raíz de esta misma carpeta GENESIS y no necesita cambios: llama a
`/api/contacto` en relativo, así que funciona igual en cualquier proyecto que lo sirva.

## Lo que falta para activarlo (fuera de mi alcance — no tengo acceso a Cloudflare ni Azure)

1. **Crear el proyecto de Cloudflare Pages de dktec.es.** Implica decidir también cómo se
   separa físicamente del repo actual de dkagora.ai (hoy todo vive en la misma carpeta
   `07 Taller/GENESIS/`) — repo propio, rama propia, o build que solo tome un subconjunto
   de ficheros. Esa decisión de estructura es de Vint/Alán, no la he tomado aquí.
2. **Copiar los dos ficheros de esta carpeta** (`functions/api/contacto.js` y
   `_redirects`) a la raíz de ese proyecto nuevo, quitando la carpeta `dktec-es-backend/`
   del camino.
3. **Configurar las variables de entorno** del proyecto nuevo (panel de Cloudflare Pages →
   Settings → Environment variables):
   - `CONTACT_TO_EMAIL` — buzón que recibe los avisos de contacto.
   - `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` — credenciales de la app
     de Microsoft Graph. Si se reutiliza la misma app que ya usa dkagora.ai, estos tres
     valores pueden copiarse tal cual; si dktec.es necesita su propia app registrada en
     Azure AD, hay que crearla antes.
   - `GRAPH_SENDER_USER` y `FROM_ALIAS` — buzón real y alias visible de envío.
   - `TURNSTILE_SECRET_KEY` — la Secret Key de Turnstile. **Importante:** tiene que ser la
     de una Site Key con dktec.es autorizado (ver punto 4) — no la Secret Key de la Site
     Key pública que hoy usa `contacto.html` (`0x4AAAAAAD_zCqG7x2_En59R`, es la de
     dkagora.ai y no tiene dktec.es autorizado — de ahí el error "No es posible conectarse
     al sitio web" que se ve hoy en la vista previa).
4. **Crear una Site Key de Turnstile propia para dktec.es** (Alán ya confirmó que no debe
   compartirse con la de dkagora.ai al ser proyectos separados) y actualizar el
   `data-sitekey` de `contacto.html` con la nueva clave pública — este último paso sí lo
   hago yo en cuanto exista la clave.
5. **DNS de dktec.es** apuntando al proyecto de Cloudflare Pages correspondiente.

## Qué NO he tocado

No he modificado `07 Taller/GENESIS/functions/api/contacto.js`, `_redirects` ni ningún
fichero del proyecto de dkagora.ai en producción. Este backend de dktec.es es
completamente aparte, tal y como pidió Alán.
