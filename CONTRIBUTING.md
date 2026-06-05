# Fluxo de Atualização Seguro

## Antes de editar
1. `git fetch origin`
2. `git pull origin main`

## Após editar
1. `git status` — revisar o que mudou
2. `git add <arquivo-específico>` — adicionar intencionalmente
3. `git commit -m "tipo: descrição"`
4. `git push origin main`

## Regras críticas
- Nunca usar `git reset --hard` sem backup
- Nunca usar `git push --force` na branch main
- Sempre fazer `git pull` antes de começar qualquer edição
- Pastas com nomes em MAIÚSCULAS devem ser mantidas sempre em MAIÚSCULAS
- SEMPRE trabalhar na branch `main` — nunca deixar a branch `add/...` como ativa
- Antes de commitar, verificar com `git branch` que está na `main`
