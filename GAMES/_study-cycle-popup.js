(function() {
  const CYCLE = [
    { id:'HB',  name:'História do Brasil',     url:'/GAMES/HISTORIA DO BRASIL/index.html', icon:'🇧🇷' },
    { id:'HBI', name:'HB Império',             url:'/GAMES/HISTORIA DO BRASIL/HISTORIA DO BRASIL IMPERIO/index.html', icon:'🏛️' },
    { id:'PI',  name:'Política Internacional', url:'/GAMES/POLITICA INTERNACIONAL/index.html', icon:'🌐' },
    { id:'GEO', name:'Geografia',              url:'/GAMES/GEOGRAFIA/index.html', icon:'🗺️' },
    { id:'LP',  name:'Português',              url:'/GAMES/PORTUGUES/index.html', icon:'📝' },
    { id:'ING', name:'Inglês',                 url:'/GAMES/INGLES/index.html', icon:'🇬🇧' },
    { id:'DIP', name:'Dir. Internacional',     url:'/GAMES/DIP/index.html', icon:'⚖️' },
    { id:'ECO', name:'Economia',               url:'/GAMES/ECONOMIA/index.html', icon:'📊' },
    { id:'DIR', name:'Dir. Constitucional',    url:'/GAMES/CACD BOLSO/index.html', icon:'📋' },
    { id:'TP',  name:'TPS — Theses',           url:'/GAMES/TPS/index.html', icon:'📄' },
  ];

  function getNextSubject(currentId) {
    const idx = CYCLE.findIndex(s => s.id === currentId);
    return CYCLE[(idx + 1) % CYCLE.length];
  }

  function _injectPopupHTML() {
    if (document.getElementById('studyCyclePopup')) return;
    const div = document.createElement('div');
    div.id = 'studyCyclePopup';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);align-items:center;justify-content:center';
    div.innerHTML = '<div style="background:#171a21;border:1px solid #d4af37;border-radius:20px;padding:32px;max-width:480px;width:92%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)"><div style="font-size:11px;font-weight:800;color:#f59e0b;letter-spacing:.8px;margin-bottom:14px">🔄 CICLO DE ESTUDOS</div><div id="scpCurrentBadge" style="font-size:13px;color:#6b7280;margin-bottom:8px"></div><div id="scpNextIcon" style="font-size:48px;margin-bottom:8px"></div><div id="scpNextName" style="font-size:20px;font-weight:700;color:#d4af37;margin-bottom:8px"></div><div id="scpMsg" style="font-size:13px;color:#9ca3af;margin-bottom:24px"></div><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button id="scpGoBtn" style="background:#d4af37;color:#000;border:none;border-radius:10px;padding:11px 28px;font-weight:700;font-size:14px;cursor:pointer"></button><button onclick="closeStudyCyclePopup()" style="background:transparent;color:#9ca3af;border:1px solid #374151;border-radius:10px;padding:11px 28px;font-size:14px;cursor:pointer">Continuar aqui</button></div></div></div>';
    document.body.appendChild(div);
  }

  function _firePopup(currentId) {
    const today = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})).toISOString().split('T')[0];
    const dayKey = 'cycle_popup_' + today;
    const shown = parseInt(localStorage.getItem(dayKey) || '0');
    if (shown >= 3) return;
    localStorage.setItem(dayKey, shown + 1);
    const next = getNextSubject(currentId);
    const curr = CYCLE.find(s => s.id === currentId);
    _injectPopupHTML();
    document.getElementById('scpCurrentBadge').textContent = '✔ 400 pares de ' + (curr ? curr.name : currentId) + ' concluídos!';
    document.getElementById('scpNextIcon').textContent = next.icon;
    document.getElementById('scpNextName').textContent = next.name;
    document.getElementById('scpMsg').textContent = 'Próxima matéria no ciclo de estudos de hoje.';
    const btn = document.getElementById('scpGoBtn');
    btn.textContent = 'Ir para ' + next.name + ' →';
    btn.onclick = function() { window.location.href = next.url; };
    document.getElementById('studyCyclePopup').style.display = 'flex';
  }

  window.closeStudyCyclePopup = function() {
    const el = document.getElementById('studyCyclePopup');
    if (el) el.style.display = 'none';
  };

  window.checkStudyCyclePopup = function(subjectId, oldOffset, newOffset) {
    const newBlock = Math.floor(newOffset / 400);
    if (newBlock <= Math.floor(oldOffset / 400)) return;
    const blockKey = 'cycle_popup_block_' + subjectId;
    const lastBlock = parseInt(localStorage.getItem(blockKey) || '0');
    if (newBlock <= lastBlock) return;
    localStorage.setItem(blockKey, newBlock);
    _firePopup(subjectId);
  };

  window.initStudyCyclePopup = function(subjectId, currentOffset) {
    const blockKey = 'cycle_popup_block_' + subjectId;
    const lastBlock = parseInt(localStorage.getItem(blockKey) || '0');
    const currentBlock = Math.floor(currentOffset / 400);
    if (currentBlock > lastBlock) {
      localStorage.setItem(blockKey, currentBlock);
      setTimeout(function() { _firePopup(subjectId); }, 800);
    }
  };
})();
