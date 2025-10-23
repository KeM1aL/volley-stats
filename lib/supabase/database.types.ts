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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      championships: {
        Row: {
          age_category: Database["public"]["Enums"]["age_category"]
          created_at: string | null
          default_match_format: number
          format: Database["public"]["Enums"]["championship_format"]
          gender: Database["public"]["Enums"]["championship_gender"]
          id: number
          metadata: Json | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          age_category: Database["public"]["Enums"]["age_category"]
          created_at?: string | null
          default_match_format?: number
          format: Database["public"]["Enums"]["championship_format"]
          gender: Database["public"]["Enums"]["championship_gender"]
          id?: number
          metadata?: Json | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          age_category?: Database["public"]["Enums"]["age_category"]
          created_at?: string | null
          default_match_format?: number
          format?: Database["public"]["Enums"]["championship_format"]
          gender?: Database["public"]["Enums"]["championship_gender"]
          id?: number
          metadata?: Json | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "championships_default_match_format_fkey"
            columns: ["default_match_format"]
            isOneToOne: false
            referencedRelation: "match_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["club_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          away_score: number
          comment: string | null
          created_at: string
          home_score: number
          id: string
          match_id: string
          set_id: string
          team_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          away_score?: number
          comment?: string | null
          created_at?: string
          home_score?: number
          id?: string
          match_id: string
          set_id: string
          team_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          away_score?: number
          comment?: string | null
          created_at?: string
          home_score?: number
          id?: string
          match_id?: string
          set_id?: string
          team_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_match"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_set"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_formats: {
        Row: {
          created_at: string | null
          decisive_point: boolean
          description: string | null
          id: number
          point_by_set: number
          point_final_set: number
          rotation: boolean
          sets_to_win: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decisive_point: boolean
          description?: string | null
          id?: never
          point_by_set: number
          point_final_set: number
          rotation: boolean
          sets_to_win: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decisive_point?: boolean
          description?: string | null
          id?: never
          point_by_set?: number
          point_final_set?: number
          rotation?: boolean
          sets_to_win?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_available_players: string[] | null
          away_score: number
          away_team_id: string
          championship_id: number | null
          created_at: string
          date: string
          home_available_players: string[] | null
          home_score: number
          home_team_id: string
          id: string
          location: string | null
          match_format_id: number
          season_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          away_available_players?: string[] | null
          away_score?: number
          away_team_id: string
          championship_id?: number | null
          created_at?: string
          date: string
          home_available_players?: string[] | null
          home_score?: number
          home_team_id: string
          id?: string
          location?: string | null
          match_format_id?: number
          season_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_available_players?: string[] | null
          away_score?: number
          away_team_id?: string
          championship_id?: number | null
          created_at?: string
          date?: string
          home_available_players?: string[] | null
          home_score?: number
          home_team_id?: string
          id?: string
          location?: string | null
          match_format_id?: number
          season_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_match_format_fkey"
            columns: ["match_format_id"]
            isOneToOne: false
            referencedRelation: "match_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          created_at: string
          id: string
          match_id: string
          player_id: string
          position: string | null
          result: string
          set_id: string
          stat_type: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          position?: string | null
          result: string
          set_id: string
          stat_type: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          position?: string | null
          result?: string
          set_id?: string
          stat_type?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          first_name?: string | null
          id: string
          last_name?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: []
      }
      score_points: {
        Row: {
          action_team_id: string
          away_score: number
          created_at: string
          current_rotation: Json
          home_score: number
          id: string
          match_id: string
          player_id: string | null
          player_stat_id: string | null
          point_type: string
          result: string
          scoring_team_id: string
          set_id: string
          timestamp: string
          updated_at: string
        }
        Insert: {
          action_team_id: string
          away_score: number
          created_at?: string
          current_rotation: Json
          home_score: number
          id?: string
          match_id: string
          player_id?: string | null
          player_stat_id?: string | null
          point_type: string
          result: string
          scoring_team_id: string
          set_id: string
          timestamp?: string
          updated_at?: string
        }
        Update: {
          action_team_id?: string
          away_score?: number
          created_at?: string
          current_rotation?: Json
          home_score?: number
          id?: string
          match_id?: string
          player_id?: string | null
          player_stat_id?: string | null
          point_type?: string
          result?: string
          scoring_team_id?: string
          set_id?: string
          timestamp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_points_action_team_id_fkey"
            columns: ["action_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_points_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_points_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_points_player_stat_id_fkey"
            columns: ["player_stat_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_points_scoring_team_id_fkey"
            columns: ["scoring_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_points_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: number
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: never
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: never
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          away_score: number
          created_at: string
          current_lineup: Json
          first_lineup: Json
          first_server_team_id: string
          home_score: number
          id: string
          match_id: string
          player_roles: Json
          server_team_id: string
          set_number: number
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number
          created_at?: string
          current_lineup?: Json
          first_lineup?: Json
          first_server_team_id: string
          home_score?: number
          id?: string
          match_id: string
          player_roles?: Json
          server_team_id: string
          set_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: number
          created_at?: string
          current_lineup?: Json
          first_lineup?: Json
          first_server_team_id?: string
          home_score?: number
          id?: string
          match_id?: string
          player_roles?: Json
          server_team_id?: string
          set_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_first_server_team_id_fkey"
            columns: ["first_server_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_server_team_id_fkey"
            columns: ["server_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          match_id: string
          player_in_id: string
          player_out_id: string
          position: string
          set_id: string
          team_id: string
          timestamp: string
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          match_id: string
          player_in_id: string
          player_out_id: string
          position: string
          set_id: string
          team_id: string
          timestamp?: string
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          match_id?: string
          player_in_id?: string
          player_out_id?: string
          position?: string
          set_id?: string
          team_id?: string
          timestamp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_player_in_id_fkey"
            columns: ["player_in_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_player_out_id_fkey"
            columns: ["player_out_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          comments: string | null
          created_at: string
          id: string
          name: string
          number: number
          position: string
          role: string
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          name: string
          number: number
          position: string
          role?: string
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          name?: string
          number?: number
          position?: string
          role?: string
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          championship_id: number | null
          club_id: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          championship_id?: number | null
          club_id?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          championship_id?: number | null
          club_id?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_current_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _is_club_member: {
        Args: { p_club: string; p_user: string }
        Returns: boolean
      }
    }
    Enums: {
      age_category: "U10" | "U12" | "U14" | "U16" | "U18" | "U21" | "senior"
      championship_format: "2x2" | "3x3" | "4x4" | "6x6"
      championship_gender: "male" | "female"
      championship_type: "regional" | "departmental" | "national"
      club_member_role: "owner" | "admin" | "member"
      formatType: "6x6" | "4x4"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      age_category: ["U10", "U12", "U14", "U16", "U18", "U21", "senior"],
      championship_format: ["2x2", "3x3", "4x4", "6x6"],
      championship_gender: ["male", "female"],
      championship_type: ["regional", "departmental", "national"],
      club_member_role: ["owner", "admin", "member"],
      formatType: ["6x6", "4x4"],
    },
  },
} as const
