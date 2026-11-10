// Website elements
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

  if (langBtn) {
    langBtn.textContent = lang === 'en' ? 'हिंदी' : 'English';
  }
}

if (langBtn) {
  langBtn.addEventListener('click', () => {
    setLanguage(currentLang === 'en' ? 'hi' : 'en');
  });
}

// Mobile menu
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

// Footer year
const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

// Booking form and WhatsApp
if (bookingForm) {
  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!bookingForm.reportValidity()) return;

    const form = new FormData(bookingForm);

    const enquiry = {
      name: form.get('name') || '',
      phone: form.get('phone') || '',
      property: form.get('property') || '',
      date: form.get('date') || '',
      guests: form.get('guests') || '',
      message: form.get('message') || ''
    };

    const message = [
      'Hello Makeway Trip, I would like to enquire about a booking.',
      `Name: ${enquiry.name}`,
      `Phone: ${enquiry.phone}`,
      `Property/Destination: ${enquiry.property}`,
      `Check-in: ${enquiry.date || 'Not specified'}`,
      `Guests/Rooms: ${enquiry.guests || 'Not specified'}`,
      `Message: ${enquiry.message || 'Not specified'}`
    ].join('\n');

    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const result = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(enquiry)
      });

      if (!result.ok) {
        alert('Enquiry save nahi ho payi. WhatsApp se enquiry bhejein.');
      }
    } catch (error) {
      console.error('Enquiry save error:', error);
      alert('Database connection nahi ho paya. WhatsApp se enquiry bhejein.');
    }

    const whatsappUrl =
      `https://wa.me/919255100104?text=${encodeURIComponent(message)}`;

    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
  });
}

// Load properties from Admin Dashboard
async function loadDynamicProperties() {
  const stayGrid = document.querySelector('.stay-grid');
  const propertySelect = document.querySelector('select[name="property"]');

  try {
    const response = await fetch('/api/properties');

    if (!response.ok) {
      throw new Error('Properties could not be loaded');
    }

    const data = await response.json();
    const properties = data.properties || [];

    console.log('Loaded properties:', properties);

    properties.forEach((property) => {

      // Booking dropdown
      if (propertySelect) {
        const label = property.location
          ? `${property.name} – ${property.location}`
          : property.name;

        const exists = Array.from(propertySelect.options).some(
          option =>
            option.textContent.trim().toLowerCase() ===
            label.trim().toLowerCase()
        );

        if (!exists) {
          const option = document.createElement('option');
          option.value = label;
          option.textContent = label;

          propertySelect.insertBefore(
            option,
            propertySelect.lastElementChild
          );
        }
      }

      // Property card
      if (stayGrid) {
        const card = document.createElement('article');
        card.className = 'stay-card';

        const image = property.image_url
          ? `<img class="property-main-image" src="${escapePropertyText(property.image_url)}" alt="${escapePropertyText(property.name)}">`
          : '';

        const propertyName = property.name.toLowerCase();

        let roomGallery = '';

        // Kothi Paradise photos
        if (propertyName.includes('kothi paradise')) {
          roomGallery = `
            <h4>Hotel Kothi Paradise – Room Gallery</h4>
            <div class="photo-gallery">
              <img src="ROOM%20PIC%20KHOTHI%201.jpeg" alt="Kothi Paradise room 1" loading="lazy">
              <img src="ROOM%20PIC%20KHOTHI%203.jpeg" alt="Kothi Paradise room 2" loading="lazy">
              <img src="ROOM%20PIC%20KHOTHI.jpeg" alt="Kothi Paradise room 3" loading="lazy">
              <img src="ROOM%20PIC%20KHOTI.jpeg" alt="Kothi Paradise room 4" loading="lazy">
            </div>
          `;
        }

        // Snow Range photos
        else if (propertyName.includes('snow range')) {
          roomGallery = `
            <h4>Hotel Snow Range – Photo Gallery</h4>
            <div class="photo-gallery">
              <img src="snow-range-view.jpeg" alt="Snow Range mountain view" loading="lazy">
              <img src="snow-range-room.jpeg" alt="Snow Range room" loading="lazy">
            </div>
          `;
        }

        card.innerHTML = `
          ${image}
          <div class="card-body">
            <span class="location">${escapePropertyText(property.location || '')}</span>
            <h3>${escapePropertyText(property.name)}</h3>
            <p>${escapePropertyText(property.description || '')}</p>
            <div class="card-bottom">
              <span class="price">${escapePropertyText((property.price || 'Ask for rates').replace(/^price\s*:\s*/i, '').trim())}</span>
              <a href="#contact" class="text-link">Enquire →</a>
            </div>
            ${roomGallery}
          </div>
        `;

        stayGrid.prepend(card);
      }
    });

  } catch (error) {
    console.error('Property loading error:', error);
  }
}

// Escape special characters
function escapePropertyText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Run property loader
loadDynamicProperties();
