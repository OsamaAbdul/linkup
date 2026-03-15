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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          created_at: string
          id: string
          product_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          promoter_id: string
          rate: number
          seller_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          promoter_id: string
          rate?: number
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          promoter_id?: string
          rate?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          product_id: string | null
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          city_id: string
          created_at: string
          delivery_fee: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          city_id: string
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          city_id?: string
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_kyc: {
        Row: {
          city_id: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          home_address: string
          id: string
          passport_photo_url: string | null
          phone_number: string
          status: string | null
          user_id: string
          zone_id: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          home_address: string
          id?: string
          passport_photo_url?: string | null
          phone_number: string
          status?: string | null
          user_id: string
          zone_id?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          home_address?: string
          id?: string
          passport_photo_url?: string | null
          phone_number?: string
          status?: string | null
          user_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_kyc_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_kyc_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          items: Json
          payment_method: string | null
          payment_ref: string | null
          payment_status: string | null
          promoter_id: string | null
          seller_id: string
          shipping_info: Json | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          items?: Json
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: string | null
          promoter_id?: string | null
          seller_id: string
          shipping_info?: Json | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          items?: Json
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: string | null
          promoter_id?: string | null
          seller_id?: string
          shipping_info?: Json | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          city_id: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          inventory: number
          latitude: number | null
          likes_count: number | null
          longitude: number | null
          price: number
          seller_id: string
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          inventory?: number
          latitude?: number | null
          likes_count?: number | null
          longitude?: number | null
          price?: number
          seller_id: string
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          inventory?: number
          latitude?: number | null
          likes_count?: number | null
          longitude?: number | null
          price?: number
          seller_id?: string
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          city_id: string | null
          created_at: string
          display_name: string | null
          id: string
          is_online: boolean | null
          latitude: number | null
          longitude: number | null
          onboarding_completed: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
          zone: string | null
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          longitude?: number | null
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
          zone?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          longitude?: number | null
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          zone?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      promoter_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          clicked_at: string
          id: string
          product_id: string
          promoter_id: string
          visitor_id: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          product_id: string
          promoter_id: string
          visitor_id?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          product_id?: string
          promoter_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_verifications: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_details: Json | null
          bank_name: string | null
          business_address: string | null
          business_name: string
          city_id: string | null
          created_at: string
          id: string
          national_id_url: string | null
          phone_number: string | null
          status: string
          store_photo_url: string | null
          updated_at: string
          user_id: string
          zone: string | null
          zone_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_details?: Json | null
          bank_name?: string | null
          business_address?: string | null
          business_name: string
          city_id?: string | null
          created_at?: string
          id?: string
          national_id_url?: string | null
          phone_number?: string | null
          status?: string
          store_photo_url?: string | null
          updated_at?: string
          user_id: string
          zone?: string | null
          zone_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_details?: Json | null
          bank_name?: string | null
          business_address?: string | null
          business_name?: string
          city_id?: string | null
          created_at?: string
          id?: string
          national_id_url?: string | null
          phone_number?: string | null
          status?: string
          store_photo_url?: string | null
          updated_at?: string
          user_id?: string
          zone?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_verifications_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verifications_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          shipment_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          shipment_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          buyer_latitude: number | null
          buyer_longitude: number | null
          created_at: string
          delivery_address: string | null
          delivery_fee: number | null
          id: string
          last_seen: string | null
          order_id: string
          pickup_address: string | null
          rider_id: string | null
          rider_latitude: number | null
          rider_longitude: number | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_latitude?: number | null
          buyer_longitude?: number | null
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          id?: string
          last_seen?: string | null
          order_id: string
          pickup_address?: string | null
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_latitude?: number | null
          buyer_longitude?: number | null
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          id?: string
          last_seen?: string | null
          order_id?: string
          pickup_address?: string | null
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reference: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reference?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reference?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          seller_id?: string
          updated_at?: string
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
    }
    Enums: {
      app_role: "buyer" | "seller" | "logistics" | "admin" | "promoter"
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
      app_role: ["buyer", "seller", "logistics", "admin", "promoter"],
    },
  },
} as const
