import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function hydrateEnvFromFile(filename, key) {
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

const REQUIRED_PROD_ENV_KEYS = [
  'VITE_QUACKLE_SERVICE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

for (const key of REQUIRED_PROD_ENV_KEYS) {
  hydrateEnvFromFile('.env.production', key);
  hydrateEnvFromFile('.env', key);
}

// Fail production builds when required Vite env is missing.
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const missing = REQUIRED_PROD_ENV_KEYS.filter((key) => !(process.env[key] || '').trim());
if (isProd && missing.length > 0) {
  console.error(`[BUILD GUARD] Missing required production env: ${missing.join(', ')}`);
  process.exit(1);
} else {
  console.log('[BUILD GUARD] OK. Required production env present:', REQUIRED_PROD_ENV_KEYS.join(', '));
  process.exit(0);
}
