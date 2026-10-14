// =========================================================
// PORTFOLIO · alexbadev · interacciones
// =========================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Pantalla de carga ----------
   Cuenta de 0 a 100 y se retira hacia arriba. Solo se muestra
   una vez por sesión para no repetirla en cada recarga. */
const loader = $('#loader');

function hideLoader() {
  loader.classList.add('is-leaving');
  setTimeout(() => loader.classList.add('is-done'), 800);
}

let seenLoader = false;
try { seenLoader = sessionStorage.getItem('loader-seen') === '1'; } catch (e) {}

if (reduceMotion || seenLoader) {
  loader.classList.add('is-done');
} else {
  const countEl = $('#loader-count');
  const barEl = $('#loader-bar');
  let count = 0;

  const timer = setInterval(() => {
    count = Math.min(100, count + Math.ceil(Math.random() * 7));
    countEl.textContent = String(count).padStart(3, '0');
    barEl.style.width = `${count}%`;

    if (count >= 100) {
      clearInterval(timer);
      try { sessionStorage.setItem('loader-seen', '1'); } catch (e) {}
      setTimeout(hideLoader, 300);
    }
  }, 45);
}

/* ---------- Cursor personalizado ---------- */
const cursor = $('#cursor');

if (finePointer && !reduceMotion) {
  const hoverTargets = 'a, button, .tech, input, textarea';

  document.addEventListener('mousemove', e => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
    cursor.classList.add('is-visible');
    cursor.classList.toggle('is-big', !!e.target.closest(hoverTargets));
  });
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
}

/* ---------- Navegación ---------- */
const navToggle = $('#nav-toggle');
const navMenu = $('#nav-menu');

function setMenu(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.textContent = open ? 'Cerrar' : 'Menú';
  navMenu.classList.toggle('is-open', open);
}

navToggle.addEventListener('click', () => {
  setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
});

// Cierra el menú al elegir un enlace o pulsar Escape
$$('.nav__link').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Marca el enlace de la sección visible
const navLinks = $$('.nav__link');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link =>
      link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`)
    );
  });
}, { rootMargin: '-45% 0px -50% 0px' });

$$('main section[id]').forEach(section => sectionObserver.observe(section));

/* ---------- Aparición al hacer scroll (lista del stack) ---------- */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.15 });

$$('.reveal').forEach(el => revealObserver.observe(el));

/* ---------- Proyectos: lista con vista previa ---------- */
const rows = $$('.project-row');
const preview = {
  img: $('#preview-img'),
  name: $('#preview-name'),
  desc: $('#preview-desc'),
  stack: $('#preview-stack'),
  repo: $('#preview-repo'),
};

function showProject(row) {
  if (row.classList.contains('is-active')) return;
  rows.forEach(r => r.classList.toggle('is-active', r === row));

  const { name, img, desc, stack, repo } = row.dataset;
  preview.img.classList.add('is-swapping');
  setTimeout(() => {
    preview.img.src = img;
    preview.img.alt = `Captura de ${name}`;
    preview.img.classList.remove('is-swapping');
  }, 150);
  preview.name.textContent = name;
  preview.desc.textContent = desc;
  preview.stack.textContent = stack;
  preview.repo.href = repo;
}

rows.forEach(row => {
  row.addEventListener('mouseenter', () => showProject(row));
  row.addEventListener('focus', () => showProject(row));
  row.addEventListener('click', () => showProject(row));
});

/* ---------- Copiar email ---------- */
const copyBtn = $('#copy-email');
const emailLink = $('#email-link');
const emailAddress = emailLink.getAttribute('href').replace('mailto:', '');

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailAddress);
    copyBtn.textContent = '¡Copiado!';
  } catch (e) {
    copyBtn.textContent = 'Error';
  }
  setTimeout(() => (copyBtn.textContent = 'Copiar'), 1800);
});

/* ---------- Formulario de contacto ----------
   Sin backend: abre el cliente de correo con el mensaje relleno.
   Si más adelante usas un servicio como Formspree, cambia el envío aquí. */
const form = $('#contact-form');
const status = $('#form-status');

form.addEventListener('submit', e => {
  e.preventDefault();

  const fields = ['name', 'email', 'message'].map(id => form.elements[id]);
  let valid = true;

  fields.forEach(field => {
    const ok = field.checkValidity() && field.value.trim() !== '';
    field.closest('.field').classList.toggle('has-error', !ok);
    if (!ok) valid = false;
  });

  if (!valid) {
    status.textContent = 'Revisa los campos marcados.';
    status.className = 'form__status mono is-error';
    return;
  }

  const [name, email, message] = fields.map(f => f.value.trim());
  const subject = encodeURIComponent(`Contacto desde el portfolio · ${name}`);
  const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);

  window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;

  status.textContent = 'Abriendo tu cliente de correo…';
  status.className = 'form__status mono is-ok';
  form.reset();
});

/* ---------- Año actual ---------- */
$$('.js-year').forEach(el => (el.textContent = new Date().getFullYear()));
