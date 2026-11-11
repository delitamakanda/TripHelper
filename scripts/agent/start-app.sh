#!/usr/bin/env bash
# Démarre l'app pour les agents, en arrière-plan : Vite en mode dev sur
# http://localhost:5173 (rechargé à chaque modification de code).
#
# TripHelper n'a pas de backend : les données vivent dans IndexedDB (Dexie). En
# mode dev, l'app affiche un itinéraire de démo (`initialItinerary` dans
# src/App.tsx). Firebase, les taux de change (exchangerate-api) et Google Maps
# sont des services externes : le navigateur de l'agent ne peut pas les joindre
# (MCP Playwright limité à localhost:5173), l'app reste utilisable sans eux.
#
# Attend que Vite réponde. Logs dans .agent-out/vite.log.
# Prérequis : npm ci
set -euo pipefail

out=.agent-out
mkdir -p "$out/playwright"

nohup npx vite --host localhost --port 5173 --strictPort > "$out/vite.log" 2>&1 < /dev/null &

if ! timeout "${START_TIMEOUT:-120}" bash -c \
  'until curl -sf http://localhost:5173/ >/dev/null; do sleep 2; done'; then
  echo "::error::l'app n'a pas démarré à temps"
  tail -n 50 "$out/vite.log"
  exit 1
fi
echo "App prête : http://localhost:5173"
