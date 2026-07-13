// Automatisch generiert aus dem Supabase-Schema.
// Neu erzeugen mit dem Supabase MCP-Tool `generate_typescript_types`.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      clique_state: {
        Row: {
          payload: Json
          state_key: string
          updated_at: string
          version: number
        }
        Insert: {
          payload?: Json
          state_key: string
          updated_at?: string
          version?: number
        }
        Update: {
          payload?: Json
          state_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      games: {
        Row: {
          client_id: string
          created_at: string
          event: string
          id: string
          played_at: string
          players: Json
          turns: Json | null
          winner: string
          winner_score: number
        }
        Insert: {
          client_id: string
          created_at?: string
          event?: string
          id?: string
          played_at: string
          players: Json
          turns?: Json | null
          winner: string
          winner_score: number
        }
        Update: {
          client_id?: string
          created_at?: string
          event?: string
          id?: string
          played_at?: string
          players?: Json
          turns?: Json | null
          winner?: string
          winner_score?: number
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
