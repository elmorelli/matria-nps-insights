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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_products: {
        Row: {
          account_id: string
          id: string
          mom_stage: Database["public"]["Enums"]["mom_stage"] | null
          product: string
          updated_at: string
        }
        Insert: {
          account_id: string
          id?: string
          mom_stage?: Database["public"]["Enums"]["mom_stage"] | null
          product: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          id?: string
          mom_stage?: Database["public"]["Enums"]["mom_stage"] | null
          product?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          active: boolean
          city: string | null
          country: string | null
          created_at: string
          estimated_annual_revenue: number | null
          iad: string | null
          id: string
          kae: string | null
          logo_url: string | null
          name: string
          notes: string | null
          owner_name: string | null
          segment: string | null
          status: string | null
          tier: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          estimated_annual_revenue?: number | null
          iad?: string | null
          id?: string
          kae?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_name?: string | null
          segment?: string | null
          status?: string | null
          tier?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          estimated_annual_revenue?: number | null
          iad?: string | null
          id?: string
          kae?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_name?: string | null
          segment?: string | null
          status?: string | null
          tier?: string | null
        }
        Relationships: []
      }
      contact_events: {
        Row: {
          contact_id: string
          created_at: string
          cycle_id: string | null
          details: string | null
          event: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          cycle_id?: string | null
          details?: string | null
          event: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          cycle_id?: string | null
          details?: string | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_products: {
        Row: {
          contact_id: string
          id: string
          mom_stage: Database["public"]["Enums"]["mom_stage"] | null
          product: string
        }
        Insert: {
          contact_id: string
          id?: string
          mom_stage?: Database["public"]["Enums"]["mom_stage"] | null
          product: string
        }
        Update: {
          contact_id?: string
          id?: string
          mom_stage?: Database["public"]["Enums"]["mom_stage"] | null
          product?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_products_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_test: boolean
          job_title: string | null
          notes: string | null
          papel: string | null
          phone: string | null
          role: Database["public"]["Enums"]["contact_role"] | null
          status: Database["public"]["Enums"]["contact_status"]
          status_changed_at: string | null
          status_reason: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_test?: boolean
          job_title?: string | null
          notes?: string | null
          papel?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          status?: Database["public"]["Enums"]["contact_status"]
          status_changed_at?: string | null
          status_reason?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_test?: boolean
          job_title?: string | null
          notes?: string | null
          papel?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          status?: Database["public"]["Enums"]["contact_status"]
          status_changed_at?: string | null
          status_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          closed: boolean
          created_at: string
          end_date: string | null
          id: string
          name: string
          questionnaire_id: string | null
          reference_nps: number | null
          reference_response_rate: number | null
          start_date: string
          target_nps: number
          target_response_rate: number
          targets_set_at: string
          template_initial: string
          template_reminder_1: string
          template_reminder_2: string
          template_reminder_3: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          questionnaire_id?: string | null
          reference_nps?: number | null
          reference_response_rate?: number | null
          start_date: string
          target_nps?: number
          target_response_rate?: number
          targets_set_at?: string
          template_initial?: string
          template_reminder_1?: string
          template_reminder_2?: string
          template_reminder_3?: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          questionnaire_id?: string | null
          reference_nps?: number | null
          reference_response_rate?: number | null
          start_date?: string
          target_nps?: number
          target_response_rate?: number
          targets_set_at?: string
          template_initial?: string
          template_reminder_1?: string
          template_reminder_2?: string
          template_reminder_3?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          contact_date: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          owner: string | null
          resolution_date: string | null
          response_id: string
          status: Database["public"]["Enums"]["followup_status"]
        }
        Insert: {
          contact_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          resolution_date?: string | null
          response_id: string
          status?: Database["public"]["Enums"]["followup_status"]
        }
        Update: {
          contact_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          resolution_date?: string | null
          response_id?: string
          status?: Database["public"]["Enums"]["followup_status"]
        }
        Relationships: [
          {
            foreignKeyName: "followups_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          answered_at: string | null
          channel: Database["public"]["Enums"]["invite_channel"]
          contact_id: string
          created_at: string
          cycle_id: string
          id: string
          opened_at: string | null
          reminder_1_at: string | null
          reminder_2_at: string | null
          reminder_3_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          answered_at?: string | null
          channel?: Database["public"]["Enums"]["invite_channel"]
          contact_id: string
          created_at?: string
          cycle_id: string
          id?: string
          opened_at?: string | null
          reminder_1_at?: string | null
          reminder_2_at?: string | null
          reminder_3_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          answered_at?: string | null
          channel?: Database["public"]["Enums"]["invite_channel"]
          contact_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          opened_at?: string | null
          reminder_1_at?: string | null
          reminder_2_at?: string | null
          reminder_3_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      option_lists: {
        Row: {
          active: boolean
          created_at: string
          extra: Json
          id: string
          list: string
          position: number
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          extra?: Json
          id?: string
          list: string
          position?: number
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          extra?: Json
          id?: string
          list?: string
          position?: number
          value?: string
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          version?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          block: string
          block_note: string | null
          id: string
          key: string
          kind: Database["public"]["Enums"]["question_kind"]
          min_chars: number | null
          position: number
          questionnaire_id: string
          required: boolean
          text: string
        }
        Insert: {
          block: string
          block_note?: string | null
          id?: string
          key: string
          kind: Database["public"]["Enums"]["question_kind"]
          min_chars?: number | null
          position: number
          questionnaire_id: string
          required?: boolean
          text: string
        }
        Update: {
          block?: string
          block_note?: string | null
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          min_chars?: number | null
          position?: number
          questionnaire_id?: string
          required?: boolean
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      response_answers: {
        Row: {
          id: string
          not_reached: boolean
          question_id: string | null
          question_key: string
          response_id: string
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          id?: string
          not_reached?: boolean
          question_id?: string | null
          question_key: string
          response_id: string
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          id?: string
          not_reached?: boolean
          question_id?: string | null
          question_key?: string
          response_id?: string
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "response_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          invitation_id: string
          is_test: boolean
          q1_nps: number
          q10: number | null
          q10_not_reached: boolean
          q11_start: string | null
          q12_keep: string | null
          q2_reason: string
          q3: number | null
          q4: number | null
          q5: number | null
          q6: number | null
          q7: number | null
          q8: number | null
          q9: number | null
          q9_not_reached: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          invitation_id: string
          is_test?: boolean
          q1_nps: number
          q10?: number | null
          q10_not_reached?: boolean
          q11_start?: string | null
          q12_keep?: string | null
          q2_reason: string
          q3?: number | null
          q4?: number | null
          q5?: number | null
          q6?: number | null
          q7?: number | null
          q8?: number | null
          q9?: number | null
          q9_not_reached?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          invitation_id?: string
          is_test?: boolean
          q1_nps?: number
          q10?: number | null
          q10_not_reached?: boolean
          q11_start?: string | null
          q12_keep?: string | null
          q2_reason?: string
          q3?: number | null
          q4?: number | null
          q5?: number | null
          q6?: number | null
          q7?: number | null
          q8?: number | null
          q9?: number | null
          q9_not_reached?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          duration_text: string
          id: number
          preview_description: string
          preview_title: string
          program_target_nps: number
          program_target_rate: number
          program_targets_set_at: string
          template_initial: string
          template_reminder_1: string
          template_reminder_2: string
          template_reminder_3: string
        }
        Insert: {
          duration_text?: string
          id?: number
          preview_description?: string
          preview_title?: string
          program_target_nps?: number
          program_target_rate?: number
          program_targets_set_at?: string
          template_initial: string
          template_reminder_1: string
          template_reminder_2: string
          template_reminder_3: string
        }
        Update: {
          duration_text?: string
          id?: number
          preview_description?: string
          preview_title?: string
          program_target_nps?: number
          program_target_rate?: number
          program_targets_set_at?: string
          template_initial?: string
          template_reminder_1?: string
          template_reminder_2?: string
          template_reminder_3?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_business_hours: {
        Args: { _from: string; _hours: number }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      norm_txt: { Args: { _t: string }; Returns: string }
      survey_confirm: { Args: { _token: string }; Returns: Json }
      survey_decline: { Args: { _token: string }; Returns: Json }
      survey_get: { Args: { _token: string }; Returns: Json }
      survey_preview_meta: {
        Args: never
        Returns: {
          description: string
          duration: string
          title: string
        }[]
      }
      survey_status: { Args: { _token: string }; Returns: Json }
      survey_submit: { Args: { _a: Json; _token: string }; Returns: Json }
      survey_submit_by_token: {
        Args: { _a: Json; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin"
      contact_role: "Sponsor" | "Estratégico" | "Champion" | "Hero User"
      contact_status: "active" | "left_organization" | "excluded_from_base"
      followup_status: "to_do" | "in_contact" | "resolved"
      invite_channel: "WhatsApp" | "Email" | "Presencial"
      invite_status: "not_sent" | "sent" | "opened" | "answered" | "invalid"
      mom_stage: "Handoff" | "Implantação" | "Go-live" | "Sustentação"
      question_kind: "nps" | "likert" | "likert_nr" | "text"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
      contact_role: ["Sponsor", "Estratégico", "Champion", "Hero User"],
      contact_status: ["active", "left_organization", "excluded_from_base"],
      followup_status: ["to_do", "in_contact", "resolved"],
      invite_channel: ["WhatsApp", "Email", "Presencial"],
      invite_status: ["not_sent", "sent", "opened", "answered", "invalid"],
      mom_stage: ["Handoff", "Implantação", "Go-live", "Sustentação"],
      question_kind: ["nps", "likert", "likert_nr", "text"],
    },
  },
} as const
