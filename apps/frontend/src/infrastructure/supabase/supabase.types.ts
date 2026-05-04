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
      academic_years: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_response: string | null
          created_at: string
          expires_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          status: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          actor_name: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          name: string
          order_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          name: string
          order_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string | null
          class_kkm: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          semester_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_id?: string | null
          class_kkm?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          semester_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_id?: string | null
          class_kkm?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          semester_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          assignment_id: string | null
          created_at: string
          grade_type: string
          id: string
          student_id: string
          subject_id: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          grade_type: string
          id?: string
          student_id: string
          subject_id: string
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          grade_type?: string
          id?: string
          student_id?: string
          subject_id?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          guest_user_id: string | null
          id: string
          ip_address: string | null
          shared_link_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          guest_user_id?: string | null
          id?: string
          ip_address?: string | null
          shared_link_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          guest_user_id?: string | null
          id?: string
          ip_address?: string | null
          shared_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_audit_logs_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_audit_logs_shared_link_id_fkey"
            columns: ["shared_link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_users: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean | null
          id: string
          is_registered: boolean | null
          name: string
          password_hash: string | null
          phone_number: string | null
          phone_verified: boolean | null
          totp_enabled: boolean | null
          totp_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean | null
          id?: string
          is_registered?: boolean | null
          name: string
          password_hash?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean | null
          id?: string
          is_registered?: boolean | null
          name?: string
          password_hash?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          guest_user_id: string | null
          id: string
          method: string
          otp_code: string | null
          token: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          guest_user_id?: string | null
          id?: string
          method?: string
          otp_code?: string | null
          token: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          guest_user_id?: string | null
          id?: string
          method?: string
          otp_code?: string | null
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semesters_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          class_id: string
          created_at: string
          expired_at: string
          guest_user_id: string | null
          id: string
          last_used_at: string | null
          revoked: boolean
          subject_id: string
          token: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          expired_at?: string
          guest_user_id?: string | null
          id?: string
          last_used_at?: string | null
          revoked?: boolean
          subject_id: string
          token: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          expired_at?: string
          guest_user_id?: string | null
          id?: string
          last_used_at?: string | null
          revoked?: boolean
          subject_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_bookmarked: boolean | null
          name: string
          nisn: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_bookmarked?: boolean | null
          name: string
          nisn: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_bookmarked?: boolean | null
          name?: string
          nisn?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_custom: boolean | null
          kkm: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_custom?: boolean | null
          kkm?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_custom?: boolean | null
          kkm?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          role: string
          social_links: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          role: string
          social_links?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          role?: string
          social_links?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_verified: boolean | null
          has_completed_onboarding: boolean | null
          id: string
          onboarding_completed_at: string | null
          phone_number: string | null
          phone_verified: boolean | null
          theme_mode: string | null
          theme_palette: string | null
          totp_enabled: boolean | null
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_verified?: boolean | null
          has_completed_onboarding?: boolean | null
          id?: string
          onboarding_completed_at?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          theme_mode?: string | null
          theme_palette?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_verified?: boolean | null
          has_completed_onboarding?: boolean | null
          id?: string
          onboarding_completed_at?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          theme_mode?: string | null
          theme_palette?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_all_user_notifications: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      guest_has_access_via_shared_link: {
        Args: { p_class_id: string; p_subject_id: string }
        Returns: boolean
      }
      user_owns_shared_link: {
        Args: { p_class_id: string; p_subject_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_share_token: {
        Args: { p_token: string }
        Returns: {
          class_id: string
          error_message: string
          id: string
          is_valid: boolean
          subject_id: string
          user_id: string
        }[]
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
    Enums: {},
  },
} as const
