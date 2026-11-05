const langBtn = document.getElementById('langBtn');
const nav = document.getElementById('nav');
const menuBtn = document.getElementById('menuBtn');
const bookingForm = document.getElementById('bookingForm');
let currentLang = 'en';

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-en][data-hi]').forEach((el) => {
    el.innerHTML = el.dataset[lang];
  });
  if (langBtn) langBtn.textContent = lang === 'en' ? 'हिंदी' : 'English';
}

if (langBtn) {
  langBtn.addEventListener('click', () => setLanguage(currentLang === 'en' ? 'hi' : 'en'));
}

if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

if (bookingForm) {
  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;

    const form = new FormData(bookingForm);
    const message = [
      'Hello Makeway Trip, I would like to enquire about a booking.',
      `Name: ${form.get('name') || ''}`,
      `Phone: ${form.get('phone') || ''}`,
      `Property/Destination: ${form.get('property') || ''}`,
      `Check-in: ${form.get('date') || 'Not specified'}`,
      `Guests/Rooms: ${form.get('guests') || 'Not specified'}`,
      `Message: ${form.get('message') || 'Not specified'}`
    ].join('\n');

    const whatsappUrl = `https://wa.me/919255100104?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
}
