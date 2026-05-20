"""
classificar_flashcards.py
Cruza flashcards do ESPIRAL com raízes do edital CACD 2026.
Uso: py classificar_flashcards.py
Requer: Python 3.8+ (stdlib apenas – sem pip)
"""

import json
import csv
import re
import unicodedata
from pathlib import Path
from collections import defaultdict

# ─── Caminhos ──────────────────────────────────────────────────────────────────
BASE     = Path(__file__).parent
ESPIRAL  = BASE / "ESPIRAL"
EDITAL_F = BASE / "deepseek_json_20260515_af1ebb.json"
OUT_CSV  = ESPIRAL / "flashcards_classificados.csv"
OUT_JSON = ESPIRAL / "raizes_flashcards.json"
OUT_MD   = ESPIRAL / "relatorio_cobertura.md"

# ─── Siglas por subject ────────────────────────────────────────────────────────
SUBJECT_MAP = {
    "HISTÓRIA DO BRASIL":     "HB",
    "HISTÓRIA MUNDIAL":       "HM",
    "POLÍTICA INTERNACIONAL": "PI",
    "GEOGRAFIA":              "GEO",
    "ECONOMIA":               "ECO",
    "DIREITO":                "DIP",
}

# Mapeamento arquivo → matéria (regex case-insensitive sobre o nome do arquivo)
FILE_RULES = [
    (r"historia.do.brasil|boris.fausto|hpeb|doratioto", "HB"),
    (r"saraiva|martin.gilbert|hobsbawn|hist.ria.mundial",  "HM"),
    (r"politica.internacional|lessa",                       "PI"),
    (r"portela|conceitos.dip|\bdip\b",                      "DIP"),
    (r"giambiagi|mankiw|\beco\b|economia",                  "ECO"),
    (r"geografia|\bgeo\b",                                  "GEO"),
]

STOPWORDS = {
    "de","da","do","des","das","dos","e","o","a","os","as","no","na","nos","nas",
    "em","para","com","por","se","que","um","uma","uns","umas","ao","aos","à","às",
    "ou","sua","seu","suas","seus","mais","como","mas","foi","não","também","ainda",
    "entre","sobre","após","ante","até","desde","sob","sobre","contra","perante",
    "mediante","segundo","este","esta","estes","estas","esse","essa","esses","essas",
    "aquele","aquela","ele","ela","eles","elas","nos","nós","seu","sua","lhe","lhes",
    "muito","pouco","todo","toda","todos","todas","cada","outro","outra","outros",
    "outras","mesmo","mesma","tudo","nada","quando","onde","como","porque","assim",
    "apenas","somente","além","através","dentro","durante","fora","junto","logo",
    "numa","num","dum","duma","nessa","nesse","nesta","neste","dela","dele",
}

# Termos extras por raiz_key (para compensar títulos muito curtos/genéricos)
EXTRA_KEYWORDS: dict[str, list[str]] = {
    "HB.1":    ["colonial","colonizacao","capitania","sesmaria","pau-brasil","tupinamba",
                "feitorias","amerindio","indigena","aldeamento"],
    "HB.2":    ["independencia","emancipacao","independente","dom joao","joao vi",
                "transferencia","corte","abertura","portos"],
    "HB.3":    ["primeiro reinado","pedro primeiro","constituicao","1824","abdicacao"],
    "HB.4":    ["regencia","ato adicional","liberais","conservadores","farroupilha",
                "balaiada","cabanagem","sabinada"],
    "HB.5":    ["segundo reinado","pedro segundo","cafe","escravidao","abolição",
                "abolicao","paraguai","imigração","imigracao","caxias"],
    "HB.6":    ["republica velha","primeira republica","oligarquia","coronelismo",
                "cafe com leite","tenentismo","canudos","contestado","juazeiro"],
    "HB.7":    ["vargas","estado novo","revolução 1930","trabalhismo","clt","sindicato",
                "petrobras","bndes","fascismo brasileiro","integralismo","queremismo"],
    "HB.8":    ["republica liberal","jk","juscelino","kubitschek","brasilia","jango",
                "goulart","populismo","desenvolvimentismo","reformas de base"],
    "HB.9":    ["regime militar","ditadura","golpe 1964","ai-5","milagre economico",
                "abertura","redemocratizacao","guerrilha","censura","tortura"],
    "HB.10":   ["democracia","constituicao 1988","diretas","tancredo","collor","impeachment",
                "lula","plano real","fhc","cardoso","dilma","bolsonaro"],
    "HM.1":    ["revolucao industrial","capitalismo","keynesianismo","neoliberalismo",
                "welfare","fordismo","taylorismo","industria","burguesia","liberalismo"],
    "HM.2":    ["revolucao francesa","revolucao americana","revolucao russa","marxismo",
                "anarquismo","socialismo","comunismo","bolchevique","cuba","mexico"],
    "HM.3":    ["guerra fria","bipolaridade","detente","otan","nato","urss","sovietica",
                "truman","stalin","mccarthismo","mccarthy","cortina de ferro",
                "corrida armamentista","deterrencia","contencao"],
    "HM.4":    ["colonialismo","imperialismo","africa","asia","partilha","berlin",
                "descolonizacao","bandung","nao alinhamento","terceiro mundo"],
    "HM.5":    ["americas","monroe","pan-americanismo","oea","eua","estados unidos",
                "america latina","intervencao","hegemonia","pan-americano"],
    "HM.6":    ["fascismo","nazismo","nazista","fascista","totalitarismo","ditadura",
                "mussolini","hitler","democracia","liberalismo","comunismo","ideologia"],
    "PI.1":    ["relacoes internacionais","paradigma","realismo","liberalismo",
                "construtivismo","institucionalismo","poder","seguranca","ator",
                "soft power","hard power","atores nao-estatais","interdependencia"],
    "PI.2":    ["politica externa brasileira","peb","itamaraty","diplomacia","barão",
                "barão do rio branco","autonomia","universalismo","chancelaria",
                "pragmatismo responsavel","politica exterior"],
    "PI.3":    ["america do sul","mercosul","unasul","iirsa","cosiplan","integracao",
                "cone sul","paraguai","argentina","uruguai","bolivia","venezuela"],
    "PI.13":   ["agenda internacional","onu","multilateralismo","desenvolvimento",
                "sustentavel","meio ambiente","direitos humanos","migracao","refugiado",
                "omc","comercio","financeiro","desarmamento","terrorismo","narcotráfico"],
    "PI.17":   ["brics","g-20","ibas","coalizao","emergentes","sul-sul","potencia",
                "china","india","russia","africa do sul","banco do brics"],
    "ECO.1":   ["microeconomia","demanda","oferta","elasticidade","monopolio",
                "oligopolio","concorrencia","mercado","preco","utilidade","consumidor",
                "produtor","equilibrio","externalidade","bem publico"],
    "ECO.2":   ["macroeconomia","pib","inflacao","deflacao","politica fiscal",
                "politica monetaria","is-lm","juros","cambio","desemprego",
                "recessao","crescimento","banco central","selic"],
    "ECO.3":   ["economia internacional","balanca","pagamentos","exportacao","importacao",
                "comercio exterior","fmi","bird","banco mundial","consenso washington",
                "globalizacao","cadeia global","cadeia produtiva"],
    "ECO.4":   ["historia economica","ciclo economico","isi","substituicao importacoes",
                "plano real","milagre economico","hiperinflacao","cruzado","sarney",
                "fhc","lula","metas inflacao","câmbio fixo"],
    "GEO.1":   ["historia geografia","ratzel","determinismo","possibilismo","vidal",
                "la blache","geografia moderna","pensamento geografico"],
    "GEO.2":   ["populacao","demografico","migracao","urbanizacao","transicao demografica",
                "idh","distribuicao espacial","crescimento populacional","fecundidade"],
    "GEO.3":   ["economia geografica","globalizacao","divisao trabalho","multinacional",
                "commodities","logistica","fordismo geografico","reordenamento"],
    "GEO.6":   ["geopolitica","fronteira","territorio","mackinder","heartland",
                "rimland","poder maritimo","espaco vital","lebensraum","ratzel"],
    "GEO.7":   ["meio ambiente","ambiental","biomas","recursos hidricos","amazonia",
                "cerrado","desertificacao","mudancas climaticas","cop","kyoto","paris"],
    "DIP.3":   ["constituicao","cf 1988","stf","controle constitucionalidade",
                "poder constituinte","clausulas petreas","direitos fundamentais"],
    "DIP.4":   ["estado","soberania","reconhecimento","forma governo","federalismo",
                "elementos estado","povo","territorio","governo","nacao"],
    "DIP.15":  ["direito internacional","fontes","jus cogens","soft law","tratado",
                "convencao","acordos","costume internacional","principios gerais"],
    "DIP.26":  ["mercosul","integracao regional","tratado assuncao","tarifa externa",
                "tec","parlasul","solucao controversias"],
    "DIP.27":  ["uso forca","seguranca coletiva","artigo 2","legitima defesa",
                "operacoes paz","terrorismo","desarmamento","nao proliferacao"],
    "DIP.28":  ["direitos humanos","dudh","cidh","comite","sistema interamericano",
                "tratados direitos","violacao","tribunal europeu"],
}


# ─── Normalização ──────────────────────────────────────────────────────────────
def _strip_accent(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize(text: str) -> list[str]:
    """Retorna lista de tokens normalizados (sem acentos, sem stopwords, ≥3 chars)."""
    text = _strip_accent(text.lower())
    tokens = re.findall(r"[a-z0-9]+", text)
    return [t for t in tokens if len(t) >= 3 and t not in STOPWORDS]


# ─── Carregamento do edital ────────────────────────────────────────────────────
def _detect_sigla(subject_name: str) -> str:
    name_up = subject_name.upper()
    for key, sigla in SUBJECT_MAP.items():
        if key in name_up:
            return sigla
    return "??"


def _flatten(topics: list, sigla: str, path: str, accum: list) -> None:
    for t in topics:
        key = f"{sigla}.{path}{t['id']}" if path else f"{sigla}.{t['id']}"
        title = t["title"].rstrip(".")
        # Título normalizado como keywords
        kws = set(normalize(title))
        # Adicionar extras se existirem
        for extra_key, extras in EXTRA_KEYWORDS.items():
            if key.startswith(extra_key):
                for e in extras:
                    kws.update(normalize(e))
        accum.append({
            "raiz_id":  len(accum) + 1,
            "raiz_key": key,
            "materia":  sigla,
            "titulo":   title,
            "keywords": list(kws),
        })
        children = t.get("children", [])
        if children:
            _flatten(children, sigla, "", accum)


def load_edital() -> list[dict]:
    with open(EDITAL_F, encoding="utf-8") as f:
        data = json.load(f)
    raizes: list[dict] = []
    for subj in data["edital"]["subjects"]:
        sigla = _detect_sigla(subj["name"])
        _flatten(subj["topics"], sigla, "", raizes)
        # Renumerar IDs em sequência global após cada subject
    # Reatribuir IDs sequenciais globais
    for i, r in enumerate(raizes, 1):
        r["raiz_id"] = i
    return raizes


# ─── Detecção de matéria por arquivo ──────────────────────────────────────────
def detect_subject(filename: str) -> str:
    name = filename.lower().replace(" ", ".").replace("_", ".")
    for pattern, sigla in FILE_RULES:
        if re.search(pattern, name):
            return sigla
    return "??"


# ─── Carregamento dos CSVs ────────────────────────────────────────────────────
def load_csv(path: Path) -> list[dict]:
    """Lê CSV do ESPIRAL. Formato: \t separado, coluna 1 = 'pergunta;resposta'."""
    cards: list[dict] = []
    subject = detect_subject(path.name)

    # Tentar encodings comuns
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = path.read_text(encoding=enc, errors="strict")
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        text = path.read_text(encoding="utf-8", errors="replace")

    reader = csv.reader(text.splitlines(), delimiter="\t", quotechar='"',
                        quoting=csv.QUOTE_MINIMAL)
    for row in reader:
        if not row:
            continue
        # A coluna de conteúdo pode ser a coluna 1 ou 0 se só houver 1 coluna
        content = row[1] if len(row) > 1 else row[0]
        content = content.strip()
        if not content:
            continue

        # Separar pergunta;resposta no primeiro ";"
        if ";" in content:
            idx = content.index(";")
            pergunta = content[:idx].strip().strip('"')
            resposta = content[idx+1:].strip().strip('"')
        else:
            pergunta = content
            resposta = ""

        if pergunta:
            cards.append({
                "arquivo":  path.name,
                "materia":  subject,
                "pergunta": pergunta,
                "resposta": resposta,
                "raizes_relacionadas": [],
            })

    return cards


# ─── Classificação ────────────────────────────────────────────────────────────
def score_card(card_tokens: set, raiz: dict) -> float:
    kw_set = set(raiz["keywords"])
    if not kw_set:
        return 0.0
    matches = card_tokens & kw_set
    return len(matches)


def classify_card(card: dict, raizes: list[dict], top_n: int = 5) -> list[str]:
    text = card["pergunta"] + " " + card["resposta"]
    card_tokens = set(normalize(text))
    if not card_tokens:
        return []

    scored: list[tuple[float, str]] = []
    for r in raizes:
        raw = score_card(card_tokens, r)
        if raw <= 0:
            continue
        # Raízes da mesma matéria recebem boost 1.5×
        boost = 1.5 if r["materia"] == card["materia"] else 1.0
        scored.append((raw * boost, r["raiz_key"]))

    # Ordenar por score desc, pegar top_n
    scored.sort(key=lambda x: -x[0])
    return [key for _, key in scored[:top_n]]


# ─── Saída CSV ─────────────────────────────────────────────────────────────────
def write_csv(cards: list[dict], path: Path) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["arquivo", "materia", "pergunta",
                                               "resposta", "raizes_relacionadas"])
        writer.writeheader()
        for c in cards:
            row = dict(c)
            row["raizes_relacionadas"] = json.dumps(c["raizes_relacionadas"],
                                                    ensure_ascii=False)
            writer.writerow(row)
    print(f"  -> CSV: {path}")


# ─── Saída JSON ────────────────────────────────────────────────────────────────
def write_json(cards: list[dict], raizes: list[dict], path: Path) -> None:
    index: dict[str, dict] = {}
    for r in raizes:
        index[r["raiz_key"]] = {
            "raiz_id":  r["raiz_id"],
            "materia":  r["materia"],
            "titulo":   r["titulo"],
            "flashcards": [],
        }

    for c in cards:
        for rk in c["raizes_relacionadas"]:
            if rk in index:
                index[rk]["flashcards"].append({
                    "pergunta": c["pergunta"],
                    "resposta": c["resposta"],
                    "arquivo":  c["arquivo"],
                    "materia":  c["materia"],
                })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"  -> JSON: {path}")


# ─── Relatório Markdown ────────────────────────────────────────────────────────
def write_report(cards: list[dict], raizes: list[dict], path: Path) -> None:
    total = len(cards)
    sem_raiz = [c for c in cards if not c["raizes_relacionadas"]]

    # Distribuição por matéria
    by_mat: dict[str, int] = defaultdict(int)
    for c in cards:
        by_mat[c["materia"]] += 1

    # Frequência de raízes
    raiz_freq: dict[str, int] = defaultdict(int)
    for c in cards:
        for rk in c["raizes_relacionadas"]:
            raiz_freq[rk] += 1

    top10 = sorted(raiz_freq.items(), key=lambda x: -x[1])[:10]

    # Mapa raiz_key → título
    raiz_title = {r["raiz_key"]: r["titulo"] for r in raizes}

    # Raízes sem nenhum flashcard
    cobertas = set(raiz_freq.keys())
    lacunas = [r for r in raizes if r["raiz_key"] not in cobertas]

    # Lacunas por matéria
    lacunas_mat: dict[str, list] = defaultdict(list)
    for r in lacunas:
        lacunas_mat[r["materia"]].append(r)

    lines = [
        "# Relatório de Cobertura — Flashcards CACD 2026",
        "",
        "## Estatísticas gerais",
        "",
        f"- **Total de flashcards processados:** {total:,}",
        f"- **Total de raízes no edital:** {len(raizes)}",
        f"- **Raízes com ao menos 1 flashcard:** {len(cobertas)} ({len(cobertas)/len(raizes)*100:.1f}%)",
        f"- **Raízes sem flashcard (lacunas):** {len(lacunas)} ({len(lacunas)/len(raizes)*100:.1f}%)",
        f"- **Flashcards sem raiz classificada:** {len(sem_raiz)} ({len(sem_raiz)/max(total,1)*100:.1f}%)",
        "",
        "## Distribuição por matéria",
        "",
        "| Matéria | Flashcards | % do total |",
        "|---------|------------|-----------|",
    ]
    for mat, cnt in sorted(by_mat.items(), key=lambda x: -x[1]):
        lines.append(f"| {mat} | {cnt:,} | {cnt/total*100:.1f}% |")

    lines += [
        "",
        "## Top 10 raízes mais cobertas",
        "",
        "| # | Raiz | Título | Cards |",
        "|---|------|--------|-------|",
    ]
    for i, (rk, cnt) in enumerate(top10, 1):
        title = raiz_title.get(rk, "—")
        lines.append(f"| {i} | `{rk}` | {title[:60]} | {cnt} |")

    lines += [
        "",
        "## Raízes sem flashcard por matéria",
        "",
        "> Estas são as lacunas — considere criar novos cards para cobri-las.",
        "",
    ]
    for mat in ["HB", "HM", "PI", "GEO", "ECO", "DIP"]:
        mat_lacunas = lacunas_mat.get(mat, [])
        if not mat_lacunas:
            continue
        lines.append(f"### {mat} — {len(mat_lacunas)} lacunas")
        lines.append("")
        for r in mat_lacunas:
            lines.append(f"- `{r['raiz_key']}` — {r['titulo'][:80]}")
        lines.append("")

    # Exemplo de estudo: raiz mais coberta
    if top10:
        ex_key, ex_cnt = top10[0]
        ex_cards = [c for c in cards if ex_key in c["raizes_relacionadas"]]
        lines += [
            "## Exemplo de estudo integrado",
            "",
            f"### Raiz `{ex_key}` — {raiz_title.get(ex_key, '?')}",
            "",
            f"Total de flashcards: **{ex_cnt}**",
            "",
            "| Matéria | Pergunta (preview) |",
            "|---------|-------------------|",
        ]
        for c in ex_cards[:8]:
            preview = c["pergunta"][:70].replace("|", "\\|")
            lines.append(f"| {c['materia']} | {preview}… |")
        lines.append("")

    lines += [
        "---",
        f"*Gerado automaticamente por `classificar_flashcards.py`*",
    ]

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  -> Relatorio: {path}")


# ─── Saída Cobertura JSON (para espiral.html) ──────────────────────────────────
def write_coverage(cards: list[dict], path: Path) -> None:
    """Gera {raiz_key: count} — contagem de flashcards por raiz."""
    freq: dict[str, int] = defaultdict(int)
    for c in cards:
        for rk in c["raizes_relacionadas"]:
            freq[rk] += 1
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dict(freq), f, ensure_ascii=False)
    print(f"  -> Coverage: {path}")


# ─── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print(">> Carregando edital...")
    raizes = load_edital()
    print(f"   {len(raizes)} raizes carregadas")

    csv_files = sorted(f for f in ESPIRAL.glob("*.csv")
                       if f.name not in ("flashcards_classificados.csv",))
    print(f"\n>> Processando {len(csv_files)} arquivos CSV...")

    all_cards: list[dict] = []
    for csv_path in csv_files:
        cards = load_csv(csv_path)
        mat = detect_subject(csv_path.name)
        for card in cards:
            card["raizes_relacionadas"] = classify_card(card, raizes)
        all_cards.extend(cards)
        covered = sum(1 for c in cards if c["raizes_relacionadas"])
        print(f"  [{mat}] {csv_path.name}: {len(cards)} cards, "
              f"{covered} classificados ({covered/max(len(cards),1)*100:.0f}%)")

    print(f"\n>> Total: {len(all_cards)} flashcards")
    print("\n>> Gravando saidas...")
    write_csv(all_cards, OUT_CSV)
    write_json(all_cards, raizes, OUT_JSON)
    write_report(all_cards, raizes, OUT_MD)
    write_coverage(all_cards, ESPIRAL / "raizes_coverage.json")

    sem_raiz = sum(1 for c in all_cards if not c["raizes_relacionadas"])
    print(f"\nOK! {len(all_cards)} cards, {sem_raiz} sem raiz "
          f"({sem_raiz/max(len(all_cards),1)*100:.1f}%)")
    print(f"   Saidas em: {ESPIRAL}")


if __name__ == "__main__":
    main()
