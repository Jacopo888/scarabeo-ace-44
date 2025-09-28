export function summarizeMoveInfo(moveInfo: any): { words: string[]; score: number } {
  const words = Array.isArray(moveInfo?.words)
    ? (moveInfo.words as string[])
    : (moveInfo?.word ? [String(moveInfo.word)] : [])
  const score = typeof moveInfo?.score_earned === 'number'
    ? moveInfo.score_earned
    : (typeof moveInfo?.score === 'number' ? moveInfo.score : 0)
  return { words, score }
}
