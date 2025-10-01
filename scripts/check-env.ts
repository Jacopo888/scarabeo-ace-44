import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function hydrateEnvFromFile(filename: string, key: string) {
  const filePath = resolve(process.cwd(), filename);
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [maybeKey, ...rest] = trimmed.split('=');
    if (!maybeKey || maybeKey.trim() !== key) continue;
    if (process.env[key]) return;
    const rawValue = rest.join('=').trim();
    const cleaned = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] = cleaned;
    return;
  }
}

const TARGET_ENV_KEY = 'VITE_QUACKLE_SERVICE_URL';
hydrateEnvFromFile('.env.production', TARGET_ENV_KEY);
hydrateEnvFromFile('.env', TARGET_ENV_KEY);

// Esci con codice ≠ 0 se manca la env in build prod
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const v = process.env[TARGET_ENV_KEY] || '';
if (isProd && !v) {
  console.error('[BUILD GUARD] VITE_QUACKLE_SERVICE_URL mancante per build production.');
  process.exit(1);
} else {
  console.log('[BUILD GUARD] OK. VITE_QUACKLE_SERVICE_URL =', v || '(dev fallback)');
  process.exit(0);
}
