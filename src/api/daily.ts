import { apiFetch } from './client';
import type { Tile } from '@/types/game';

export interface DailyTodayResponse {
  yyyymmdd: number;
  board: (Tile | null)[][];
  racks: Tile[][];
}

export function getDailyToday(): Promise<DailyTodayResponse> {
  return apiFetch('/daily-challenge/today');
}

export interface DailySubmitBody {
  yyyymmdd: number;
  userId: string;
  score: number;
  turns?: Array<{ turn: number; placed: number }>;
}

export interface DailySubmitResponse {
  kept: boolean;
  score: number;
}

export function submitDaily(body: DailySubmitBody): Promise<DailySubmitResponse> {
  return apiFetch('/daily-challenge/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getDailyLeaderboard(yyyymmdd?: number, limit = 50): Promise<Array<{ user_id: string; score: number }>> {
  const params = new URLSearchParams();
  if (yyyymmdd) params.set('yyyymmdd', String(yyyymmdd));
  params.set('limit', String(limit));
  return apiFetch(`/daily-challenge/leaderboard?${params.toString()}`);
}
