/* ---------- Función serverless de Vercel: POST /api/contact ----------
   Recibe { name, email, message, website } y envía el mensaje con Resend.
   Variables de entorno (Vercel → Settings → Environment Variables):
     RESEND_API_KEY      clave de la API de Resend
     CONTACT_TO_EMAIL    correo donde quieres recibir los mensajes
     CONTACT_FROM_EMAIL  remitente (opcional; por defecto onboarding@resend.dev) */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = str =>
  str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();

  // Campo trampa: las personas no lo ven, los bots lo rellenan. Fingimos éxito.
  if (body.website) return res.status(200).json({ ok: true });

  if (!name || name.length > 100 || !EMAIL_RE.test(email) || email.length > 200 || !message || message.length > 5000) {
    return res.status(400).json({ error: 'validation' });
  }

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
    console.error('Faltan RESEND_API_KEY o CONTACT_TO_EMAIL');
    return res.status(500).json({ error: 'config' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `Portfolio <${CONTACT_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [CONTACT_TO_EMAIL],
      reply_to: email,
      subject: `Contacto desde el portfolio · ${name}`,
      text: `${message}\n\n— ${name} (${email})`,
      html: `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><hr><p>${escapeHtml(name)} · ${escapeHtml(email)}</p>`
    })
  });

  if (!response.ok) {
    console.error('Error de Resend:', response.status, await response.text());
    return res.status(502).json({ error: 'send' });
  }

  return res.status(200).json({ ok: true });
};
