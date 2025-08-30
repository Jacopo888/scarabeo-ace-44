// Esci con codice ≠ 0 se manca la env in build prod
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const v = process.env.VITE_QUACKLE_SERVICE_URL || '';
if (isProd && !v) {
  console.error('[BUILD GUARD] VITE_QUACKLE_SERVICE_URL mancante per build production.');
  process.exit(1);
} else {
  console.log('[BUILD GUARD] OK. VITE_QUACKLE_SERVICE_URL =', v || '(dev fallback)');
  process.exit(0);
}
