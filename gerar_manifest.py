"""
Gera manifest.json com a lista de todos os arquivos CSV disponíveis.
Execute este script sempre que adicionar ou remover decks/TPS.
  python gerar_manifest.py
"""
import os
import json

BASE = os.path.dirname(os.path.abspath(__file__))

manifest = {"flashcards": {}, "tps": []}

# FLASHCARDS
fc_root = os.path.join(BASE, "FLASHCARDS")
for folder in sorted(os.listdir(fc_root)):
    folder_path = os.path.join(fc_root, folder)
    if os.path.isdir(folder_path):
        files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith('.csv')])
        if files:
            manifest["flashcards"][folder] = files

# TPS (apenas root)
tps_dir = os.path.join(BASE, "TPS")
manifest["tps"] = sorted([f for f in os.listdir(tps_dir)
                           if f.lower().endswith('.csv')])

# TPS/CONECÇÕES
conexoes_dir = os.path.join(BASE, "TPS", "CONECÇÕES")
if os.path.isdir(conexoes_dir):
    manifest["tps_conexoes"] = sorted([f for f in os.listdir(conexoes_dir)
                                        if f.lower().endswith('.csv')])
else:
    manifest["tps_conexoes"] = []

# TPS/questões (por disciplina, em subpastas)
tq_dir = os.path.join(BASE, "TPS", "questões")
manifest["tps_questoes"] = {}
if os.path.isdir(tq_dir):
    for folder in sorted(os.listdir(tq_dir)):
        folder_path = os.path.join(tq_dir, folder)
        if os.path.isdir(folder_path):
            files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith('.csv')])
            if files:
                manifest["tps_questoes"][folder] = files

# Salva
out = os.path.join(BASE, "manifest.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

total_fc = sum(len(v) for v in manifest["flashcards"].values())
print("manifest.json gerado com sucesso!")
print(f"  {len(manifest['flashcards'])} pastas de flashcards")
print(f"  {total_fc} decks no total")
print(f"  {len(manifest['tps'])} arquivos TPS")
print(f"  {len(manifest.get('tps_conexoes', []))} arquivos TPS/CONECÇÕES")
total_tq = sum(len(v) for v in manifest["tps_questoes"].values())
print(f"  {len(manifest['tps_questoes'])} pastas / {total_tq} arquivos TPS/questões")
