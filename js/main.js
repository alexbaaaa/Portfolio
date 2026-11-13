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
  syncTitle();
  $('meta[name="description"]').setAttribute('content', ui().description);

  const langBtn = $('#lang-toggle');
  langBtn.textContent = ui().langText;
  langBtn.setAttribute('aria-label', ui().langLabel);
  langBtn.lang = lang === 'es' ? 'en' : 'es';

  updateThemeLabel();
  setMenu(false);
  renderMods();
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
const howIntro = $('.how__intro');
const howGate = $('.gate');
let ticking = false;

function updateHeader() {
  ticking = false;

  // Con una ficha de proyecto abierta el resto de la página no está: manda Proyectos
  if (root.classList.contains('is-case')) {
    const footer = toned[toned.length - 1];
    hdr.dataset.tone = footer.getBoundingClientRect().top <= hdr.offsetHeight ? footer.dataset.tone : 'plain';
    navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === '#proyectos'));
    return;
  }

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

  // Cómo trabajo: pasada la puerta de la ruta, la figura fija ya programa
  howIntro.classList.toggle('is-coding', howGate.getBoundingClientRect().top < window.innerHeight * 0.55);
}

function requestHeader() {
  if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
}
window.addEventListener('scroll', requestHeader, { passive: true });
window.addEventListener('resize', requestHeader);
updateHeader();

/* ---------- Sobre mí: imágenes flotantes ----------
   Solo se calcula --p: -1 cuando la sección asoma por abajo, 0 cuando está
   centrada y 1 cuando se va por arriba. Cada figura lo multiplica en el CSS
   por su propia velocidad y su giro. Sin movimiento, se quedan en reposo. */
const about = $('.about');
let floatTicking = false;

function updateFloats() {
  floatTicking = false;
  const rect = about.getBoundingClientRect();
  const vh = window.innerHeight;
  if (rect.bottom < 0 || rect.top > vh) return;
  const p = (vh / 2 - (rect.top + rect.height / 2)) / ((vh + rect.height) / 2);
  about.style.setProperty('--p', Math.max(-1, Math.min(1, p)).toFixed(4));
}

if (!reduceMotion) {
  const requestFloats = () => {
    if (!floatTicking) { floatTicking = true; requestAnimationFrame(updateFloats); }
  };
  window.addEventListener('scroll', requestFloats, { passive: true });
  window.addEventListener('resize', requestFloats);
  updateFloats();
}

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
const REVEAL = '[data-reveal], [data-stamp], .shutter';

function watchReveals(targets) {
  if (!('IntersectionObserver' in window) || reduceMotion) {
    targets.forEach(el => el.classList.add('is-in'));
    return null;
  }
  const watched = new Map();
  targets.forEach(el => {
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
  return io;
}

// Las fichas de proyecto se observan cada vez que se abren (más abajo)
watchReveals($$(REVEAL).filter(el => !el.closest('.sheet')));

/* ---------- Proyectos: ficha ampliada ----------
   Cada fila de la lista enlaza a #proyecto/<id>. Esa dirección abre la
   ficha en lugar del resto de la página, así que se puede compartir y el
   botón Atrás del navegador la cierra. El cambio lo tapa un telón del
   color del proyecto: sube desde abajo, se hace el cambio detrás y se va
   por arriba. Al cerrar hace el camino inverso. */
const sheet = $('#ficha');
const cases = $$('.case', sheet);
const curtain = $('#curtain');
const curtainNum = $('#curtain-num');
const curtainName = $('#curtain-name');
const viewer = $('#viewer');
const CASE_HASH = /^#proyecto\/([\w-]+)$/;
const CURTAIN_EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';

let openCase = null;      // ficha abierta
let listScroll = null;    // por dónde iba la página al abrirla
let caseObserver = null;
let revealTimer;
let routing = false;
let routeAgain = false;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const caseFromHash = () => {
  const match = CASE_HASH.exec(location.hash);
  return (match && cases.find(item => item.dataset.case === match[1])) || null;
};
const caseLink = item => $(`.prow__more[href="#proyecto/${item.dataset.case}"]`);

function syncTitle() {
  document.title = openCase ? `${openCase.dataset.name} · ${ui().title}` : ui().title;
}

// Si la página no está pintando (ventana tapada, pestaña en segundo plano) la
// animación no avanza: el temporizador evita que el cambio se quede a medias.
function slideCurtain(from, to, duration) {
  const animation = curtain.animate(
    [{ transform: `translateY(${from}%)` }, { transform: `translateY(${to}%)` }],
    { duration, easing: CURTAIN_EASE, fill: 'forwards' }
  );
  return Promise.race([animation.finished.catch(() => {}), wait(duration + 300)]);
}

function revealCase(item) {
  caseObserver = watchReveals($$(REVEAL, item));
}

// El cambio en sí: ocurre con el telón echado, o directamente si no hay movimiento
function swapView(target, delay) {
  const leaving = openCase;
  if (viewer.open) viewer.close();
  clearTimeout(revealTimer);
  if (caseObserver) caseObserver.disconnect();
  caseObserver = null;
  cases.forEach(item => {
    item.classList.remove('is-enter');
    item.classList.toggle('is-current', item === target);
    $$(REVEAL, item).forEach(el => el.classList.remove('is-in'));
  });
  root.classList.toggle('is-case', Boolean(target));
  openCase = target;

  if (target) {
    history.scrollRestoration = 'manual';
    target.style.setProperty('--wait', `${delay}ms`);
    void target.offsetWidth;
    target.classList.add('is-enter');
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('.case__name', target).focus({ preventScroll: true });
  } else {
    history.scrollRestoration = 'auto';
    const id = decodeURIComponent(location.hash.slice(1));
    const section = id && id !== 'proyectos' ? document.getElementById(id) : null;
    const work = $('#proyectos');
    const top = work.getBoundingClientRect().top + window.scrollY;
    // Se vuelve al punto exacto de la lista solo si la ficha se abrió desde ella
    const fromList = listScroll !== null && listScroll > top - window.innerHeight && listScroll < top + work.offsetHeight;
    if (section) {
      section.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else if (fromList) {
      window.scrollTo({ top: listScroll, behavior: 'instant' });
    } else {
      work.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    const link = !section && leaving && caseLink(leaving);
    if (link) link.focus({ preventScroll: true });
    drawDiagram();
    if (!reduceMotion) updateFloats();
  }

  syncTitle();
  setMenu(false);
  updateHeader();
}

async function route() {
  if (routing) { routeAgain = true; return; }
  routing = true;
  do {
    routeAgain = false;
    const target = caseFromHash();
    if (target === openCase) continue;
    if (target && !openCase) listScroll = window.scrollY;

    if (reduceMotion || document.hidden) {
      swapView(target, 0);
      if (target) revealCase(target);
      continue;
    }

    const closing = !target;
    const shown = target || openCase;
    curtain.dataset.color = shown.dataset.color;
    curtainNum.textContent = closing ? '' : `${shown.dataset.num} / ${String(cases.length).padStart(2, '0')}`;
    curtainName.textContent = closing ? $('.work .h2').textContent : shown.dataset.name;
    curtain.classList.add('is-on');

    await slideCurtain(closing ? -100 : 100, 0, 520);
    swapView(target, 360);
    await wait(140);
    if (target) revealTimer = setTimeout(() => revealCase(target), 340);
    await slideCurtain(0, closing ? 100 : -100, 640);
    curtain.classList.remove('is-on');
    curtain.getAnimations().forEach(animation => animation.cancel());
  } while (routeAgain);
  routing = false;
}

window.addEventListener('hashchange', route);

// Al ir a una ficha, el navegador no debe recolocar el scroll por su cuenta
document.addEventListener('click', e => {
  if (e.target.closest('a[href^="#proyecto/"]')) history.scrollRestoration = 'manual';
});

// Dentro de una ficha, "Volver arriba" sube al principio de la ficha
$('.footer__top').addEventListener('click', e => {
  if (!openCase) return;
  e.preventDefault();
  window.scrollTo({ top: 0 });
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !openCase || viewer.open || routing) return;
  if (navToggle.getAttribute('aria-expanded') === 'true') return;
  location.hash = '#proyectos';
});

// Una ficha enlazada directamente se abre sin telón
if (caseFromHash()) {
  swapView(caseFromHash(), 0);
  revealCase(openCase);
} else {
  root.classList.remove('is-case');
}

/* ---------- Visor de capturas ----------
   Cada captura de una ficha es un botón. El visor recorre las de esa
   ficha con los botones o con las flechas del teclado. */
const viewerImg = $('#viewer-img');
const viewerCap = $('#viewer-cap');
const viewerCount = $('#viewer-count');
let shots = [];
let shotIndex = 0;
let shotOpener = null;

function showShot(index) {
  shotIndex = (index + shots.length) % shots.length;
  const img = $('img', shots[shotIndex]);
  viewerImg.src = img.currentSrc || img.src;
  viewerImg.width = img.getAttribute('width');
  viewerImg.height = img.getAttribute('height');
  viewerImg.alt = img.alt;
  viewerCap.textContent = $('figcaption', shots[shotIndex].closest('figure')).textContent;
  viewerCount.textContent = `${String(shotIndex + 1).padStart(2, '0')} / ${String(shots.length).padStart(2, '0')}`;
  // Reinicia la animación de entrada de la imagen
  viewerImg.style.animation = 'none';
  void viewerImg.offsetWidth;
  viewerImg.style.animation = '';
}

sheet.addEventListener('click', e => {
  const shot = e.target.closest('.shot');
  if (!shot) return;
  shots = $$('.shot', shot.closest('.case'));
  shotOpener = shot;
  showShot(shots.indexOf(shot));
  viewer.showModal();
});
// Al cerrar, el foco vuelve a la captura desde la que se abrió
viewer.addEventListener('close', () => {
  if (shotOpener && shotOpener.isConnected && openCase) shotOpener.focus({ preventScroll: true });
  shotOpener = null;
});

$('#viewer-prev').addEventListener('click', () => showShot(shotIndex - 1));
$('#viewer-next').addEventListener('click', () => showShot(shotIndex + 1));
$('#viewer-close').addEventListener('click', () => viewer.close());
// Pulsar fuera de la imagen cierra el visor
viewer.addEventListener('click', e => {
  if (e.target === viewer || e.target.id === 'viewer-stage' || e.target.classList.contains('viewer__inner')) viewer.close();
});
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') showShot(shotIndex - 1);
  if (e.key === 'ArrowRight') showShot(shotIndex + 1);
});

/* ---------- Cómo trabajo: partes independientes ----------
   Se rompe una parte y las demás siguen en pie. Como mucho hay una
   rota; tocar la rota la arregla. Sin JavaScript queda la API rota. */
const mods = $$('.mod');
const modsStatus = $('#mods-status');

function renderMods() {
  const broken = mods.find(mod => mod.getAttribute('aria-pressed') === 'true');
  mods.forEach(mod => { $('.mod__state', mod).textContent = mod === broken ? 'Error' : 'OK'; });
  modsStatus.textContent = broken
    ? ui().modFail.replace('{x}', $('.mod__name', broken).textContent)
    : ui().modOk;
}

mods.forEach(mod => mod.addEventListener('click', () => {
  const wasBroken = mod.getAttribute('aria-pressed') === 'true';
  mods.forEach(other => other.setAttribute('aria-pressed', 'false'));
  if (!wasBroken) mod.setAttribute('aria-pressed', 'true');
  renderMods();
}));

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
