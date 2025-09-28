export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      daily_puzzles: {
        Row: {
          best_score: number
          board: Json
          created_at: string | null
          id: string
          rack: Json
          yyyymmdd: number
        }
        Insert: {
          best_score: number
          board: Json
          created_at?: string | null
          id?: string
          rack: Json
          yyyymmdd: number
        }
        Update: {
          best_score?: number
          board?: Json
          created_at?: string | null
          id?: string
          rack?: Json
          yyyymmdd?: number
        }
        Relationships: []
      }
      daily_scores: {
        Row: {
          created_at: string | null
          id: string
          score: number
          user_id: string
          yyyymmdd: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          score: number
          user_id: string
          yyyymmdd: number
        }
        Update: {
          created_at?: string | null
          id?: string
          score?: number
          user_id?: string
          yyyymmdd?: number
        }
        Relationships: []
      }
      game_chats: {
        Row: {
          created_at: string
          game_id: string
          id: string
          message: string
          player_id: string
          player_name: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          message: string
          player_id: string
          player_name: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          message?: string
          player_id?: string
          player_name?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          board_state: Json
          created_at: string | null
          current_player_id: string
          id: string
          pass_count: number | null
          player1_id: string
          player1_rack: Json
          player1_score: number | null
          player2_id: string
          player2_rack: Json
          player2_score: number | null
          status: string
          tile_bag: Json
          turn_deadline: string | null
          turn_duration: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          board_state?: Json
          created_at?: string | null
          current_player_id: string
          id?: string
          pass_count?: number | null
          player1_id: string
          player1_rack?: Json
          player1_score?: number | null
          player2_id: string
          player2_rack?: Json
          player2_score?: number | null
          status?: string
          tile_bag?: Json
          turn_deadline?: string | null
          turn_duration?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          board_state?: Json
          created_at?: string | null
          current_player_id?: string
          id?: string
          pass_count?: number | null
          player1_id?: string
          player1_rack?: Json
          player1_score?: number | null
          player2_id?: string
          player2_rack?: Json
          player2_score?: number | null
          status?: string
          tile_bag?: Json
          turn_deadline?: string | null
          turn_duration?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string | null
          id: string
          preferred_duration: string
          skill_level: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferred_duration: string
          skill_level: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preferred_duration?: string
          skill_level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          board_state_after: Json
          created_at: string | null
          game_id: string
          id: string
          move_index: number | null
          move_type: string
          player_id: string
          rack_after: Json
          rack_before: Json | null
          score_earned: number | null
          tiles_exchanged: Json | null
          tiles_placed: Json | null
          word: string | null
          words_formed: Json | null
        }
        Insert: {
          board_state_after: Json
          created_at?: string | null
          game_id: string
          id?: string
          move_index?: number | null
          move_type: string
          player_id: string
          rack_after: Json
          rack_before?: Json | null
          score_earned?: number | null
          tiles_exchanged?: Json | null
          tiles_placed?: Json | null
          word?: string | null
          words_formed?: Json | null
        }
        Update: {
          board_state_after?: Json
          created_at?: string | null
          game_id?: string
          id?: string
          move_index?: number | null
          move_type?: string
          player_id?: string
          rack_after?: Json
          rack_before?: Json | null
          score_earned?: number | null
          tiles_exchanged?: Json | null
          tiles_placed?: Json | null
          word?: string | null
          words_formed?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          games_played: number | null
          games_won: number | null
          id: string
          preferred_game_duration: string | null
          skill_level: number | null
          total_score: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          games_played?: number | null
          games_won?: number | null
          id: string
          preferred_game_duration?: string | null
          skill_level?: number | null
          total_score?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          preferred_game_duration?: string | null
          skill_level?: number | null
          total_score?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      puzzle_scores: {
        Row: {
          created_at: string | null
          id: string
          puzzle_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          puzzle_id: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          puzzle_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_scores_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzles: {
        Row: {
          best_score: number
          board: Json
          created_at: string | null
          id: string
          rack: Json
        }
        Insert: {
          best_score: number
          board: Json
          created_at?: string | null
          id?: string
          rack: Json
        }
        Update: {
          best_score?: number
          board?: Json
          created_at?: string | null
          id?: string
          rack?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_queue_entries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {},
  },
} as const
