// =====================================================================
// relogio.js — relógio + cronômetro flutuantes, presentes em todo o site
// Carregado automaticamente pelo supabase.js
// O cronômetro guarda timestamps, então segue contando ao trocar de página
// =====================================================================

(function () {
  const KEY = 'atlas_cronometro';
  const page = location.pathname.split('/').pop();
  if (page === 'login.html' || page === 'banned.html') return;
  if (document.getElementById('atlasClock')) return;

  /* ── Estado ──────────────────────────────────────────────────── */
  let state = { startedAt: null, accumulated: 0, minimized: false };

  function load() {
    try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function elapsed() {
    return state.accumulated + (state.startedAt ? Date.now() - state.startedAt : 0);
  }
  function format(ms) {
    const s = Math.floor(ms / 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }

  /* ── Estilo ──────────────────────────────────────────────────── */
  const css = `
    #atlasClock { position: fixed; right: 16px; bottom: 16px; z-index: 9000;
      display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 14px;
      background: #12131a; color: #f0ece6; border: 1px solid rgba(255,255,255,0.14);
      border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      font: 500 13px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-variant-numeric: tabular-nums; }
    #atlasClock .ac-time { color: #d4af37; font-weight: 700; }
    #atlasClock .ac-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.14); }
    #atlasClock .ac-sw.running { color: #4ade80; }
    #atlasClock button { width: 28px; height: 28px; padding: 0; cursor: pointer;
      background: rgba(255,255,255,0.07); color: inherit; border: 0; border-radius: 7px;
      font: inherit; }
    #atlasClock button:hover { background: rgba(255,255,255,0.16); }
    #atlasClock button:focus-visible { outline: 2px solid #d4af37; outline-offset: 1px; }
    #atlasClock .ac-btns { display: flex; gap: 4px; }
    #atlasClock.min { gap: 8px; padding-left: 12px; }
    #atlasClock.min .ac-time, #atlasClock.min .ac-sep,
    #atlasClock.min .ac-toggle, #atlasClock.min .ac-reset { display: none; }
    @media print { #atlasClock { display: none; } }`;

  /* ── Montagem ────────────────────────────────────────────────── */
  function mount() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const box = document.createElement('div');
    box.id = 'atlasClock';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Relógio e cronômetro');
    box.innerHTML = `
      <span class="ac-time" title="Hora atual"></span>
      <span class="ac-sep"></span>
      <span class="ac-sw" title="Cronômetro"></span>
      <span class="ac-btns">
        <button type="button" class="ac-toggle"></button>
        <button type="button" class="ac-reset" title="Zerar cronômetro" aria-label="Zerar cronômetro">↺</button>
        <button type="button" class="ac-min"></button>
      </span>`;
    document.body.appendChild(box);

    const q = sel => box.querySelector(sel);
    const elTime = q('.ac-time'), elSw = q('.ac-sw');
    const btnToggle = q('.ac-toggle'), btnMin = q('.ac-min');

    function tick() {
      elTime.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      elSw.textContent = format(elapsed());
    }
    function render() {
      const running = !!state.startedAt;
      const toggleLabel = running ? 'Pausar cronômetro' : 'Iniciar cronômetro';
      const minLabel = state.minimized ? 'Expandir' : 'Minimizar';
      btnToggle.textContent = running ? '⏸' : '▶';
      btnToggle.title = toggleLabel;
      btnToggle.setAttribute('aria-label', toggleLabel);
      btnMin.textContent = state.minimized ? '▴' : '▾';
      btnMin.title = minLabel;
      btnMin.setAttribute('aria-label', minLabel);
      elSw.classList.toggle('running', running);
      box.classList.toggle('min', !!state.minimized);
      tick();
    }

    btnToggle.onclick = function () {
      if (state.startedAt) {
        state.accumulated += Date.now() - state.startedAt;
        state.startedAt = null;
      } else {
        state.startedAt = Date.now();
      }
      save(); render();
    };
    q('.ac-reset').onclick = function () {
      state.startedAt = null;
      state.accumulated = 0;
      save(); render();
    };
    btnMin.onclick = function () {
      state.minimized = !state.minimized;
      save(); render();
    };

    // Mantém abas abertas sincronizadas
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { load(); render(); }
    });

    render();
    setInterval(tick, 1000);
  }

  load();
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
