const langBtn=document.getElementById('langBtn');
let currentLang='en';
function setLanguage(lang){
  currentLang=lang;
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-en][data-hi]').forEach(el=>{
    el.innerHTML=el.dataset[lang];
  });
  langBtn.textContent=lang==='en'?'हिंदी':'English';
}
langBtn.addEventListener('click',()=>setLanguage(currentLang==='en'?'hi':'en'));
document.getElementById('menuBtn').addEventListener('click',()=>document.getElementById('nav').classList.toggle('open'));
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>document.getElementById('nav').classList.remove('open')));
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('bookingForm').addEventListener('submit',e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const msg=[
    'Hello Makeway Trip, I would like to enquire about a booking.',
    'Name: '+(f.get('name')||''),
    'Phone: '+(f.get('phone')||''),
    'Property/Destination: '+(f.get('property')||''),
    'Check-in: '+(f.get('date')||'Not specified'),
    'Guests/Rooms: '+(f.get('guests')||'Not specified'),
    'Message: '+(f.get('message')||'')
  ].join('\n');
  window.open('https://wa.me/919255100104?text='+encodeURIComponent(msg),'_blank','noopener');
});
