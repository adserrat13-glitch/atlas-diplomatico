# Gramática — Design Spec
**Data:** 2026-06-25  
**Projeto:** Atlas Diplomático (CACD 2026)  
**Stack:** Vanilla HTML/JS, Vercel Functions, Supabase, Groq API

---

## Contexto

O Atlas Diplomático não possui um módulo dedicado ao estudo teórico de gramática. As páginas `/portugues.html`, `/ingles.html`, `/espanhol.html` existentes são focadas exclusivamente em prática de questões CESPE — não há teoria organizada, tópicos estruturados, nem acompanhamento de evolução por área gramatical. O candidato ao CACD precisa dominar gramática das três línguas (PT, EN, ES) em nível **C2 (proficiência plena)**, exigido pelo edital do IRBr. Isso implica domínio de nuances sutis, construções formais de alto registro, análise de ambiguidades e questões que exigem raciocínio gramatical avançado — não apenas reconhecimento de regras básicas.

---

## Objetivo

Criar `/gramatica.html` — um hub central de estudo gramatical — que ofereça:
- Teoria gerada por IA (Groq) para cada tópico
- Quiz de 5 questões com feedback imediato após cada teoria
- Dashboard de progresso quantificado (% acerto, XP, mapa de calor, streak)
- Cobertura das três línguas com tópicos mapeados ao edital CACD em nível C2
- Teoria e questões calibradas para alto registro formal, análise de ambiguidades e nuances diplomáticas

---

## Arquitetura

### Página principal: `/gramatica.html`

Layout de três colunas:
1. **Sidebar esquerda** — árvore de tópicos agrupados por categoria (colapsável por grupo)
2. **Área central** — conteúdo do tópico (teoria ou quiz)
3. **Painel direito** — métricas de progresso (colapsável em mobile)

Seletor de idioma (abas PT / EN / ES) no topo da sidebar. Ao mudar de idioma, a árvore de tópicos atualiza.

### Novo endpoint: `/api/gramatica-generate.js`

```
POST /api/gramatica-generate
Body: { idioma: 'pt'|'en'|'es', topico: string, modo: 'teoria'|'quiz' }

Resposta (teoria):
{ conteudo: string, exemplos: string[] }

Resposta (quiz):
{ questoes: [{ enunciado: string, opcoes: string[4], correta: number, explicacao: string }] }
```

Modelo: `llama-3.3-70b-versatile` (mesmo dos outros endpoints do projeto).

**Instrução de sistema para todos os prompts:**
> "You are a C2-level grammar expert for the Brazilian diplomatic exam (CACD/IRBr). All explanations must be at an advanced academic register. Theory must cover edge cases, formal exceptions, and nuances — not basic rules. Quiz questions must be challenging, targeting ambiguous cases, subtle distinctions, and constructions that appear in high-level literary, journalistic, and diplomatic texts. Avoid trivial or obvious questions."

### Tabela Supabase: `gramatica_progress`

```sql
user_id       uuid (FK profiles)
idioma        text  -- 'pt' | 'en' | 'es'
topico        text  -- slug do tópico (ex: 'acentuacao-grafica')
acertos       int
total         int
xp_gained     int
ultima_sessao timestamptz
```

Uma linha por `(user_id, idioma, topico)`. Atualizada com UPSERT a cada sessão concluída.

---

## Tópicos por Idioma

> **Nível de dificuldade: C2 (proficiência plena)** — toda teoria é escrita em registro formal elevado, com foco em casos excepcionais, construções literárias/diplomáticas e armadilhas frequentes em concursos de alto nível. Questões evitam o óbvio: exploram ambiguidades, casos-limite e interferências entre idiomas.

### Português — C2
| Categoria | Tópicos (ênfase C2) |
|-----------|---------|
| Classes Gramaticais | Classificações divergentes entre gramáticas normativas, pronomes relativos em contextos formais, verbos defectivos e abundantes, numerais em textos jurídico-diplomáticos |
| Morfologia | Processos de derivação e composição eruditos, flexão de palavras estrangeiras aportuguesadas, vozes verbais e suas nuances semânticas |
| Acentuação | Casos residuais pós-Acordo de 1990, palavras com dupla acentuação válida, impacto semântico do acento diferencial |
| Ortografia | Casos de hífen em compostos de alta complexidade, uso de maiúsculas em textos oficiais e diplomáticos, vocabulário de origem grega e latina |
| Sintaxe | Sujeito oculto em períodos longos, análise de orações reduzidas, aposto e vocativo em contextos formais, inversão sintática na prosa literária |
| Regência | Verbos de dupla regência e mudança semântica, regência em textos jornalísticos vs. literários, casos controversos (assistir, visar, aspirar, etc.) |
| Crase | Crase com pronomes demonstrativos, com expressões de tempo, casos de facultatividade e proibição em contextos limítrofes |
| Concordância | Concordância com sujeito composto posposto, com expressões partitivas, com pronome relativo "que" e "quem", zeugma e elipse |
| Colocação Pronominal | Ênclise obrigatória vs. próclise com advérbios, mesóclise em registro literário/formal, clíticos em perífrases verbais |
| Morfossintaxe | Análise sintática de períodos hipotáticos complexos, funções acumuladas, orações intercaladas, discurso indireto livre |
| Estilística Gramatical | Figuras de linguagem com impacto gramatical (elipse, zeugma, silepse), ambiguidade sintática intencional, coesão referencial em texto diplomático |

### Inglês — C2
| Categoria | Tópicos (ênfase C2) |
|-----------|---------|
| Advanced Grammar | Inversion (rarely/seldom/not only), cleft sentences (it-cleft, wh-cleft), fronting for emphasis |
| Verb Patterns | Verb + infinitive vs. gerund with change in meaning (remember, forget, stop, try, regret, mean) |
| Modal Perfects | Should/would/might/must/can't + have + past participle — deduction, criticism, regret |
| Aspect & Tense Nuance | Habitual past (used to / would), perfect aspect in formal writing, stative vs. dynamic verbs |
| Subjunctive & Conditionals | Formal subjunctive (It is essential that he be…), mixed conditionals, inverted conditionals (Had I known…) |
| Relative Clauses | Reduced relatives, non-defining vs. defining in formal prose, "whose" in complex antecedents |
| Reported Speech | Backshift exceptions, reporting verbs (allege, contend, assert) in diplomatic/legal register |
| Nominalisation | Converting verbal structures to noun phrases (formal written English style) |
| Discourse & Cohesion | Conjuncts, disjuncts, hedging language, formal connectives in academic/diplomatic writing |
| Punctuation (Advanced) | Parenthetical dashes, colons in lists vs. elaboration, British vs. American conventions |
| Lexical Grammar | Collocations with prepositions at C2 level, formal phrasal verbs (set forth, give rise to, bear upon) |

### Espanhol — C2
| Categoria | Tópicos (ênfase C2) |
|-----------|---------|
| Subjuntivo Avanzado | Subjuntivo en cláusulas relativas (busco a alguien que sepa…), correlación de tiempos, subjuntivo en oraciones concesivas |
| Condicionales Complejos | Condicional compuesto, estructuras mixtas, inversión con "de + infinitivo" y "de haber + participio" |
| Ser / Estar (nivel avanzado) | Cambios de significado con adjetivos, ser/estar con participios, diferencias regionales cultas |
| Discurso Indirecto | Correlación temporal compleja, verbos de reporte en registro formal (alegar, sostener, afirmar) |
| Oraciones de Relativo | Cuyo/cuya en prosa formal, relativas con preposición + artículo, relativas en textos jurídicos |
| Morfología Verbal Avanzada | Formas no personales en perífrasis complejas, voz pasiva refleja vs. perifrástica, verbos pronominales |
| Acento Diacrítico & Ortografía | Casos residuales pós-reforma RAE 2010, palabras con doble grafía válida, extranjerismos en textos diplomáticos |
| Registro Formal y Diplomático | Léxico jurídico-diplomático, construcciones impersonales de cortesía, uso de "usted" en documentos oficiales |
| Interferencias con Portugués | Falsos cognatos de alto nivel, calcos sintácticos, preposiciones divergentes (en/em, a/para) |
| Estilística | Períodos largos en prosa formal española, nominalización, estructuras pasivas en textos de organismos internacionales |

---

## Fluxo de Estudo

```
Usuário seleciona idioma → Categoria → Tópico
        ↓
Groq gera resumo teórico (~300 palavras + exemplos)
        ↓
Exibir teoria (modo leitura)
        ↓
Botão "Iniciar Quiz" → Groq gera 5 questões
        ↓
Questões exibidas uma por vez
Feedback imediato após cada resposta (certo/errado + explicação)
        ↓
Tela de resultado: score + resumo de erros
        ↓
UPSERT em gramatica_progress + XP calculado
        ↓
Mapa de calor e métricas atualizados
```

### Regras de XP
- 10 XP por questão certa
- 0 XP por questão errada
- Níveis: Iniciante 0–199, Básico 200–499, Intermediário 500–999, Avançado 1000–1999, Expert 2000+
- XP acumulado por idioma (não global)

### Mapa de Calor
- Verde: ≥75% de acerto no tópico
- Amarelo: 50–74%
- Vermelho: <50%
- Cinza: não estudado ainda

---

## Componentes de UI

| Componente | Descrição |
|------------|-----------|
| `TopicTree` | Sidebar com grupos colapsáveis de tópicos e indicador de status (cor) |
| `TheoryView` | Painel de conteúdo teórico gerado pelo Groq, com skeleton loader |
| `QuizView` | Cards de questão com 4 opções, feedback animado, barra de progresso 1/5 |
| `ResultView` | Score final, lista de erros com explicação, botões "Rever teoria" / "Próximo tópico" |
| `ProgressPanel` | % por tópico, XP + nível, mapa de calor, streak diário |

---

## Integração com Sistema Existente

- **Autenticação:** usa `supabase.js` (já importado nas outras páginas)
- **Tema:** usa `theme.css` + variáveis `--lp` (PT), `--ing` (EN), e nova `--esp: #4ade80` (ES)
- **Sidebar:** adiciona entrada em `_sidebar.js` no grupo IDIOMAS
- **Padrão de API:** segue o padrão dos endpoints Groq existentes (headers CORS, `process.env.GROQ_API_KEY`)

---

## Verificação / Testes

1. Abrir `/gramatica.html` sem login → deve redirecionar ou exibir prompt de login
2. Selecionar PT → Crase → clicar "Estudar Teoria" → verificar conteúdo gerado pelo Groq
3. Clicar "Iniciar Quiz" → 5 questões aparecem sequencialmente com feedback
4. Ao final → resultado salvo no Supabase (verificar tabela `gramatica_progress`)
5. Mapa de calor reflete % acerto do tópico estudado
6. Streak incrementa ao completar primeira sessão do dia
7. Trocar para EN → árvore de tópicos muda para inglês
8. XP aumenta corretamente após sessão (10 XP × acertos)
