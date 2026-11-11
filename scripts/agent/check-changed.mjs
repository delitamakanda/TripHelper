// Vérifications statiques limitées à ce que l'agent a modifié, par rapport à
// la branche de base. Le dépôt n'est pas encore propre (≈20 erreurs ESLint,
// surtout `no-explicit-any` dans src/App.tsx) : on ne bloque que sur les
// erreurs situées dans les lignes ajoutées ou modifiées (un fichier nouveau
// compte en entier), pour ne pas imposer à chaque ticket de réparer l'existant.
//
//   - ESLint (config du dépôt) : erreurs sur les lignes modifiées ;
//   - TypeScript (`tsc -b`) : le projet est propre, toute erreur bloque.
//
// scripts/agent/ et .github/ sont ignorés. Pas de Prettier dans ce dépôt.
//
// Usage : node scripts/agent/check-changed.mjs [--check|--fix]   (défaut : --check)
// Env   : BASE_REF (défaut : origin/main)

import { execFileSync, spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? '--check';
const base = process.env.BASE_REF || 'origin/main';
const fix = mode === '--fix';
const CODE = /\.(ts|tsx|mts|js|jsx|mjs|cjs)$/;
const IGNORED = /^(scripts\/agent|\.github)\//;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const npx = (args, opts = {}) =>
  spawnSync('npx', args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });

const tracked = git('diff', '--name-only', '--diff-filter=ACMR', base, '--').split('\n');
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n');
const files = [...new Set([...tracked, ...untracked])]
  .filter((f) => f && CODE.test(f) && !IGNORED.test(f))
  .sort();

let failed = false;

// TypeScript — toujours, même sans fichier modifié (un .d.ts ou un tsconfig
// peut casser le typage).
console.log('— TypeScript (tsc -b)');
const tsc = npx(['tsc', '-b', '--pretty', 'false']);
if (tsc.status !== 0) {
  failed = true;
  console.log(`${tsc.stdout}\n${tsc.stderr}`.trim());
} else {
  console.log('OK');
}

if (!files.length) {
  console.log('\nAucun fichier de code modifié pour ESLint.');
  process.exit(failed ? 1 : 0);
}

// Lignes modifiées par fichier ; `true` = fichier entier (nouveau ou non suivi).
function changedLines(file) {
  if (untracked.includes(file)) return true;
  let diff;
  try {
    diff = git('diff', '-U0', base, '--', file);
  } catch {
    return true;
  }
  if (/^new file mode/m.test(diff)) return true;
  const ranges = [];
  for (const m of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    if (count > 0) ranges.push([start, start + count - 1]);
  }
  return ranges;
}
const lines = new Map(files.map((f) => [f, changedLines(f)]));
const touches = (file, line) => {
  const r = lines.get(file);
  return r === true || (Array.isArray(r) && r.some(([a, b]) => line >= a && line <= b));
};

console.log('\nFichiers vérifiés :');
for (const f of files) console.log(`  ${f}${lines.get(f) === true ? ' (nouveau)' : ''}`);

// ESLint. `--fix` ne corrige que ce qu'ESLint sait corriger seul ; il peut
// toucher des lignes voisines non modifiées : relis le diff ensuite.
console.log('\n— ESLint (lignes modifiées)');
const eslint = npx([
  'eslint',
  '--no-warn-ignored',
  '--format',
  'json',
  ...(fix ? ['--fix'] : []),
  ...files,
]);
let eslintErrors = 0;
let eslintIgnored = 0;
try {
  for (const res of JSON.parse(eslint.stdout)) {
    const file = res.filePath.slice(process.cwd().length + 1);
    for (const msg of res.messages) {
      if (msg.severity < 2) continue;
      if (msg.line === undefined || touches(file, msg.line)) {
        eslintErrors++;
        console.log(`${file}:${msg.line ?? 0}:${msg.column ?? 0}  ${msg.message}  (${msg.ruleId ?? 'eslint'})`);
      } else {
        eslintIgnored++;
      }
    }
  }
} catch {
  console.log(eslint.stdout, eslint.stderr);
  eslintErrors++;
}
if (eslintErrors) failed = true;
console.log(
  eslintErrors ? `${eslintErrors} erreur(s)` : 'OK',
  eslintIgnored ? `(${eslintIgnored} erreur(s) préexistante(s) hors des lignes modifiées, ignorées)` : '',
);

process.exit(failed ? 1 : 0);
