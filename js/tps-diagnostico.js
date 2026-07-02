const MATERIA_MAPEAMENTO = {
  'brasil': 'HB', 'história': 'HB', 'república': 'HB', 'império': 'HB', 'brasileira': 'HB', 'vargas': 'HB', 'ditadura': 'HB', 'getúlio': 'HB',
  'economia': 'ECO', 'economía': 'ECO', 'desenvolvimento': 'ECO', 'mercosul': 'ECO', 'comércio': 'ECO', 'exportação': 'ECO', 'tarifa': 'ECO', 'pib': 'ECO', 'inflação': 'ECO',
  'geografia': 'GEO', 'geográfico': 'GEO', 'territorial': 'GEO', 'região': 'GEO', 'fronteira': 'GEO', 'amazônia': 'GEO', 'clima': 'GEO', 'população': 'GEO',
  'direito': 'DIP', 'internacional': 'DIP', 'soberania': 'DIP', 'estado': 'DIP', 'convenção': 'DIP', 'tratado': 'DIP', 'onu': 'DIP', 'justiça internacional': 'DIP', 'tribunal': 'DIP',
  'política': 'PI', 'relações': 'PI', 'diplomacia': 'PI', 'diplomático': 'PI', 'acordo': 'PI', 'negociação': 'PI', 'conflito': 'PI', 'aliança': 'PI',
};

let EDITAL_TEMAS = {};

async function carregarEdital() {
  try {
    const materias = ['DIP', 'ECONOMIA', 'GEOGRAFIA', 'HISTORIA-DO-BRASIL', 'PI'];
    for (const materia of materias) {
      const response = await fetch(`/TPS/edital/${materia}.csv`);
      if (!response.ok) continue;
      const text = await response.text();
      const linhas = text.split('\n').slice(1);
      EDITAL_TEMAS[materia] = [];
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const partes = linha.split(';');
        if (partes.length >= 2) {
          EDITAL_TEMAS[materia].push({
            eixo: partes[0]?.trim() || '',
            topico: partes[1]?.trim() || '',
            descricao: partes[2]?.trim() || ''
          });
        }
      }
    }
  } catch(e) {
    console.error('Erro ao carregar edital:', e);
  }
}

function detectarMateria(questao) {
  const texto = questao.toLowerCase();
  let melhorScore = 0;
  let materiaDetectada = 'HB';
  for (const [palavra, materia] of Object.entries(MATERIA_MAPEAMENTO)) {
    const regex = new RegExp(`\\b${palavra}\\b`, 'gi');
    const matches = texto.match(regex);
    if (matches && matches.length > melhorScore) {
      melhorScore = matches.length;
      materiaDetectada = materia;
    }
  }
  return materiaDetectada;
}

function detectarTema(questao, materia) {
  if (!EDITAL_TEMAS[materia]) return 'Geral';
  const texto = questao.toLowerCase();
  let melhorScore = 0;
  let temaSelecionado = 'Geral';
  for (const tema of EDITAL_TEMAS[materia]) {
    const descricao = tema.descricao.toLowerCase();
    const palavras = descricao.split(' ');
    let score = 0;
    for (const palavra of palavras) {
      if (palavra.length > 3 && texto.includes(palavra)) {
        score++;
      }
    }
    if (score > melhorScore) {
      melhorScore = score;
      temaSelecionado = tema.topico;
    }
  }
  return temaSelecionado;
}

async function coletarDadosTPS() {
  const dadosPorMateria = {};
  const dadosPorTema = {};
  let totalQuestoes = 0;
  const porAno = {};

  try {
    const reviewDecks = JSON.parse(localStorage.getItem('tps_review_decks') || '[]');

    for (const deck of reviewDecks) {
      if (!deck.wrong_pairs || deck.wrong_pairs.length === 0) continue;

      const anoMatch = deck.file.match(/TPS (\d{4})/);
      const ano = anoMatch ? anoMatch[1] : 'Outro';

      if (!porAno[ano]) {
        porAno[ano] = { total: 0, acertos: 0 };
      }

      for (const wrongPair of deck.wrong_pairs) {
        totalQuestoes++;
        porAno[ano].total++;

        const materia = detectarMateria(wrongPair.pair[0] || '');
        const tema = detectarTema(wrongPair.pair[0] || '', materia);

        if (!dadosPorMateria[materia]) {
          dadosPorMateria[materia] = { total: 0, acertos: 0, erros: [] };
        }
        dadosPorMateria[materia].total++;
        dadosPorMateria[materia].erros.push(wrongPair.pair[0]);

        const chaveTeam = `${materia}-${tema}`;
        if (!dadosPorTema[chaveTeam]) {
          dadosPorTema[chaveTeam] = { materia, tema, total: 0, acertos: 0 };
        }
        dadosPorTema[chaveTeam].total++;
      }
    }
  } catch(e) {
    console.error('Erro ao coletar dados TPS:', e);
  }

  if (totalQuestoes === 0) {
    return {
      dadosPorMateria: {},
      dadosPorTema: {},
      porAno: {},
      totalQuestoes: 0,
      totalAcertos: 0,
      percentualGeral: 0,
      semDados: true
    };
  }

  return {
    dadosPorMateria,
    dadosPorTema,
    porAno,
    totalQuestoes,
    totalAcertos: 0,
    percentualGeral: totalQuestoes > 0 ? Math.round(((totalQuestoes - 0) / totalQuestoes) * 100) : 0
  };
}

function renderMateriasFracas(dados) {
  const container = document.getElementById('materias-fracas');
  const materias = Object.entries(dados.dadosPorMateria)
    .map(([mat, info]) => ({
      materia: mat,
      percentual: info.total > 0 ? Math.round((info.acertos / info.total) * 100) : 0,
      total: info.total,
      acertos: info.acertos
    }))
    .sort((a, b) => a.percentual - b.percentual);

  container.innerHTML = materias.map((m, i) => `
    <div class="weakness-item">
      <div class="weakness-rank">${i + 1}º lugar</div>
      <div class="weakness-name">${m.materia}</div>
      <div class="weakness-detail">
        ${m.acertos} / ${m.total} acertos (${m.percentual}%)
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${m.percentual}%"></div>
      </div>
    </div>
  `).join('');

  document.getElementById('materiasFracas').textContent = materias.filter(m => m.percentual < 85).length;
}

function renderTemasFracos(dados) {
  const container = document.getElementById('temas-fracos');
  const temas = Object.values(dados.dadosPorTema)
    .filter(t => t.total >= 2)
    .map(t => ({
      ...t,
      percentual: t.total > 0 ? Math.round((t.acertos / t.total) * 100) : 0
    }))
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 10);

  container.innerHTML = temas.map((t, i) => `
    <div class="weakness-item">
      <div class="weakness-rank">${i + 1}º</div>
      <div class="weakness-name">${t.tema}</div>
      <div class="weakness-detail">
        ${t.materia} • ${t.acertos}/${t.total} acertos (${t.percentual}%)
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${t.percentual}%"></div>
      </div>
    </div>
  `).join('');
}

function renderEvolucao(dados) {
  const container = document.getElementById('evolution-chart');
  const anos = Object.entries(dados.porAno)
    .sort(([a], [b]) => b - a)
    .map(([ano, info]) => ({ ano, ...info }));

  container.innerHTML = anos.map(a => `
    <div class="evolution-bar">
      <div class="evo-bar">
        <div class="evo-fill" style="height:${a.total > 0 ? 100 : 0}%"></div>
      </div>
      <div class="evo-num">${a.ano}</div>
      <div class="evo-num">${a.total} erros</div>
    </div>
  `).join('');
}

function renderRecomendacoes(dados) {
  const container = document.getElementById('recomendacoes');
  const pioresMatérias = Object.entries(dados.dadosPorMateria)
    .map(([mat, info]) => ({
      materia: mat,
      percentual: info.total > 0 ? Math.round((info.acertos / info.total) * 100) : 0
    }))
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 3);

  const recomendacoes = [
    {
      titulo: '🎯 Foco Prioritário',
      texto: `Concentre-se em ${pioresMatérias[0]?.materia || 'HB'}. Seu desempenho está abaixo de 85%.`
    },
    {
      titulo: '📚 Revisão em Cascata',
      texto: `Revise também ${pioresMatérias[1]?.materia || 'ECO'} e ${pioresMatérias[2]?.materia || 'GEO'} para equilibrar conhecimento.`
    },
    {
      titulo: '⏱️ Priorize Temas',
      texto: `Use a lista de temas fracos acima para estudar especificamente o que não está consolidado.`
    },
    {
      titulo: '🔄 Repita Provas Fracas',
      texto: `Faça novamente os TPS onde sua taxa de acerto foi menor que 60%.`
    }
  ];

  container.innerHTML = recomendacoes.map(rec => `
    <div class="rec-card">
      <div class="rec-icon">${rec.titulo.split(' ')[0]}</div>
      <div class="rec-title">${rec.titulo.split(' ').slice(1).join(' ')}</div>
      <div class="rec-text">${rec.texto}</div>
    </div>
  `).join('');
}

async function inicializarDiagnostico() {
  try {
    await carregarEdital();
    const dados = await coletarDadosTPS();

    document.getElementById('loading').style.display = 'none';

    if (dados.semDados) {
      document.getElementById('content').innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#9ca3af">
          <div style="font-size:48px;margin-bottom:20px">📋</div>
          <h2 style="color:#d4af37;margin-bottom:12px">Sem dados ainda</h2>
          <p>Responda as provas de TPS anteriores (2016-2026) para gerar análise.</p>
          <p style="margin-top:16px;font-size:11px">Os erros serão rastreados automaticamente e aqui você verá:</p>
          <ul style="text-align:left;display:inline-block;margin-top:16px;color:#9ca3af;font-size:11px">
            <li>Matérias com pior desempenho</li>
            <li>Temas mais fracos do edital</li>
            <li>Evolução ao longo das provas (2016-2026)</li>
            <li>Recomendações personalizadas</li>
          </ul>
        </div>
      `;
      return;
    }

    document.getElementById('totalRespostas').textContent = dados.totalQuestoes;
    document.getElementById('percentualGeral').textContent = `${dados.percentualGeral}%`;

    renderMateriasFracas(dados);
    renderTemasFracos(dados);
    renderEvolucao(dados);
    renderRecomendacoes(dados);

    document.getElementById('content').style.display = 'block';
  } catch(e) {
    console.error('Erro ao inicializar diagnóstico:', e);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = `Erro ao gerar diagnóstico: ${e.message}`;
  }
}
