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

    try {
      const result = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiry)
      });

      if (!result.ok) {
        alert('Enquiry save nahi ho payi. Please WhatsApp se enquiry bhejein.');
      }
    } catch (error) {
      console.error('Enquiry save error:', error);
      alert('Database connection nahi ho paya. WhatsApp khul raha hai.');
    }

    const whatsappUrl =
      `https://wa.me/919255100104?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
}
