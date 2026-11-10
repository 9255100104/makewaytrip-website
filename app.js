// Load properties added from the Admin Dashboard
async function loadDynamicProperties() {
  const stayGrid = document.querySelector('.stay-grid');
  if (!stayGrid) return;

  try {
    const response = await fetch('/api/properties');
    if (!response.ok) throw new Error('Properties could not be loaded');

    const data = await response.json();
    const properties = data.properties || [];

    properties.forEach((property) => {
      const card = document.createElement('article');
      card.className = 'stay-card';

      const image = property.image_url
        ? `<img src="${escapePropertyText(property.image_url)}" alt="${escapePropertyText(property.name)}">`
        : '';

      card.innerHTML = `
        ${image}
        <div class="card-body">
          <span class="location">${escapePropertyText(property.location || '')}</span>
          <h3>${escapePropertyText(property.name)}</h3>
          <p>${escapePropertyText(property.description || '')}</p>
          <div class="card-bottom">
            <span class="price">${escapePropertyText(property.price || 'Ask for rates')}</span>
            <a href="#contact" class="text-link">Enquire →</a>
          </div>
        </div>
      `;

      stayGrid.prepend(card);
    });
  } catch (error) {
    console.error('Property loading error:', error);
  }
}

function escapePropertyText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

loadDynamicProperties();
const properties = data.properties || [];
    // Add database properties to booking form dropdown
    const propertySelect = document.querySelector('select[name="property"]');

    if (propertySelect) {
      properties.forEach((property) => {
        const label = property.location
          ? `${property.name} – ${property.location}`
          : property.name;

        const exists = Array.from(propertySelect.options).some(
          option => option.textContent.trim().toLowerCase() === label.toLowerCase()
        );

        if (!exists) {
          const option = document.createElement('option');
          option.value = label;
          option.textContent = label;
          propertySelect.insertBefore(option, propertySelect.lastElementChild);
        }
      });
    }
