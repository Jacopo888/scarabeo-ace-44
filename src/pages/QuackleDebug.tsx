import { useState } from 'react';
import { quackleHealth, quackleBestMove, getQuackleBase } from '@/services/quackleClient';

export default function QuackleDebug() {
  const [health, setHealth] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function doHealth() {
    setLoading(true);
    try {
      const h = await quackleHealth();
      setHealth(JSON.stringify(h, null, 2));
    } catch (e: any) {
      setHealth(String(e?.message || e));
    } finally { setLoading(false); }
  }

  async function doBestMove() {
    setLoading(true);
    try {
      const payload = {
        board: {}, // board vuota per test semplice
        rack: [{ letter: 'A', points: 1, isBlank: false }, { letter: 'R', points: 1, isBlank: false }, { letter: 'E', points: 1, isBlank: false }],
        difficulty: 'easy'
      };
      const mv = await quackleBestMove(payload);
      setResult(JSON.stringify(mv, null, 2));
    } catch (e: any) {
      setResult(String(e?.message || e));
    } finally { setLoading(false); }
  }

  async function doEmptyBoardSmoke() {
    setLoading(true);
    try {
      const payload = {
        board: {},
        rack: [
          {letter:"A", points:1, isBlank:false},
          {letter:"E", points:1, isBlank:false},
          {letter:"I", points:1, isBlank:false},
          {letter:"N", points:1, isBlank:false},
          {letter:"R", points:1, isBlank:false},
          {letter:"S", points:1, isBlank:false},
          {letter:"?", points:0, isBlank:true}
        ],
        difficulty: "medium"
      };
      const mv = await quackleBestMove(payload);
      if (mv.move_type === 'pass' || (mv as any).engine_fallback === true) {
        setResult(JSON.stringify({ note: 'Unexpected PASS or fallback', response: mv }, null, 2));
      } else {
        setResult(JSON.stringify(mv, null, 2));
      }
    } catch (e: any) {
      // Show full error
      setResult(String(e?.message || e));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Quackle Debug</h2>
      <p><b>Base URL:</b> {getQuackleBase()}</p>
      <button onClick={doHealth} disabled={loading}>Check /health</button>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{health}</pre>
      <hr />
      <button onClick={doBestMove} disabled={loading}>POST /best-move (smoke)</button>
      <button onClick={doEmptyBoardSmoke} disabled={loading} style={{ marginLeft: 8 }}>POST /best-move (empty board smoke)</button>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>
    </div>
  );
}
