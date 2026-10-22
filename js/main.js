// =========================================================
// PORTFOLIO · alexbadev · interacciones
// =========================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
};

let lang = root.dataset.lang === 'en' ? 'en' : 'es';
const ui = () => window.I18N.ui[lang];

/* ---------- Idioma ----------
   El español está en el HTML: se guarda al cargar y el inglés
   sale de js/i18n.js. Cambia textos y atributos marcados. */
const original = { text: {}, attr: {} };

$$('[data-i18n]').forEach(el => {
  const key = el.dataset.i18n;
  if (!(key in original.text)) original.text[key] = el.innerHTML;
});
$$('[data-i18n-attr]').forEach(el => {
  el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, key] = pair.split(':');
    if (!(key in original.attr)) original.attr[key] = el.getAttribute(attr);
  });
});

function translate(key, fallback) {
  if (lang === 'en' && key in window.I18N.en) return window.I18N.en[key];
  return fallback;
}

function applyLang() {
  $$('[data-i18n]').forEach(el => {
    const html = translate(el.dataset.i18n, original.text[el.dataset.i18n]);
    if (el.innerHTML !== html) el.innerHTML = html;
  });
  $$('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, translate(key, original.attr[key]));
    });
  });

  root.lang = lang;
  root.dataset.lang = lang;
  document.title = ui().title;
  $('meta[name="description"]').setAttribute('content', ui().description);

  const langBtn = $('#lang-toggle');
  langBtn.textContent = ui().langText;
  langBtn.setAttribute('aria-label', ui().langLabel);
  langBtn.lang = lang === 'es' ? 'en' : 'es';

  updateThemeLabel();
  setMenu(false);
  renderEtc();
  drawDiagram();
  root.classList.add('i18n-ready');
}

$('#lang-toggle').addEventListener('click', () => {
  lang = lang === 'es' ? 'en' : 'es';
  store.set('lang', lang);
  applyLang();
});

/* ---------- Tema claro / oscuro ---------- */
const themeBtn = $('#theme-toggle');
const metaTheme = $('#meta-theme');

function updateThemeLabel() {
  const dark = root.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? ui().themeToLight : ui().themeToDark);
  metaTheme.setAttribute('content', dark ? '#000000' : '#ffffff');
}

themeBtn.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('theme', root.dataset.theme);
  updateThemeLabel();
});

/* ---------- Menú en móvil ---------- */
const navToggle = $('#nav-toggle');
const navMenu = $('#nav-menu');

function setMenu(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.textContent = open ? ui().menuClose : ui().menuOpen;
  navMenu.classList.toggle('is-open', open);
}

navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));
$$('.hdr__link').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

/* ---------- La cabecera toma el color del capítulo ----------
   Mira qué sección pasa por debajo de la cabecera y copia su tono;
   de paso marca el enlace de la sección activa. */
const hdr = $('#hdr');
const toned = $$('[data-tone]').filter(el => el !== hdr);
const navLinks = $$('.hdr__link');
let ticking = false;

function updateHeader() {
  ticking = false;
  const probe = hdr.offsetHeight;
  let current = toned[0];
  for (const el of toned) {
    if (el.getBoundingClientRect().top <= probe) current = el;
  }
  if (hdr.dataset.tone !== current.dataset.tone) hdr.dataset.tone = current.dataset.tone;

  const mid = window.innerHeight * 0.4;
  let activeId = null;
  for (const link of navLinks) {
    const section = $(link.getAttribute('href'));
    if (section && section.getBoundingClientRect().top <= mid) activeId = link.getAttribute('href');
  }
  navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === activeId));
}

function requestHeader() {
  if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
}
window.addEventListener('scroll', requestHeader, { passive: true });
window.addEventListener('resize', requestHeader);
updateHeader();

/* ---------- Diagrama del inicio ----------
   Une cada nota con un punto del borde del astrolabio. Se calcula
   con las posiciones reales, así encaja en cualquier pantalla.
   data-from: punto del objeto (fracción de su ancho y alto).
   data-side: lado de la nota al que llega la línea. */
const diagram = $('.diagram');
const diagramSvg = $('#diagram-lines');
const diagramObject = $('.object');
const SVG_NS = 'http://www.w3.org/2000/svg';
const wideDiagram = window.matchMedia('(min-width: 1181px)');

function drawDiagram() {
  diagramSvg.replaceChildren();
  $$('.node', diagram).forEach(n => n.remove());
  if (!wideDiagram.matches) return;

  const W = diagram.clientWidth;
  const H = diagram.clientHeight;
  diagramSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // offsetLeft/Top ignoran los translate: se compensan a mano
  const obj = {
    x: diagramObject.offsetLeft - diagramObject.offsetWidth / 2,
    y: diagramObject.offsetTop - diagramObject.offsetHeight / 2,
    w: diagramObject.offsetWidth,
    h: diagramObject.offsetHeight,
  };

  const addNode = (x, y, color) => {
    const node = document.createElement('span');
    node.className = color ? `node node--${color}` : 'node';
    node.setAttribute('aria-hidden', 'true');
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    diagram.append(node);
  };

  $$('.note[data-from]', diagram).forEach(note => {
    const [fx, fy] = note.dataset.from.split(',').map(Number);
    const left = note.dataset.side === 'left';
    const top = note.offsetTop - note.offsetHeight / 2;
    const start = { x: obj.x + obj.w * fx, y: obj.y + obj.h * fy };
    const end = { x: note.offsetLeft + (left ? 0 : note.offsetWidth), y: top + 17 };
    const elbow = { x: end.x + (left ? -28 : 28), y: end.y };

    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', `${start.x},${start.y} ${elbow.x},${elbow.y} ${end.x - (left ? 5 : -5)},${end.y}`);
    diagramSvg.append(line);
    addNode(start.x, start.y);
    addNode(end.x - (left ? 5 : -5), end.y, note.dataset.color);
  });
}

let diagramTimer;
window.addEventListener('resize', () => {
  clearTimeout(diagramTimer);
  diagramTimer = setTimeout(drawDiagram, 120);
});
if (document.fonts) document.fonts.ready.then(drawDiagram);

/* ---------- Reloj de Granada ---------- */
const clock = $('#clock');
const clockFormat = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
function tick() {
  const now = new Date();
  clock.textContent = clockFormat.format(now);
  clock.dateTime = now.toISOString();
}
tick();
setInterval(tick, 1000);

/* ---------- Entradas al hacer scroll ----------
   Una sola vez por elemento. Sin JavaScript todo se ve igual. */
$$('.bento, .links').forEach(group => {
  [...group.children].forEach((child, i) => child.style.setProperty('--i', i));
});

// Una foto cerrada con clip-path no cuenta como visible para el
// observador, así que se observa su contenedor.
const revealTargets = $$('[data-reveal], [data-stamp], .shutter');
if ('IntersectionObserver' in window && !reduceMotion) {
  const watched = new Map();
  revealTargets.forEach(el => {
    const probe = el.classList.contains('shutter') ? el.parentElement : el;
    if (!watched.has(probe)) watched.set(probe, []);
    watched.get(probe).push(el);
  });
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      watched.get(entry.target).forEach(el => el.classList.add('is-in'));
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '0px', threshold: 0 });
  watched.forEach((_, probe) => io.observe(probe));
} else {
  revealTargets.forEach(el => el.classList.add('is-in'));
}

/* ---------- MAAT ETC: demo de la calculadora ----------
   Ecuación CCD simplificada: S/N = S·t / √(S·t + B·t + R²).
   Valores ilustrativos, no los del instrumento real. */
const etc = {
  mag: $('#etc-mag'),
  time: $('#etc-t'),
  magOut: $('#etc-mag-out'),
  timeOut: $('#etc-t-out'),
  sn: $('#etc-sn'),
  verdict: $('#etc-verdict'),
  bar: $('#etc-bar'),
};
const ZERO_POINT = 20.3;   // magnitud que da 1 e⁻/s
const SKY = 4;             // fondo de cielo, e⁻/s
const READ_NOISE2 = 250;   // ruido de lectura² × píxeles

function exposureSeconds(slider) {
  const raw = Math.pow(10, (slider / 100) * Math.log10(3600));
  if (raw < 60) return Math.max(1, Math.round(raw));
  if (raw < 600) return Math.round(raw / 10) * 10;
  return Math.round(raw / 60) * 60;
}

function renderEtc() {
  const m = parseFloat(etc.mag.value);
  const t = exposureSeconds(parseFloat(etc.time.value));
  const signal = Math.pow(10, -0.4 * (m - ZERO_POINT)) * t;
  const sn = signal / Math.sqrt(signal + SKY * t + READ_NOISE2);
  const locale = lang === 'es' ? 'es-ES' : 'en-GB';

  etc.magOut.textContent = m.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  etc.timeOut.textContent = `${t.toLocaleString(locale)} s`;
  etc.sn.textContent = sn.toLocaleString(locale, { maximumFractionDigits: sn < 10 ? 1 : 0 });
  etc.verdict.textContent = sn < 3 ? ui().v1 : sn < 10 ? ui().v2 : ui().v3;
  etc.bar.style.width = `${Math.min(100, (Math.log10(sn + 1) / 3) * 100).toFixed(1)}%`;
}

etc.mag.addEventListener('input', renderEtc);
etc.time.addEventListener('input', renderEtc);

/* ---------- Copiar email ---------- */
const copyBtn = $('#copy-email');
const emailAddress = $('#email-link').getAttribute('href').replace('mailto:', '');

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailAddress);
    copyBtn.textContent = ui().copied;
  } catch (e) {
    copyBtn.textContent = ui().copyError;
  }
  setTimeout(() => (copyBtn.textContent = ui().copy), 1800);
});

/* ---------- Formulario de contacto ----------
   Envía el mensaje a la función serverless /api/contact (Resend). */
const form = $('#contact-form');
const status = $('#form-status');
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async e => {
  e.preventDefault();

  const fields = ['name', 'email', 'message'].map(id => form.elements[id]);
  let firstInvalid = null;

  fields.forEach(field => {
    const ok = field.checkValidity() && field.value.trim() !== '';
    field.closest('.field').classList.toggle('has-error', !ok);
    field.setAttribute('aria-invalid', String(!ok));
    if (!ok && !firstInvalid) firstInvalid = field;
  });

  if (firstInvalid) {
    status.textContent = ui().formError;
    status.className = 'form__status is-error';
    firstInvalid.focus();
    return;
  }

  const [name, email, message] = fields.map(f => f.value.trim());

  status.textContent = ui().formSending;
  status.className = 'form__status';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message, website: form.elements.website.value })
    });
    if (!res.ok) throw new Error(res.status);

    status.textContent = ui().formOk;
    form.reset();
  } catch (err) {
    status.textContent = ui().formSendError;
    status.className = 'form__status is-error';
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Año actual ---------- */
$$('.js-year').forEach(el => (el.textContent = new Date().getFullYear()));

/* ---------- Arranque ---------- */
applyLang();
