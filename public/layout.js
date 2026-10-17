// En-tête, pied de page, animations, PWA : partagés par toutes les pages publiques
(function () {
  document.documentElement.classList.remove('no-js');
  const pages = [['/', 'Accueil'], ['/a-propos.html', 'À propos'], ['/domaines.html', 'Domaines'],
    ['/actualites.html', 'Actualités'], ['/contact.html', 'Contact']];
  const here = location.pathname === '/index.html' ? '/' : location.pathname;
  const links = pages.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ''}>${t}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
  <a class="skip" href="#contenu">Aller au contenu</a>
  <header class="top"><div class="wrap">
    <a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="36" height="36"><span>FAFHEVD</span></a>
    <button class="burger" aria-expanded="false" aria-controls="menu" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav id="menu" aria-label="Navigation principale">${links}</nav>
  </div></header>`);

  document.body.insertAdjacentHTML('beforeend', `
  <footer class="pied"><div class="wrap">
    <div class="fg">
      <div>
        <h3>FAFHEVD / Company</h3>
        <p>Ets Feu d'Alliance aux Femmes, Hommes, Enfants, Vieillards pour le Développement. Votre réussite reste notre préoccupation.</p>
        <button class="btn" id="installer" type="button">Installer l'application</button>
      </div>
      <div><h3>Navigation</h3>${links}<a href="/admin.html">Espace administrateur</a></div>
      <div><h3>Contact</h3>
        <a href="tel:+243838719901">+243 838 719 901</a>
        <a href="tel:+243815373164">+243 815 373 164</a>
        <a href="mailto:fafhevd2015@gmail.com">fafhevd2015@gmail.com</a>
        <span>Av. Kibombo n°15, Ibanda, Bukavu</span>
      </div>
    </div>
    <div class="legal">
      <span>© ${new Date().getFullYear()} FAFHEVD. Tous droits réservés.</span>
      <span>RCCM : CD/BKV/RCCM/24-A… · ID NAT : 22-C1302-N63823G · N° impôt : A2432701X</span>
    </div>
  </div></footer>`);

  const top = document.querySelector('.top'), btn = document.querySelector('.burger'), nav = document.getElementById('menu');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  btn.addEventListener('click', () => {
    const o = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!o)); nav.classList.toggle('open', !o);
  });
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  addEventListener('keydown', e => { if (e.key === 'Escape') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });

  // Apparition au défilement
  window.observerReveal = (root = document) => {
    const els = root.querySelectorAll('.rv:not(.vu)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('vu')); return; }
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('vu'); io.unobserve(x.target); } }), { threshold: .12 });
    els.forEach(e => io.observe(e));
  };
  observerReveal();

  // PWA
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  let evt; const inst = document.getElementById('installer');
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; inst.style.display = 'inline-flex'; });
  inst.addEventListener('click', async () => { if (!evt) return; evt.prompt(); await evt.userChoice; evt = null; inst.style.display = 'none'; });
})();
