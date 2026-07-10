# Modo "Digitar" com correção por IA — Design

## Contexto

Os flashcards atuais (`flashcards.html`) usam flip-card: você vê a pergunta, tenta lembrar, vira o card e se auto-avalia como "Sei"/"Não sei". Isso é bom para reconhecimento, mas fraco para produção ativa — o usuário relatou que decks tipo "type in the answer" (pergunta;resposta específica, ex.: `ECONOMIA PERGUNTAS E RESPOSTAS.csv`) são difíceis de acertar 100% porque a resposta esperada é uma string específica, e ele não tem como saber se o que escreveu captura a ideia sem comparação rígida.

O pedido: criar um modo de estudo que (1) primeiro mostra a resposta para treino de escrita, (2) depois testa sem gabarito, (3) usa uma IA para julgar a resposta digitada de forma flexível (por conceito, não por string exata), e (4) rastreia um % de domínio por deck para chegar a 90% de aproveitamento real.

## Fluxo por card

1. **Rodada 1 — treino:** mostra pergunta + gabarito lado a lado. Usuário digita tentando reproduzir a resposta. Ao enviar, a IA compara e devolve nota + feedback curto (o que faltou/divergiu). Esta nota **não** é persistida como métrica de domínio.
2. **Rodada 2 — teste:** mesma pergunta, sem gabarito visível. Usuário digita de memória. IA avalia e retorna nota 0–100. Esta nota **é** persistida por card (upsert, sobrescreve a anterior).
3. Avança para o próximo card do deck. Ordem: sequencial (mesma ordem do CSV), sem embaralhar nesta v1.
4. Ao fim do deck: tela de resumo com % médio (rodada 2) do deck e lista dos cards com nota <90, com botão "Revisar <90" que reinicia o fluxo apenas com esses cards (pulando direto para rodada 2, já que o usuário já viu o gabarito antes).

## Arquitetura

### Nova página: `digitar.html`
- Mesmo tema visual (`theme.css`, mesma nav, mesmo grid-bg) do resto do site.
- Seletor de deck: reusa a mesma lógica de `flashcards.html` — `manifest.json`, `SUBJECT_META`, `loadFileBrowser()`/`loadDeckFromPath()` adaptados (copiados para o novo arquivo, já que é tudo script inline sem módulos).
- Tela de opções do deck (antes de começar): mostra contagem total de cards, % médio atual (rodada 2) se houver histórico, contagem de cards ≥90 vs <90, e dois botões: "Estudar tudo" (todas as rodadas 1+2) e "Revisar <90" (se houver cards abaixo do threshold).
- Tela de estudo: campo de texto + botão enviar; mostra nota/feedback da IA antes de avançar; contador de progresso.
- Tela de resumo: igual ao padrão de `viewSummary` do flashcards.html, com % médio final e lista de cards fracos.

### Nova API: `api/grade-flashcard.js`
Segue o mesmo padrão de `api/tutor-correct.js` (usa `_lib/groq-client.js`, `response_format: json_object`).

- **Input:** `{ question, gabarito, resposta }`
- **Output:** `{ score: number (0-100), feedback: string }`
- **Temperatura:** ~0.2 (avaliação de conceito, não geração criativa — precisa ser mais consistente que o corretor de idiomas).
- **Critério do prompt:** considerar a resposta correta se captura a ideia central do gabarito, mesmo com palavras/estrutura diferentes. Não exigir decoreba de frase. Penalizar apenas omissão de conceito-chave ou erro factual, não paráfrase.
- Mesmo tratamento de erro/CORS/method guard que `tutor-correct.js`.

### Persistência: nova tabela `digitar_status`
Mesma forma de `card_status` (ver `supabase.js:266-294`):

```sql
create table digitar_status (
  user_id uuid not null references auth.users(id),
  deck_name text not null,
  question text not null,
  score int not null,
  last_review timestamptz not null default now(),
  primary key (user_id, deck_name, question)
);
alter table digitar_status enable row level security;
create policy "own rows" on digitar_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Novos métodos em `supabase.js` (ao lado da seção `// ── CARD STATUS ──`):
- `DB.getDigitarScoreMap(deckName)` → `{ question: {score, last_review} }`, espelha `getCardStatusMap`.
- `DB.upsertDigitarScore(deckName, question, score)` → upsert com `onConflict: 'user_id,deck_name,question'`, espelha `upsertCard`.

## Fora de escopo (v1)
- Não mexe no flip-card existente nem no `flashcards.html` — página nova e independente, sem substituir nada.
- Sem embaralhar ordem dos cards.
- Sem histórico de tentativas anteriores (só a última nota por card).
- Sem mudança no formato dos CSVs — usa os arquivos `pergunta;resposta` como estão, em qualquer matéria (não só Economia).
- Sem link na nav principal nesta v1 — acesso via botão a partir de `flashcards.html` (tela de opções do deck) ou navegação direta; adicionar à nav é decisão de UX separada.

## Verificação
1. Rodar localmente (`vercel dev` ou equivalente já usado no projeto), abrir `digitar.html`, escolher o deck de Economia (`ECONOMIA PERGUNTAS E RESPOSTAS.csv`).
2. Completar rodada 1 + rodada 2 em pelo menos 3 cards, confirmar que a IA retorna nota e feedback coerentes (testar uma resposta claramente errada e uma claramente certa com palavras diferentes do gabarito).
3. Confirmar no Supabase (`digitar_status`) que a linha foi criada/atualizada com a nota da rodada 2.
4. Recarregar a tela de opções do deck e confirmar que o % médio e a contagem <90/≥90 refletem os dados salvos.
5. Testar "Revisar <90" com pelo menos um card abaixo do threshold.
