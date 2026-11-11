#!/usr/bin/env bash
# Tests unitaires : runner natif `node:test`, fichiers `src/**/__tests__/*.test.ts`.
# Node 22 exécute le TypeScript directement (suppression des types) : les modules
# testés doivent importer leurs voisins avec l'extension `.ts`, sans alias `@/`
# ni JSX. Usage : bash scripts/agent/test.sh [fichiers…]
set -euo pipefail

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  mapfile -t files < <(find src -path '*/__tests__/*' -name '*.test.ts' | sort)
fi
if [ "${#files[@]}" -eq 0 ]; then
  echo "Aucun test trouvé."
  exit 0
fi
exec node --test "${files[@]}"
