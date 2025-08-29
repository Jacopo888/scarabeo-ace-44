import { useEffect, useState } from 'react'

export interface LobbyEntry {
  id: string
  host: string
  players: number
  maxPlayers: number
}

const mockLobbies: Record<string, LobbyEntry[]> = {
  blitz: [
    { id: 'b1', host: 'Alice', players: 1, maxPlayers: 2 },
    { id: 'b2', host: 'Bob', players: 2, maxPlayers: 2 }
  ],
  rapid: [
    { id: 'r1', host: 'Charlie', players: 1, maxPlayers: 2 },
    { id: 'r2', host: 'Dana', players: 1, maxPlayers: 2 }
  ],
  async: [
    { id: 'a1', host: 'Eve', players: 1, maxPlayers: 2 }
  ]
}

export const useLobbySocket = (mode: 'blitz' | 'rapid' | 'async') => {
  const [lobbies, setLobbies] = useState<LobbyEntry[]>([])

  useEffect(() => {
    // Here we would connect to a websocket and listen for lobby updates.
    // Using mock data for now.
    setLobbies(mockLobbies[mode] || [])
  }, [mode])

  return { lobbies }
}
