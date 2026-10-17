// Actualités (accueil : 3 dernières, page actualités : toutes) et formulaire de contact
function afficherPosts(box, posts) {
  box.innerHTML = '';
  if (!posts.length) { box.innerHTML = '<p class="vide">Aucune actualité pour le moment. Revenez bientôt.</p>'; return; }
  posts.forEach((p, i) => {
    const el = document.createElement('article'); el.className = 'post rv'; el.style.setProperty('--d', (i % 3) * .1 + 's');
    if (p.image) { const w = document.createElement('div'); w.className = 'img'; const im = new Image(); im.src = p.image; im.alt = ''; im.loading = 'lazy'; w.appendChild(im); el.appendChild(w); }
    const c = document.createElement('div'); c.className = 'corps';
    const h = document.createElement('h3'); h.textContent = p.titre;
    const t = document.createElement('time'); t.dateTime = p.date;
    t.textContent = new Date(p.date.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tx = document.createElement('p'); tx.textContent = p.contenu;
    c.append(h, t, tx);
    if (p.contenu.length > 160) {
      const b = document.createElement('button'); b.textContent = 'Lire la suite';
      b.onclick = () => { const o = el.classList.toggle('ouvert'); b.textContent = o ? 'Réduire' : 'Lire la suite'; };
      c.appendChild(b);
    }
    el.appendChild(c); box.appendChild(el);
  });
  observerReveal(box);
}
const boxPosts = document.getElementById('posts');
if (boxPosts) {
  boxPosts.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  const limite = +boxPosts.dataset.limite || 0;
  fetch('/api/posts').then(r => r.json()).then(p => afficherPosts(boxPosts, limite ? p.slice(0, limite) : p))
    .catch(() => { boxPosts.innerHTML = '<p class="vide">Impossible de charger les actualités. Vérifiez votre connexion.</p>'; });
}
const fc = document.getElementById('form-contact');
if (fc) fc.addEventListener('submit', async e => {
  e.preventDefault();
  const r = document.getElementById('retour'), b = fc.querySelector('button');
  b.disabled = true;
  try {
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: fc.nom.value, contact: fc.contact.value, message: fc.message.value }) });
    const d = await res.json();
    r.className = 'msg ' + (res.ok ? 'ok' : 'err');
    r.textContent = res.ok ? 'Message envoyé. Nous vous répondrons bientôt.' : d.erreur;
    if (res.ok) fc.reset();
  } catch { r.className = 'msg err'; r.textContent = 'Pas de connexion. Réessayez plus tard.'; }
  b.disabled = false;
});
