/*
 * GEN-72 · Backend del formulario de contacto de dktec.es (contacto.html)
 * Ejecuta: Linus (mandato GR13). Infraestructura/despliegue: decide Vint.
 *
 * 260828, a petición de Alán ("dktec.es es un proyecto aparte"): copia de
 * 07 Taller/GENESIS/functions/api/contacto.js (la de dkagora.ai) adaptada
 * para el proyecto de Cloudflare Pages PROPIO de dktec.es. No sustituye a la
 * de dkagora.ai ni vive en su misma carpeta `functions/` a propósito: esa
 * carpeta es la que usa el proyecto de Cloudflare Pages de dkagora.ai en
 * producción ahora mismo (mismo repo que esta carpeta GENESIS), y dktec.es
 * va a un proyecto de Cloudflare Pages distinto. Meter este fichero en esa
 * misma `functions/` habría hecho que Cloudflare lo desplegara también como
 * parte del sitio de dkagora.ai, cosa que no toca.
 *
 * ESTADO: en espera. Este fichero (y `_redirects` al lado, en
 * dktec-es-backend/) están preparados para cuando exista el proyecto de
 * Cloudflare Pages de dktec.es. Para activarlos:
 *   1. Vint crea el proyecto de Cloudflare Pages para dktec.es (repo propio
 *      o carpeta propia — a decidir con Alán cómo se separa del repo actual
 *      de dkagora.ai, que hoy comparte carpeta física con estos ficheros).
 *   2. Se copian `dktec-es-backend/functions/api/contacto.js` (este fichero,
 *      sin la carpeta "dktec-es-backend/") y `dktec-es-backend/_redirects`
 *      a la raíz de ese proyecto nuevo.
 *   3. Se configuran en el panel de ese proyecto (Settings → Environment
 *      variables) las mismas variables que usa la función de dkagora.ai:
 *      CONTACT_TO_EMAIL, GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
 *      GRAPH_CLIENT_SECRET, GRAPH_SENDER_USER, FROM_ALIAS,
 *      TURNSTILE_SECRET_KEY. Si se reutiliza la misma app de Microsoft Graph
 *      que ya usa dkagora.ai, los valores de GRAPH_* pueden ser los mismos;
 *      si se crea una Site Key de Turnstile propia para dktec.es (pendiente,
 *      ver contacto.html), TURNSTILE_SECRET_KEY es la nueva, no la de
 *      dkagora.ai.
 *   4. DNS de dktec.es apuntando a ese proyecto — fuera de mi alcance, lo
 *      hace quien administre el panel de Cloudflare.
 *
 * Resto de la lógica: idéntica a la versión de dkagora.ai (Graph API +
 * OAuth2, honeypot + control de tiempo, verificación de Turnstile). Único
 * cambio de contenido: el asunto del correo pasa de "dkagora.ai" a
 * "dktec.es" (línea `subject:` más abajo) para que quede claro de qué
 * formulario viene cada aviso cuando ambos lleguen al mismo buzón.
 */

const REQUIRED_FIELDS = ['nombre', 'empresa', 'email', 'empleados', 'dolor', 'privacidad'];
// 'telefono' queda fuera a propósito: es el único campo opcional del formulario.

function validar(body) {
  return REQUIRED_FIELDS.filter((campo) => {
    const valor = body[campo];
    if (campo === 'privacidad') return valor !== true && valor !== 'on' && valor !== 'true';
    return typeof valor !== 'string' || valor.trim() === '';
  });
}

const HONEYPOT_FIELD = 'empresa_web';
const MIN_MS_DESDE_CARGA = 2000; // por debajo de esto, se descarta como bot

function pareceBot(body) {
  if (body[HONEYPOT_FIELD]) return true; // el campo señuelo llegó relleno
  const cargado = Number(body.ts_carga);
  if (!cargado || Number.isNaN(cargado)) return true; // falta o no es un número
  const elapsed = Date.now() - cargado;
  if (elapsed < MIN_MS_DESDE_CARGA) return true; // envío demasiado rápido
  return false;
}

async function verificarTurnstile(token, secret, remoteip) {
  if (!secret) {
    console.error('Falta TURNSTILE_SECRET_KEY en las variables de entorno del proyecto.');
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.append('remoteip', remoteip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Error verificando Turnstile:', err);
    return false;
  }
}

// Caché del token de Graph en memoria del módulo: se reutiliza mientras la
// instancia de Cloudflare siga "caliente" entre peticiones; si no, se pide
// uno nuevo sin más (no afecta a la corrección, solo ahorra alguna llamada).
let cachedToken = null; // { token, expiresAt }

async function getGraphToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.token;
  }

  const { GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET } = env;
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw new Error('Faltan GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET en las variables de entorno.');
  }

  const res = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GRAPH_CLIENT_ID,
      client_secret: GRAPH_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`No se pudo obtener token de Graph: ${data.error_description || data.error || res.status}`);
  }

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function enviarPorGraph(body, env) {
  const { nombre, empresa, email, telefono, empleados, dolor } = body;
  const senderUser = env.GRAPH_SENDER_USER; // buzón real, p. ej. dkagora@dktec.es o francisco.delgado@dktec.es
  const fromAlias = env.FROM_ALIAS || senderUser; // alias visible, p. ej. dkagora@dktec.es
  const destino = env.CONTACT_TO_EMAIL;

  if (!senderUser) throw new Error('Falta GRAPH_SENDER_USER en las variables de entorno.');
  if (!destino) throw new Error('Falta CONTACT_TO_EMAIL en las variables de entorno.');

  const token = await getGraphToken(env);

  const cuerpo = [
    `Nombre: ${nombre}`,
    `Empresa: ${empresa}`,
    `Email: ${email}`,
    `Teléfono: ${telefono || '(no indicado)'}`,
    `Nº de empleados: ${empleados}`,
    '',
    '¿Qué le quita más tiempo hoy?',
    dolor,
  ].join('\n');

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUser)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: `Nuevo contacto dktec.es — ${empresa}`,
        body: { contentType: 'Text', content: cuerpo },
        toRecipients: [{ emailAddress: { address: destino } }],
        from: { emailAddress: { address: fromAlias } },
        replyTo: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: false,
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Graph sendMail falló (${res.status}): ${texto}`);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'petición inválida' }, { status: 400 });
  }

  if (pareceBot(body)) {
    // Se responde como si hubiera ido bien, para no darle pistas a quien
    // esté automatizando el envío, pero no se manda el correo de verdad.
    console.warn('Envío descartado por antispam (honeypot/tiempo):', {
      honeypot: body[HONEYPOT_FIELD] || null,
      ts_carga: body.ts_carga || null,
    });
    return Response.json({ ok: true });
  }

  const faltantes = validar(body);
  if (faltantes.length > 0) {
    return Response.json({ ok: false, error: 'completa todos los campos', faltantes }, { status: 400 });
  }

  const remoteip = request.headers.get('CF-Connecting-IP');
  const turnstileOk = await verificarTurnstile(body['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, remoteip);
  if (!turnstileOk) {
    console.warn('Envío rechazado: verificación de Turnstile fallida o ausente.');
    return Response.json({ ok: false, error: 'verificación de seguridad fallida, inténtalo de nuevo' }, { status: 403 });
  }

  try {
    await enviarPorGraph(body, env);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Error enviando el correo de contacto (Graph):', err);
    return Response.json({ ok: false, error: 'no se pudo enviar el mensaje' }, { status: 502 });
  }
}
// Nota: no hace falta definir onRequest para otros métodos — Cloudflare Pages
// Functions devuelve 405 automáticamente para cualquier método sin su propio
// onRequestX definido (aquí solo existe onRequestPost).
