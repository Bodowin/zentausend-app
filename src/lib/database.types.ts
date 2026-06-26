// Automatisch generiert aus dem Supabase-Schema (Tabelle public.games).
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
      games: {
        Row: {
          client_id: string
          created_at: string
          event: string
          id: string
          played_at: string
          players: Json
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
