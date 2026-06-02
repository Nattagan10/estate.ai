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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_request_logs: {
        Row: {
          ai_profile: Json | null
          created_at: string | null
          detected_lang: string | null
          duration_ms: number | null
          error: string | null
          id: string
          local_filters: Json | null
          merged_filters: Json | null
          properties_sample: Json | null
          properties_total: number | null
          response_length: number | null
          search_mode: string | null
          session_id: string | null
          user_message: string | null
        }
        Insert: {
          ai_profile?: Json | null
          created_at?: string | null
          detected_lang?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          local_filters?: Json | null
          merged_filters?: Json | null
          properties_sample?: Json | null
          properties_total?: number | null
          response_length?: number | null
          search_mode?: string | null
          session_id?: string | null
          user_message?: string | null
        }
        Update: {
          ai_profile?: Json | null
          created_at?: string | null
          detected_lang?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          local_filters?: Json | null
          merged_filters?: Json | null
          properties_sample?: Json | null
          properties_total?: number | null
          response_length?: number | null
          search_mode?: string | null
          session_id?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      chat_logs: {
        Row: {
          content: string
          created_at: string
          filters_applied: Json
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          filters_applied?: Json
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          filters_applied?: Json
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          questionnaire: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          questionnaire?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          questionnaire?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rag_properties: {
        Row: {
          amenities: string[] | null
          coord_accurate: boolean | null
          created_at: string | null
          developer: string | null
          district: string | null
          district_canonical: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          nbr_floors: number | null
          near_transit: string | null
          neighborhood: string | null
          price_per_sqm: number | null
          price_thb: number | null
          property_type: string | null
          province: string | null
          rental_yield: number | null
          text_content: string | null
          url: string | null
          year_built: number | null
        }
        Insert: {
          amenities?: string[] | null
          coord_accurate?: boolean | null
          created_at?: string | null
          developer?: string | null
          district?: string | null
          district_canonical?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nbr_floors?: number | null
          near_transit?: string | null
          neighborhood?: string | null
          price_per_sqm?: number | null
          price_thb?: number | null
          property_type?: string | null
          province?: string | null
          rental_yield?: number | null
          text_content?: string | null
          url?: string | null
          year_built?: number | null
        }
        Update: {
          amenities?: string[] | null
          coord_accurate?: boolean | null
          created_at?: string | null
          developer?: string | null
          district?: string | null
          district_canonical?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nbr_floors?: number | null
          near_transit?: string | null
          neighborhood?: string | null
          price_per_sqm?: number | null
          price_thb?: number | null
          property_type?: string | null
          province?: string | null
          rental_yield?: number | null
          text_content?: string | null
          url?: string | null
          year_built?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rpc_fetch_map_pins: {
        Args: {
          p_area?: string
          p_has_yield?: boolean
          p_max_price?: number
          p_min_price?: number
          p_min_year?: number
          p_near_transit?: boolean
          p_property_types?: string[]
        }
        Returns: Json
      }
      rpc_search_properties: {
        Args: {
          p_area?: string
          p_has_yield?: boolean
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_min_year?: number
          p_near_transit?: boolean
          p_page?: number
          p_property_types?: string[]
          p_sort_by?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
      availability_status: "available" | "reserved" | "sold"
      listing_type: "rent" | "sale"
      property_type: "condo" | "house" | "townhouse" | "commercial"
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
      app_role: ["admin", "user"],
      availability_status: ["available", "reserved", "sold"],
      listing_type: ["rent", "sale"],
      property_type: ["condo", "house", "townhouse", "commercial"],
    },
  },
} as const
