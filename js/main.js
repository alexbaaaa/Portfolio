// =========================================================
// PORTFOLIO · interacciones
// =========================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tema claro / oscuro ---------- */
const root = document.documentElement;
const themeToggle = $('#theme-toggle');

function currentTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

/* ---------- Navegación ---------- */
const nav = $('#nav');
const navToggle = $('#nav-toggle');
const navMenu = $('#nav-menu');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

function setMenu(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
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

/* ---------- Animación al hacer scroll ---------- */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.12 });

$$('.reveal').forEach((el, i) => {
  // Pequeño escalonado para los elementos del hero
  if (el.closest('.hero')) el.style.transitionDelay = `${i * 90}ms`;
  revealObserver.observe(el);
});

/* ---------- Palabra rotativa del hero ---------- */
const rotator = $('#rotator');
const words = ['rápidas', 'accesibles', 'responsive', 'útiles'];
let wordIndex = 0;

if (rotator && !reduceMotion) {
  setInterval(() => {
    rotator.classList.add('is-out');
    setTimeout(() => {
      wordIndex = (wordIndex + 1) % words.length;
      rotator.textContent = words[wordIndex];
      rotator.classList.remove('is-out');
    }, 350);
  }, 2600);
}

/* ---------- Copiar email ---------- */
const copyBtn = $('#copy-email');
const emailLink = $('#email-link');

copyBtn.addEventListener('click', async () => {
  const email = emailLink.getAttribute('href').replace('mailto:', '');
  try {
    await navigator.clipboard.writeText(email);
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
    status.className = 'form__status is-error';
    return;
  }

  const [name, email, message] = fields.map(f => f.value.trim());
  const to = emailLink.getAttribute('href').replace('mailto:', '');
  const subject = encodeURIComponent(`Contacto desde el portfolio · ${name}`);
  const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);

  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

  status.textContent = 'Abriendo tu cliente de correo…';
  status.className = 'form__status is-ok';
  form.reset();
});

/* ---------- Año del footer ---------- */
$('#year').textContent = new Date().getFullYear();
