// Load properties added from the Admin Dashboard
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

    properties.forEach((property) => {

      // Add property to booking form dropdown
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

      // Add property card to website
      if (stayGrid) {
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
      }
    });

  } catch (error) {
    console.error('Property loading error:', error);
  }
}

// Escape special characters for safe HTML output
function escapePropertyText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Run dynamic property loader
loadDynamicProperties();
