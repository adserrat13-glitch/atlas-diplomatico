/* Atlas Diplomático — Shared Sidebar
   Injects sidebar HTML into <aside id="sidebar">.
   Requires icons.js to be loaded first. */

(function () {

  /* ── Link definitions ──────────────────────────────────────── */
  const NAV = [
    {
      label: 'ESTUDO',
      links: [
        { href: '/index.html',              icon: 'home',     name: 'Início' },
        { href: '/revisao.html',            icon: 'review',   name: 'Revisão SRS' },
        { href: '/flashcards.html',         icon: 'cards',    name: 'Flashcards' },
        { href: '/simulados.html',          icon: 'sim',      name: 'Simulados' },
        { href: '/analise-tps-tematica.html', icon: 'chart',  name: 'Análise TPS' },
        { href: '/analise.html',            icon: 'chart',    name: 'Análise' },
        { href: '/GAMES/INGLES/MATCHING%20WORDS/index.html', icon: 'words', name: 'Vocab. ING' },
        { href: '/gramatica-matching.html', icon: 'grammar',  name: 'Gramática' },
      ]
    },
    {
      label: 'GAMES',
      links: [
        { href: '/GAMES/index.html',                            icon: 'games',    name: 'Games Hub' },
        { href: '/GAMES/DIP/index.html',                        icon: 'dip',      name: 'DIP' },
        { href: '/GAMES/ECONOMIA/index.html',                   icon: 'economy',  name: 'Economia' },
        { href: '/GAMES/TPS/index.html',                        icon: 'doc',      name: 'TPS' },
        { href: '/GAMES/HISTORIA DO BRASIL/index.html',         icon: 'history',  name: 'História do Brasil', submenu: [
          { href: '/GAMES/HISTORIA DO BRASIL/HISTORIA DO BRASIL IMPERIO/index.html', icon: 'history', name: 'HB Império', indent: true }
        ]},
        { href: '/GAMES/POLITICA INTERNACIONAL/index.html',     icon: 'globe',    name: 'Política Int.' },
        { href: '/GAMES/BRASIL/BANDEIRAS/index.html',           icon: 'flag',     name: 'Bandeiras' },
        { href: '/GAMES/BRASIL/COMERCIO/index.html',            icon: 'exchange', name: 'Comércio' },
        { href: '/GAMES/CACD BOLSO/index.html',               icon: 'pocket',   name: 'CACD Bolso' },
        { href: '/GAMES/PORTUGUES/index.html',                  icon: 'words',    name: 'Português' },
        { href: '/GAMES/GEOGRAFIA/index.html',                  icon: 'globe',    name: 'Geografia' },
        { href: '/GAMES/ESPANHOL/index.html',                   icon: 'flag',     name: 'Espanhol' },
        { href: '/GAMES/INGLES/index.html',                    icon: 'lang',     name: 'Inglês' },
        { href: '/cronologia.html',                             icon: 'chron',    name: 'Cronologia' },
        { href: '/linha-do-tempo.html',                         icon: 'timeline', name: 'Linha do Tempo' },
      ]
    },
    {
      label: 'COMUNIDADE',
      links: [
        { href: '/agenda.html',      icon: 'calendar', name: 'Agenda' },
      ]
    },
    {
      label: '2ª FASE',
      links: [
        { href: '/segunda-fase.html', icon: 'phase2', name: '2ª Fase' },
      ]
    },
  ];

  /* ── Detect active path ─────────────────────────────────────── */
  function isActive(href) {
    const p = location.pathname;
    // strip trailing slash for comparison
    const norm = p.endsWith('/') ? p + 'index.html' : p;
    return norm === href || norm.endsWith(href);
  }

  /* ── Build HTML ─────────────────────────────────────────────── */
  function icon(name) {
    return (typeof ICONS !== 'undefined' && ICONS[name])
      ? `<span class="sb-icon">${ICONS[name]}</span>`
      : `<span class="sb-icon"></span>`;
  }

  let html = `
    <div class="sb-header">
      <span class="sb-brand">ATLAS <span>DIPL.</span></span>
      <button class="sb-close" onclick="closeSidebar()">✕</button>
    </div>`;

  NAV.forEach(function (group) {
    html += `<div class="sb-group"><div class="sb-label">${group.label}</div>`;
    group.links.forEach(function (link) {
      const active = isActive(link.href) ? ' active' : '';
      const indent = (link.indent ? ' sb-link-indent' : '');
      html += `<a class="sb-link${active}${indent}" href="${link.href}">${icon(link.icon)}${link.name}</a>`;

      // Render submenu items if present
      if (link.submenu) {
        link.submenu.forEach(function (sublink) {
          const subactive = isActive(sublink.href) ? ' active' : '';
          const subindent = (sublink.indent ? ' sb-link-indent' : '');
          html += `<a class="sb-link${subactive}${subindent}" href="${sublink.href}">${icon(sublink.icon)}${sublink.name}</a>`;
        });
      }
    });
    html += `</div>`;
  });

  html += `
    <div class="sb-group" id="sbAdminGroup" style="display:none">
      <div class="sb-label">ADMIN</div>
      <a class="sb-link" href="/admin.html">${icon('settings')}Admin</a>
    </div>`;

  /* ── Inject into <aside> ─────────────────────────────────────── */
  const aside = document.getElementById('sidebar');
  if (aside) aside.innerHTML = html;

  /* ── Ensure overlay exists ───────────────────────────────────── */
  if (!document.getElementById('sidebar-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'sidebar-overlay';
    ov.onclick = function () { closeSidebar(); };
    document.body.appendChild(ov);
  }

  /* ── Open / Close ────────────────────────────────────────────── */
  window.openSidebar = function () {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (s) s.classList.add('open');
    if (o) o.classList.add('open');
  };
  window.closeSidebar = function () {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (s) s.classList.remove('open');
    if (o) o.classList.remove('open');
  };

  /* ── Show Admin if admin ─────────────────────────────────────── */
  function maybeShowAdmin() {
    if (typeof DB === 'undefined') return setTimeout(maybeShowAdmin, 300);
    DB.isAdmin && DB.isAdmin().then(function (yes) {
      if (yes) {
        const g = document.getElementById('sbAdminGroup');
        if (g) g.style.display = '';
      }
    }).catch(function () {});
  }
  maybeShowAdmin();

})();
