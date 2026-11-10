// =====================================================================
// relogio.js — relógio flutuante, presente em todo o site
// Carregado automaticamente pelo supabase.js
// =====================================================================

(function () {
  const page = location.pathname.split('/').pop();
  if (page === 'login.html' || page === 'banned.html') return;
  if (document.getElementById('atlasClock')) return;

  try { localStorage.removeItem('atlas_cronometro'); } catch (e) {}

  const css = `
    #atlasClock { position: fixed; left: 16px; bottom: 16px; z-index: 9000;
      padding: 8px 14px;
      background: #12131a; color: #d4af37; border: 1px solid rgba(255,255,255,0.14);
      border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      font: 700 13px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-variant-numeric: tabular-nums; }
    @media print { #atlasClock { display: none; } }`;

  function mount() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const box = document.createElement('div');
    box.id = 'atlasClock';
    box.title = 'Hora atual';
    document.body.appendChild(box);

    function tick() {
      box.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
