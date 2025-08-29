import { useEffect, useState } from 'react';
import { ScrabbleBoard } from '@/components/ScrabbleBoard';
import { TileRack } from '@/components/TileRack';
import { Button } from '@/components/ui/button';
import { useDailyPuzzle, useDailyLeaderboard } from '@/hooks/useDaily';
import { submitDaily } from '@/api/daily';
import type { Tile, PlacedTile } from '@/types/game';

interface TurnMeta { turn: number; placed: number }

const SPECIAL_SQUARES: Record<string, string> = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW',
  '7,0': 'TW', '7,14': 'TW',
  '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '1,13': 'DW',
  '2,2': 'DW', '2,12': 'DW',
  '3,3': 'DW', '3,11': 'DW',
  '4,4': 'DW', '4,10': 'DW',
  '10,4': 'DW', '10,10': 'DW',
  '11,3': 'DW', '11,11': 'DW',
  '12,2': 'DW', '12,12': 'DW',
  '13,1': 'DW', '13,13': 'DW',
  '1,5': 'TL', '1,9': 'TL',
  '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL',
  '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL',
  '13,5': 'TL', '13,9': 'TL',
  '0,3': 'DL', '0,11': 'DL',
  '2,6': 'DL', '2,8': 'DL',
  '3,0': 'DL', '3,7': 'DL', '3,14': 'DL',
  '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL',
  '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL',
  '11,0': 'DL', '11,7': 'DL', '11,14': 'DL',
  '12,6': 'DL', '12,8': 'DL',
  '14,3': 'DL', '14,11': 'DL',
  '7,7': 'STAR',
};

const getClientId = () => {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('clientId', id);
  }
  return id;
};

const formatDate = (n: number) => {
  const s = n.toString();
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
};

export default function DailyChallengePage() {
  const { data, error, isLoading } = useDailyPuzzle();
  const [turn, setTurn] = useState(1);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [rack, setRack] = useState<Tile[]>([]);
  const [pending, setPending] = useState<PlacedTile[]>([]);
  const [board, setBoard] = useState<Map<string, PlacedTile>>(new Map());
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [metas, setMetas] = useState<TurnMeta[]>([]);

  const { data: leaderboard } = useDailyLeaderboard(data?.yyyymmdd);

  useEffect(() => {
    if (data) {
      setRack(data.racks[0]);
    }
  }, [data]);

  const handlePlaceTile = (row: number, col: number, tile: Tile) => {
    setPending((p) => [...p, { row, col, letter: tile.letter, points: tile.points, isBlank: tile.isBlank }]);
    setRack((r) => r.filter((t, i) => i !== selected));
    setSelected(null);
  };

  const handlePickup = (row: number, col: number) => {
    setPending((p) => {
      const idx = p.findIndex((t) => t.row === row && t.col === col);
      if (idx >= 0) {
        const tile = p[idx];
        setRack((r) => [...r, { letter: tile.letter, points: tile.points, isBlank: tile.isBlank }]);
        const arr = [...p];
        arr.splice(idx, 1);
        return arr;
      }
      return p;
    });
  };

  const getBonus = (row: number, col: number) => SPECIAL_SQUARES[`${row},${col}`];

  const calculateScore = () => {
    if (pending.length === 0) return 0;
    const sameRow = pending.every((t) => t.row === pending[0].row);
    const sameCol = pending.every((t) => t.col === pending[0].col);
    if (!sameRow && !sameCol) return 0;
      const wordTiles: PlacedTile[] = [];
    if (sameRow) {
      const row = pending[0].row;
      let c = Math.min(...pending.map((t) => t.col));
      while (board.get(`${row},${c-1}`)) c--;
      for (; ; c++) {
        const existing = board.get(`${row},${c}`);
        const p = pending.find((t) => t.col === c);
        if (!existing && !p) break;
        if (existing) wordTiles.push(existing);
        if (p) wordTiles.push(p);
      }
    } else {
      const col = pending[0].col;
      let r = Math.min(...pending.map((t) => t.row));
      while (board.get(`${r-1},${col}`)) r--;
      for (; ; r++) {
        const existing = board.get(`${r},${col}`);
        const p = pending.find((t) => t.row === r);
        if (!existing && !p) break;
        if (existing) wordTiles.push(existing);
        if (p) wordTiles.push(p);
      }
    }
    let score = 0;
    let wordMult = 1;
    for (const tile of wordTiles) {
      let val = tile.points;
      const isNew = pending.some((p) => p.row === tile.row && p.col === tile.col);
      if (isNew) {
        const bonus = getBonus(tile.row, tile.col);
        if (bonus === 'DL') val *= 2;
        if (bonus === 'TL') val *= 3;
        if (bonus === 'DW') wordMult *= 2;
        if (bonus === 'TW') wordMult *= 3;
      }
      score += val;
    }
    score *= wordMult;
    if (pending.length === 7) score += 50;
    return score;
  };

  const submitTurn = async () => {
    const turnScore = calculateScore();
    const newBoard = new Map(board);
    pending.forEach((t) => newBoard.set(`${t.row},${t.col}`, t));
    setBoard(newBoard);
    setMetas((m) => [...m, { turn, placed: pending.length }]);
    setPending([]);
    setScoreTotal((s) => s + turnScore);
    const next = turn + 1;
    setTurn(next);
    if (data && next <= 5) {
      setRack(data.racks[next - 1]);
    }
  };

  useEffect(() => {
    if (data && turn > 5 && !submitted) {
      setSubmitted(true);
      const body = { yyyymmdd: data.yyyymmdd, userId: getClientId(), score: scoreTotal, turns: metas };
      submitDaily(body).then((res) => {
        localStorage.setItem(`daily:${data.yyyymmdd}:done`, '1');
      }).catch(() => {});
    }
  }, [turn, submitted, data, scoreTotal, metas]);

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error || !data) return <div className="p-4">Failed to load daily puzzle.</div>;

  const dateStr = formatDate(data.yyyymmdd);

  return (
    <div className="p-4 flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-xl font-bold">Daily Challenge — {dateStr} • Turn {Math.min(turn,5)}/5</h2>
        <ScrabbleBoard
          boardMap={board}
          pendingTiles={pending}
          onPlaceTile={handlePlaceTile}
          onPickupTile={handlePickup}
          selectedTile={selected !== null ? rack[selected] : null}
          onUseSelectedTile={() => setSelected(null)}
        />
        {turn <=5 && (
          <TileRack
            tiles={rack}
            selectedTiles={selected !== null ? [selected] : []}
            onTileSelect={(i) => setSelected(i)}
          />
        )}
        {turn <=5 && (
          <Button onClick={submitTurn} className="self-start">Submit Turn</Button>
        )}
        {turn >5 && (
          <div>
            <p className="text-lg font-semibold">Score: {scoreTotal}</p>
            <Button onClick={() => navigator.clipboard.writeText(`Scarabeo Daily ${dateStr}\nScore: ${scoreTotal} (5 turns)\n${window.location.origin}/daily-challenge`)}>Share result</Button>
          </div>
        )}
      </div>
      <div className="w-full lg:w-64">
        <h3 className="font-semibold mb-2">Leaderboard</h3>
        <ul>
          {leaderboard?.map((entry) => (
            <li key={entry.user_id} className="flex justify-between">
              <span>{entry.user_id}</span>
              <span>{entry.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
