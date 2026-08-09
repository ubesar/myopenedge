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
      accounts: {
        Row: {
          account_type: string | null
          broker: string | null
          consistency_enabled: boolean | null
          consistency_percent: number | null
          created_at: string
          currency: string | null
          daily_loss_limit: number | null
          daily_loss_limit_enabled: boolean | null
          id: string
          is_default: boolean | null
          max_loss_limit: number | null
          name: string
          profit_target: number | null
          starting_balance: number | null
          status: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          account_type?: string | null
          broker?: string | null
          consistency_enabled?: boolean | null
          consistency_percent?: number | null
          created_at?: string
          currency?: string | null
          daily_loss_limit?: number | null
          daily_loss_limit_enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          max_loss_limit?: number | null
          name: string
          profit_target?: number | null
          starting_balance?: number | null
          status?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          account_type?: string | null
          broker?: string | null
          consistency_enabled?: boolean | null
          consistency_percent?: number | null
          created_at?: string
          currency?: string | null
          daily_loss_limit?: number | null
          daily_loss_limit_enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          max_loss_limit?: number | null
          name?: string
          profit_target?: number | null
          starting_balance?: number | null
          status?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_knowledge: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_runs: {
        Row: {
          analysis_type: string
          created_at: string
          id: string
          summary: Json
          symbol: string
          user_id: string
        }
        Insert: {
          analysis_type: string
          created_at?: string
          id?: string
          summary?: Json
          symbol: string
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          id?: string
          summary?: Json
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_templates: {
        Row: {
          body_ratio: string | null
          created_at: string | null
          ib_window: number
          id: string
          max_days: number
          mode: string
          name: string
          occ_body_ratio: string | null
          occ_timeframe: string | null
          symbol: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          body_ratio?: string | null
          created_at?: string | null
          ib_window?: number
          id?: string
          max_days?: number
          mode?: string
          name: string
          occ_body_ratio?: string | null
          occ_timeframe?: string | null
          symbol?: string
          user_id: string
          weekdays?: number[]
        }
        Update: {
          body_ratio?: string | null
          created_at?: string | null
          ib_window?: number
          id?: string
          max_days?: number
          mode?: string
          name?: string
          occ_body_ratio?: string | null
          occ_timeframe?: string | null
          symbol?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          content: string | null
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ea_control: {
        Row: {
          asset_name: string
          breakeven: number
          created_at: string
          current_command: string
          id: string
          is_active: boolean
          lot_size: number
          magic_number: number
          max_orders: number
          order_distance: number
          risk_usd: number
          rr_ratio: number
          slippage: number
          stop_loss: number
          take_profit: number
          trailing_stop: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_name?: string
          breakeven?: number
          created_at?: string
          current_command?: string
          id?: string
          is_active?: boolean
          lot_size?: number
          magic_number: number
          max_orders?: number
          order_distance?: number
          risk_usd?: number
          rr_ratio?: number
          slippage?: number
          stop_loss?: number
          take_profit?: number
          trailing_stop?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_name?: string
          breakeven?: number
          created_at?: string
          current_command?: string
          id?: string
          is_active?: boolean
          lot_size?: number
          magic_number?: number
          max_orders?: number
          order_distance?: number
          risk_usd?: number
          rr_ratio?: number
          slippage?: number
          stop_loss?: number
          take_profit?: number
          trailing_stop?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          file_name: string | null
          file_url: string | null
          id: string
          rows_count: number | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          rows_count?: number | null
          source: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          rows_count?: number | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          created_at: string
          id: string
          name: string | null
          point_value: number | null
          symbol: string
          tick_size: number | null
          tick_value: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          point_value?: number | null
          symbol: string
          tick_size?: number | null
          tick_value?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          point_value?: number | null
          symbol?: string
          tick_size?: number | null
          tick_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      mc_alert_state: {
        Row: {
          id: number
          last_alert_time: string
          last_signal_type: string
          updated_at: string
        }
        Insert: {
          id: number
          last_alert_time?: string
          last_signal_type?: string
          updated_at?: string
        }
        Update: {
          id?: number
          last_alert_time?: string
          last_signal_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      midtrans_webhook_logs: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          payment_type: string | null
          raw_payload: Json | null
          transaction_status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_type?: string | null
          raw_payload?: Json | null
          transaction_status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_type?: string | null
          raw_payload?: Json | null
          transaction_status?: string | null
        }
        Relationships: []
      }
      ny_session_bias: {
        Row: {
          created_at: string
          first_breakout: string | null
          formed_first: string
          id: string
          orb_high_price: number
          orb_low_price: number
          session_date: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_breakout?: string | null
          formed_first: string
          id?: string
          orb_high_price: number
          orb_low_price: number
          session_date: string
          symbol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_breakout?: string | null
          formed_first?: string
          id?: string
          orb_high_price?: number
          orb_low_price?: number
          session_date?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          invoice_id: string | null
          midtrans_order_id: string | null
          payment_method: string | null
          payment_type: string | null
          snap_token: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          invoice_id?: string | null
          midtrans_order_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          snap_token?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          invoice_id?: string | null
          midtrans_order_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          snap_token?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_risk: number | null
          display_name: string | null
          email: string | null
          id: string
          max_daily_risk: number | null
          subscription_end_date: string | null
          subscription_status: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_risk?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          max_daily_risk?: number | null
          subscription_end_date?: string | null
          subscription_status?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_risk?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          max_daily_risk?: number | null
          subscription_end_date?: string | null
          subscription_status?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_id: string | null
          close_time: string
          confidence_score: number | null
          created_at: string
          entry_price: number
          exit_price: number
          fees: number | null
          grade: string | null
          id: string
          import_batch_id: string | null
          instrument_id: string | null
          notes: string | null
          open_time: string
          order_ids: string[] | null
          playbook: string | null
          playbook_id: string | null
          pnl_gross: number
          pnl_net: number
          qty: number
          r_multiple: number | null
          session: string | null
          setup_tags: string[] | null
          side: string
          sl_ticks: number | null
          source: string
          symbol: string
          tp_ticks: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          close_time: string
          confidence_score?: number | null
          created_at?: string
          entry_price: number
          exit_price: number
          fees?: number | null
          grade?: string | null
          id?: string
          import_batch_id?: string | null
          instrument_id?: string | null
          notes?: string | null
          open_time: string
          order_ids?: string[] | null
          playbook?: string | null
          playbook_id?: string | null
          pnl_gross: number
          pnl_net: number
          qty: number
          r_multiple?: number | null
          session?: string | null
          setup_tags?: string[] | null
          side: string
          sl_ticks?: number | null
          source?: string
          symbol: string
          tp_ticks?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          close_time?: string
          confidence_score?: number | null
          created_at?: string
          entry_price?: number
          exit_price?: number
          fees?: number | null
          grade?: string | null
          id?: string
          import_batch_id?: string | null
          instrument_id?: string | null
          notes?: string | null
          open_time?: string
          order_ids?: string[] | null
          playbook?: string | null
          playbook_id?: string | null
          pnl_gross?: number
          pnl_net?: number
          qty?: number
          r_multiple?: number | null
          session?: string | null
          setup_tags?: string[] | null
          side?: string
          sl_ticks?: number | null
          source?: string
          symbol?: string
          tp_ticks?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      watchlist: {
        Row: {
          created_at: string
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { _endpoint: string; _max_requests: number; _user_id: string }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
