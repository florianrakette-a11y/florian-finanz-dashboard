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
      bank_transactions: {
        Row: {
          amount_cents: number
          bb_account: string | null
          bb_transaction_id: string
          counterpart: string | null
          date: string
          id: string
          match_status: Database["public"]["Enums"]["bank_match_status"]
          matched_fixed_expense_id: string | null
          matched_variable_expense_id: string | null
          purpose: string | null
          raw_payload: Json | null
          synced_at: string
        }
        Insert: {
          amount_cents: number
          bb_account?: string | null
          bb_transaction_id: string
          counterpart?: string | null
          date: string
          id?: string
          match_status?: Database["public"]["Enums"]["bank_match_status"]
          matched_fixed_expense_id?: string | null
          matched_variable_expense_id?: string | null
          purpose?: string | null
          raw_payload?: Json | null
          synced_at?: string
        }
        Update: {
          amount_cents?: number
          bb_account?: string | null
          bb_transaction_id?: string
          counterpart?: string | null
          date?: string
          id?: string
          match_status?: Database["public"]["Enums"]["bank_match_status"]
          matched_fixed_expense_id?: string | null
          matched_variable_expense_id?: string | null
          purpose?: string | null
          raw_payload?: Json | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_matched_fixed_expense_id_fkey"
            columns: ["matched_fixed_expense_id"]
            isOneToOne: false
            referencedRelation: "fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_variable_expense_id_fkey"
            columns: ["matched_variable_expense_id"]
            isOneToOne: false
            referencedRelation: "variable_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_scan_log: {
        Row: {
          classification_suggested:
            | Database["public"]["Enums"]["email_classification"]
            | null
          confidence: number | null
          confirmed_by_user: boolean
          id: string
          linked_open_invoice_id: string | null
          mailbox: Database["public"]["Enums"]["mailbox"]
          message_id: string
          scanned_at: string
        }
        Insert: {
          classification_suggested?:
            | Database["public"]["Enums"]["email_classification"]
            | null
          confidence?: number | null
          confirmed_by_user?: boolean
          id?: string
          linked_open_invoice_id?: string | null
          mailbox: Database["public"]["Enums"]["mailbox"]
          message_id: string
          scanned_at?: string
        }
        Update: {
          classification_suggested?:
            | Database["public"]["Enums"]["email_classification"]
            | null
          confidence?: number | null
          confirmed_by_user?: boolean
          id?: string
          linked_open_invoice_id?: string | null
          mailbox?: Database["public"]["Enums"]["mailbox"]
          message_id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_scan_log_linked_open_invoice_id_fkey"
            columns: ["linked_open_invoice_id"]
            isOneToOne: false
            referencedRelation: "open_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          active: boolean
          amount_cents: number
          category: string
          created_at: string
          due_day_of_month: number
          end_date: string | null
          frequency: Database["public"]["Enums"]["expense_frequency"]
          id: string
          name: string
          next_due_date: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category: string
          created_at?: string
          due_day_of_month: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["expense_frequency"]
          id?: string
          name: string
          next_due_date?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category?: string
          created_at?: string
          due_day_of_month?: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["expense_frequency"]
          id?: string
          name?: string
          next_due_date?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          month: string
          receipt_date: string | null
          source: string
          status: Database["public"]["Enums"]["income_status"]
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          month: string
          receipt_date?: string | null
          source: string
          status?: Database["public"]["Enums"]["income_status"]
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          month?: string
          receipt_date?: string | null
          source?: string
          status?: Database["public"]["Enums"]["income_status"]
        }
        Relationships: []
      }
      open_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          due_date: string | null
          email_message_id: string | null
          iban: string | null
          id: string
          purpose: string | null
          receipt_file_id: string | null
          recipient: string
          source: Database["public"]["Enums"]["invoice_source"]
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          email_message_id?: string | null
          iban?: string | null
          id?: string
          purpose?: string | null
          receipt_file_id?: string | null
          recipient: string
          source?: Database["public"]["Enums"]["invoice_source"]
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          email_message_id?: string | null
          iban?: string | null
          id?: string
          purpose?: string | null
          receipt_file_id?: string | null
          recipient?: string
          source?: Database["public"]["Enums"]["invoice_source"]
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_invoices_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "receipt_files"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_files: {
        Row: {
          id: string
          ocr_extracted: Json | null
          pushed_to_buchhaltungsbutler: boolean
          source: Database["public"]["Enums"]["receipt_source"]
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          ocr_extracted?: Json | null
          pushed_to_buchhaltungsbutler?: boolean
          source: Database["public"]["Enums"]["receipt_source"]
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          ocr_extracted?: Json | null
          pushed_to_buchhaltungsbutler?: boolean
          source?: Database["public"]["Enums"]["receipt_source"]
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      variable_expenses: {
        Row: {
          amount_cents: number
          bank_transaction_id: string | null
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          receipt_file_id: string | null
          source: Database["public"]["Enums"]["expense_source"]
        }
        Insert: {
          amount_cents: number
          bank_transaction_id?: string | null
          category: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          receipt_file_id?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
        }
        Update: {
          amount_cents?: number
          bank_transaction_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          receipt_file_id?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
        }
        Relationships: [
          {
            foreignKeyName: "variable_expenses_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "receipt_files"
            referencedColumns: ["id"]
          },
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
      bank_match_status: "unmatched" | "matched" | "ignored"
      email_classification:
        | "open_invoice"
        | "paid_receipt"
        | "reminder"
        | "failed_debit"
        | "irrelevant"
      expense_frequency: "monthly" | "quarterly" | "biannual" | "yearly"
      expense_source: "manual" | "bank_match"
      fixed_expense_category:
        | "Miete"
        | "Internet & Telefon"
        | "Software-Abos"
        | "Steuern"
        | "Darlehen"
        | "Versicherung"
        | "Weiterbildung"
        | "Sonstiger Betriebsbedarf"
        | "Reisekosten"
        | "Leasingkosten"
      income_source:
        | "youtube"
        | "igroove"
        | "knorke"
        | "elysium_or_other"
        | "manus_invoice"
      income_status: "expected" | "received"
      invoice_source: "email" | "photo" | "manual"
      invoice_status: "open" | "paid" | "reminded"
      mailbox: "gmail_main" | "raketone_imap" | "spinnrat_imap"
      receipt_source: "photo_upload" | "email_attachment" | "manual"
      variable_expense_category: "tanken" | "privat"
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
      bank_match_status: ["unmatched", "matched", "ignored"],
      email_classification: [
        "open_invoice",
        "paid_receipt",
        "reminder",
        "failed_debit",
        "irrelevant",
      ],
      expense_frequency: ["monthly", "quarterly", "biannual", "yearly"],
      expense_source: ["manual", "bank_match"],
      fixed_expense_category: [
        "Miete",
        "Internet & Telefon",
        "Software-Abos",
        "Steuern",
        "Darlehen",
        "Versicherung",
        "Weiterbildung",
        "Sonstiger Betriebsbedarf",
        "Reisekosten",
        "Leasingkosten",
      ],
      income_source: [
        "youtube",
        "igroove",
        "knorke",
        "elysium_or_other",
        "manus_invoice",
      ],
      income_status: ["expected", "received"],
      invoice_source: ["email", "photo", "manual"],
      invoice_status: ["open", "paid", "reminded"],
      mailbox: ["gmail_main", "raketone_imap", "spinnrat_imap"],
      receipt_source: ["photo_upload", "email_attachment", "manual"],
      variable_expense_category: ["tanken", "privat"],
    },
  },
} as const
