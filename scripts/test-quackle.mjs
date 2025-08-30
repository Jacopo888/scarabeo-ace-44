import process from 'node:process';
const base = process.env.QUACKLE_BASE || 'http://localhost:5000';

const health = await fetch(`${base}/health`).then(r => r.text()).catch(e => String(e));
console.log('[HEALTH]', health);

const payload = {
  board: {},
  rack: [{ letter: 'A', points: 1 }, { letter: 'R', points: 1 }, { letter: 'E', points: 1 }],
  difficulty: 'easy'
};

const r = await fetch(`${base}/best-move`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(r => r.text()).catch(e => String(e));

console.log('[BEST-MOVE]', r);
