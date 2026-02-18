export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          is_admin: boolean
          trial_ends_at: string | null
          subscription_status: string
          subscription_tier: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          is_admin?: boolean
          trial_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          is_admin?: boolean
          trial_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_sets: {
        Row: {
          id: string
          name: string
          year: number
          brand: string
          product_line: string
          set_type: Database["public"]["Enums"]["set_type"]
          insert_set_name: string | null
          parent_set_id: string | null
          cover_image_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          year: number
          brand: string
          product_line: string
          set_type?: Database["public"]["Enums"]["set_type"]
          insert_set_name?: string | null
          parent_set_id?: string | null
          cover_image_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          year?: number
          brand?: string
          product_line?: string
          set_type?: Database["public"]["Enums"]["set_type"]
          insert_set_name?: string | null
          parent_set_id?: string | null
          cover_image_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_checklist_items: {
        Row: {
          id: string
          library_set_id: string
          card_number: string
          player_name: string
          team: string | null
          subset_name: string | null
          parallel: string | null
          parallel_print_run: string | null
          serial_owned: string | null
          year: number | null
          status: Database["public"]["Enums"]["card_status"]
          display_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          library_set_id: string
          card_number: string
          player_name: string
          team?: string | null
          subset_name?: string | null
          parallel?: string | null
          parallel_print_run?: string | null
          serial_owned?: string | null
          year?: number | null
          status?: Database["public"]["Enums"]["card_status"]
          display_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          library_set_id?: string
          card_number?: string
          player_name?: string
          team?: string | null
          subset_name?: string | null
          parallel?: string | null
          parallel_print_run?: string | null
          serial_owned?: string | null
          year?: number | null
          status?: Database["public"]["Enums"]["card_status"]
          display_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_set_id_fkey"
            columns: ["library_set_id"]
            isOneToOne: false
            referencedRelation: "library_sets"
            referencedColumns: ["id"]
          }
        ]
      }
      user_sets: {
        Row: {
          id: string
          user_id: string
          library_set_id: string
          added_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          library_set_id: string
          added_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          library_set_id?: string
          added_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sets_library_set_id_fkey"
            columns: ["library_set_id"]
            isOneToOne: false
            referencedRelation: "library_sets"
            referencedColumns: ["id"]
          }
        ]
      }
      user_card_status: {
        Row: {
          id: string
          user_id: string
          library_checklist_item_id: string
          status: Database["public"]["Enums"]["card_status"]
          serial_owned: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          library_checklist_item_id: string
          status?: Database["public"]["Enums"]["card_status"]
          serial_owned?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          library_checklist_item_id?: string
          status?: Database["public"]["Enums"]["card_status"]
          serial_owned?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_card_status_library_checklist_item_id_fkey"
            columns: ["library_checklist_item_id"]
            isOneToOne: false
            referencedRelation: "library_checklist_items"
            referencedColumns: ["id"]
          }
        ]
      }
      brands: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      product_lines: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      insert_sets: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      user_collections: {
        Row: {
          id: string
          user_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      user_collection_sets: {
        Row: {
          id: string
          library_set_id: string
          user_collection_id: string
          created_at: string
        }
        Insert: {
          id?: string
          library_set_id: string
          user_collection_id: string
          created_at?: string
        }
        Update: {
          id?: string
          library_set_id?: string
          user_collection_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collection_sets_library_set_id_fkey"
            columns: ["library_set_id"]
            isOneToOne: false
            referencedRelation: "library_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collection_sets_user_collection_id_fkey"
            columns: ["user_collection_id"]
            isOneToOne: false
            referencedRelation: "user_collections"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      set_type: "base" | "insert" | "rainbow" | "multi_year_insert"
      card_status: "need" | "pending" | "owned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
      PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      set_type: ["base", "insert", "rainbow", "multi_year_insert"] as const,
      card_status: ["need", "pending", "owned"] as const,
    },
  },
} as const;
