# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci
npm run dev                          # Vite on http://localhost:5173 (PWA service worker enabled in dev too)
npm run build                        # tsc -b && vite build (what CI runs)
npm run lint                         # ESLint 9 flat config — NOT clean on main, see below
bash scripts/agent/test.sh [files]   # unit tests: node:test on src/**/__tests__/*.test.ts
node scripts/agent/check-changed.mjs --fix   # then --check: tsc -b + ESLint on the lines you changed only
bash scripts/agent/start-app.sh      # Vite on localhost:5173 in the background, for the agents
```

`tsc -b` and the build are clean. ESLint is not: ≈20 errors on `main` (mostly `@typescript-eslint/no-explicit-any` in `src/App.tsx`). Do not fix unrelated code: `check-changed.mjs` only fails on ESLint errors in lines you added or changed. There is no Prettier config.

## Architecture

React 19 + Vite 7 + TypeScript (strict) PWA for planning a trip (built for a trip to Taiwan), mobile-first and offline-first, deployed on Cloudflare Pages (`triphelper.pages.dev`), also packaged as an Android TWA with Bubblewrap (`build:android`). Node 22.

- **Routing** (`src/main.tsx`, react-router 7): `/` → `App`, `/:permalink` → `Post` (Markdown pages from `src/_posts/*.md`, loaded with `import.meta.glob` + `gray-matter`, rendered with `react-remark`).
- **`src/App.tsx`** (~700 lines) holds most of the app: itinerary per day (activities, items to pack, budget), actual expenses per day, currency converter, export / import / reset, Firebase sync. In dev (`import.meta.env.DEV`) it starts with a 7-day demo itinerary. Prefer extracting new code into components / hooks rather than growing it.
- **Data**: Dexie (`src/db.ts`, database `TripHelperDB`) with tables `checklist` (items and activities, `type`) and `expenses`; days are ISO `YYYY-MM-DD` (`toIso` migrates older French formats). Schema changes = a new `this.version(n)` with an upgrade, never editing an existing version. Some preferences live in `localStorage` (`preferedCurrency`, `baseCurrency`, `theme`, `tripItinerary`).
- **Cloud sync**: `src/lib/firebase.ts` (anonymous auth + Firestore with persistent local cache); `App.tsx` pushes / pulls `users/<uid>/checklist|expenses` every 5 min, on focus and on demand.
- **External services** (keys in `VITE_*` env vars; the committed `.env` only has placeholders): exchangerate-api (rates, fetched in `App.tsx`), FastForex (cached by Workbox), Google Maps JS API + Geocoding (`RoutePlanner`, `src/services/googleRouting.ts`). The app must stay usable when they are unreachable.
- **UI**: Tailwind 4 (`@tailwindcss/vite`, theme in `src/styles/theme.css`), dark mode through the `dark-mode` class on `<body>` (`ToggleTheme`, `dark:` variant defined in `src/styles/global.css`), React Aria Components, Untitled UI icons, `cx()` (`src/utils/cx.ts`, tailwind-merge). Local notifications for the day plan (`use-dayplan-notifications`).
- **PWA**: `vite-plugin-pwa` config in `vite.config.ts` (manifest, Workbox runtime cache); install prompt in `PWAInstallPrompt`.

## Conventions

- Function components and hooks, TypeScript strict; no `any` in new code. Follow the style of the file you edit.
- Handle loading, empty, error and offline states; never a blank screen when a remote service fails.
- Keep export / import JSON and Firestore sync consistent with any data change.
- User-facing text is in French, like the rest of the UI. Pages stay usable at 390 px, in dark mode, and meet WCAG AA (labels, focus, contrast, `alt`, `aria-label` on icon / emoji buttons).
- Tests: native `node:test` + `node:assert/strict`, `*.test.ts` in a `__tests__/` folder next to the code (see `src/__tests__/db.test.ts`). Node 22 strips TypeScript types but does not read JSX, has no DOM and does not resolve the `@/` alias: test pure logic in `.ts` modules that import their neighbours with the `.ts` extension. Never call the network.
- No new dependency or API key without a ticket asking for it; `package.json` and `package-lock.json` change together.
- `.claude/agents/` has project subagents: `test-writer`, `ui-reviewer`, `dependency-keeper`.

## Agentic workflow

Issues are specs: a Claude agent (GitHub Actions) refines them, implements one ticket at a time against the running app (Vite dev server) and opens a PR for human review. See `docs/agentic-workflow.md`. Agents must never modify `.github/`.
