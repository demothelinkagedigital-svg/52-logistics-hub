export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      academy_modules: {
        Row: {
          content: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          is_required: boolean;
          published: boolean;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_required?: boolean;
          published?: boolean;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_required?: boolean;
          published?: boolean;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academy_progress: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          id: string;
          module_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          module_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          module_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academy_progress_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "academy_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          audience: string;
          body: string;
          created_at: string;
          id: string;
          pinned: boolean;
          published: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience?: string;
          body: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          published?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience?: string;
          body?: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          published?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_documents: {
        Row: {
          application_id: string;
          created_at: string;
          doc_type: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          doc_type: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          doc_type?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_employers: {
        Row: {
          application_id: string;
          city: string | null;
          created_at: string;
          employer_name: string;
          end_date: string | null;
          equipment_operated: string | null;
          id: string;
          phone: string | null;
          position_held: string | null;
          reason_for_leaving: string | null;
          sort_order: number;
          start_date: string | null;
          state: string | null;
          was_dot_regulated: boolean;
        };
        Insert: {
          application_id: string;
          city?: string | null;
          created_at?: string;
          employer_name: string;
          end_date?: string | null;
          equipment_operated?: string | null;
          id?: string;
          phone?: string | null;
          position_held?: string | null;
          reason_for_leaving?: string | null;
          sort_order?: number;
          start_date?: string | null;
          state?: string | null;
          was_dot_regulated?: boolean;
        };
        Update: {
          application_id?: string;
          city?: string | null;
          created_at?: string;
          employer_name?: string;
          end_date?: string | null;
          equipment_operated?: string | null;
          id?: string;
          phone?: string | null;
          position_held?: string | null;
          reason_for_leaving?: string | null;
          sort_order?: number;
          start_date?: string | null;
          state?: string | null;
          was_dot_regulated?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "application_employers_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_events: {
        Row: {
          actor_id: string | null;
          application_id: string;
          created_at: string;
          description: string | null;
          event_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          actor_id?: string | null;
          application_id: string;
          created_at?: string;
          description?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          actor_id?: string | null;
          application_id?: string;
          created_at?: string;
          description?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_notes: {
        Row: {
          application_id: string;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
        };
        Insert: {
          application_id: string;
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          application_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          accidents_last_3_years: string | null;
          additional_notes: string | null;
          address_line1: string | null;
          address_line2: string | null;
          age_21_or_older: boolean | null;
          authorized_to_work: boolean | null;
          can_perform_duties: boolean | null;
          cdl_class: string | null;
          cdl_expiration_date: string | null;
          cdl_issue_date: string | null;
          cdl_number: string | null;
          cdl_state: string | null;
          certified: boolean;
          city: string | null;
          completed_steps: number[];
          created_at: string;
          current_step: number;
          date_of_birth: string | null;
          drug_test_details: string | null;
          email: string | null;
          endorsements: string[];
          first_name: string | null;
          how_did_you_hear: string | null;
          id: string;
          job_id: string | null;
          last_name: string | null;
          license_ever_suspended: boolean | null;
          medical_card_expiration: string | null;
          middle_name: string | null;
          phone: string | null;
          position_title: string | null;
          positive_drug_test: boolean | null;
          postal_code: string | null;
          reference_code: string;
          signature_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["application_status"];
          submitted_at: string | null;
          suspension_details: string | null;
          twic_card: boolean;
          updated_at: string;
          user_id: string;
          violations_last_3_years: string | null;
          years_experience: number | null;
        };
        Insert: {
          accidents_last_3_years?: string | null;
          additional_notes?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          age_21_or_older?: boolean | null;
          authorized_to_work?: boolean | null;
          can_perform_duties?: boolean | null;
          cdl_class?: string | null;
          cdl_expiration_date?: string | null;
          cdl_issue_date?: string | null;
          cdl_number?: string | null;
          cdl_state?: string | null;
          certified?: boolean;
          city?: string | null;
          completed_steps?: number[];
          created_at?: string;
          current_step?: number;
          date_of_birth?: string | null;
          drug_test_details?: string | null;
          email?: string | null;
          endorsements?: string[];
          first_name?: string | null;
          how_did_you_hear?: string | null;
          id?: string;
          job_id?: string | null;
          last_name?: string | null;
          license_ever_suspended?: boolean | null;
          medical_card_expiration?: string | null;
          middle_name?: string | null;
          phone?: string | null;
          position_title?: string | null;
          positive_drug_test?: boolean | null;
          postal_code?: string | null;
          reference_code?: string;
          signature_name?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          submitted_at?: string | null;
          suspension_details?: string | null;
          twic_card?: boolean;
          updated_at?: string;
          user_id?: string;
          violations_last_3_years?: string | null;
          years_experience?: number | null;
        };
        Update: {
          accidents_last_3_years?: string | null;
          additional_notes?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          age_21_or_older?: boolean | null;
          authorized_to_work?: boolean | null;
          can_perform_duties?: boolean | null;
          cdl_class?: string | null;
          cdl_expiration_date?: string | null;
          cdl_issue_date?: string | null;
          cdl_number?: string | null;
          cdl_state?: string | null;
          certified?: boolean;
          city?: string | null;
          completed_steps?: number[];
          created_at?: string;
          current_step?: number;
          date_of_birth?: string | null;
          drug_test_details?: string | null;
          email?: string | null;
          endorsements?: string[];
          first_name?: string | null;
          how_did_you_hear?: string | null;
          id?: string;
          job_id?: string | null;
          last_name?: string | null;
          license_ever_suspended?: boolean | null;
          medical_card_expiration?: string | null;
          middle_name?: string | null;
          phone?: string | null;
          position_title?: string | null;
          positive_drug_test?: boolean | null;
          postal_code?: string | null;
          reference_code?: string;
          signature_name?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          submitted_at?: string | null;
          suspension_details?: string | null;
          twic_card?: boolean;
          updated_at?: string;
          user_id?: string;
          violations_last_3_years?: string | null;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      drivers: {
        Row: {
          application_id: string | null;
          created_at: string;
          driver_code: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          hire_date: string | null;
          id: string;
          position_title: string | null;
          status: Database["public"]["Enums"]["driver_status"];
          terminal: string;
          truck_number: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          driver_code?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          hire_date?: string | null;
          id?: string;
          position_title?: string | null;
          status?: Database["public"]["Enums"]["driver_status"];
          terminal?: string;
          truck_number?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          driver_code?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          hire_date?: string | null;
          id?: string;
          position_title?: string | null;
          status?: Database["public"]["Enums"]["driver_status"];
          terminal?: string;
          truck_number?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drivers_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      esign_records: {
        Row: {
          application_id: string;
          completed_at: string | null;
          created_at: string;
          document_name: string;
          envelope_reference: string | null;
          id: string;
          notes: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["esign_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          application_id: string;
          completed_at?: string | null;
          created_at?: string;
          document_name?: string;
          envelope_reference?: string | null;
          id?: string;
          notes?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["esign_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          application_id?: string;
          completed_at?: string | null;
          created_at?: string;
          document_name?: string;
          envelope_reference?: string | null;
          id?: string;
          notes?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["esign_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "esign_records_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      faqs: {
        Row: {
          answer: string;
          id: string;
          published: boolean;
          question: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          answer: string;
          id?: string;
          published?: boolean;
          question: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          id?: string;
          published?: boolean;
          question?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      handbook_sections: {
        Row: {
          body: string;
          category: string;
          id: string;
          published: boolean;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          category?: string;
          id?: string;
          published?: boolean;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string;
          id?: string;
          published?: boolean;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          archived_at: string | null;
          benefits_notes: string | null;
          created_at: string;
          days: string;
          equipment_notes: string | null;
          id: string;
          location: string;
          pay_notes: string | null;
          position: string;
          published: boolean;
          requirements: string[];
          schedule: string;
          slug: string;
          sort_order: number;
          status: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          benefits_notes?: string | null;
          created_at?: string;
          days: string;
          equipment_notes?: string | null;
          id?: string;
          location?: string;
          pay_notes?: string | null;
          position: string;
          published?: boolean;
          requirements?: string[];
          schedule: string;
          slug: string;
          sort_order?: number;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          benefits_notes?: string | null;
          created_at?: string;
          days?: string;
          equipment_notes?: string | null;
          id?: string;
          location?: string;
          pay_notes?: string | null;
          position?: string;
          published?: boolean;
          requirements?: string[];
          schedule?: string;
          slug?: string;
          sort_order?: number;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_content: {
        Row: {
          approval_status: string;
          body: string | null;
          heading: string | null;
          id: string;
          page_key: string;
          published: boolean;
          section_key: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          approval_status?: string;
          body?: string | null;
          heading?: string | null;
          id?: string;
          page_key: string;
          published?: boolean;
          section_key: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          approval_status?: string;
          body?: string | null;
          heading?: string | null;
          id?: string;
          page_key?: string;
          published?: boolean;
          section_key?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          preferred_name: string | null;
          status: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          preferred_name?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          preferred_name?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      safety_acknowledgements: {
        Row: {
          acknowledged_at: string;
          id: string;
          resource_id: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          id?: string;
          resource_id: string;
          user_id?: string;
        };
        Update: {
          acknowledged_at?: string;
          id?: string;
          resource_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_acknowledgements_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "safety_resources";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_resources: {
        Row: {
          body: string | null;
          category: string;
          id: string;
          published: boolean;
          requires_acknowledgement: boolean;
          sort_order: number;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          category?: string;
          id?: string;
          published?: boolean;
          requires_acknowledgement?: boolean;
          sort_order?: number;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          category?: string;
          id?: string;
          published?: boolean;
          requires_acknowledgement?: boolean;
          sort_order?: number;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      screening_records: {
        Row: {
          application_id: string;
          created_at: string;
          id: string;
          initiated_at: string | null;
          notes: string | null;
          reference_number: string | null;
          status: Database["public"]["Enums"]["screening_status"];
          status_updated_at: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          id?: string;
          initiated_at?: string | null;
          notes?: string | null;
          reference_number?: string | null;
          status?: Database["public"]["Enums"]["screening_status"];
          status_updated_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          id?: string;
          initiated_at?: string | null;
          notes?: string | null;
          reference_number?: string | null;
          status?: Database["public"]["Enums"]["screening_status"];
          status_updated_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screening_records_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          group_name: string;
          is_public: boolean;
          key: string;
          label: string | null;
          needs_verification: boolean;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          group_name?: string;
          is_public?: boolean;
          key: string;
          label?: string | null;
          needs_verification?: boolean;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          group_name?: string;
          is_public?: boolean;
          key?: string;
          label?: string | null;
          needs_verification?: boolean;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      social_links: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          platform: string;
          sort_order: number;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          platform: string;
          sort_order?: number;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          platform?: string;
          sort_order?: number;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_content_staff: { Args: { _user_id: string }; Returns: boolean };
      is_recruiting_staff: { Args: { _user_id: string }; Returns: boolean };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role:
        "administrator" | "recruiter" | "content_manager" | "driver" | "applicant" | "developer";
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "screening"
        | "interview"
        | "conditional_offer"
        | "background_check"
        | "onboarding"
        | "hired"
        | "rejected"
        | "withdrawn";
      driver_status: "onboarding" | "active" | "inactive" | "terminated";
      esign_status: "not_sent" | "sent" | "viewed" | "completed" | "declined" | "voided";
      screening_status:
        | "not_started"
        | "initiated"
        | "pending"
        | "clear"
        | "review_required"
        | "failed"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "administrator",
        "recruiter",
        "content_manager",
        "driver",
        "applicant",
        "developer",
      ],
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "screening",
        "interview",
        "conditional_offer",
        "background_check",
        "onboarding",
        "hired",
        "rejected",
        "withdrawn",
      ],
      driver_status: ["onboarding", "active", "inactive", "terminated"],
      esign_status: ["not_sent", "sent", "viewed", "completed", "declined", "voided"],
      screening_status: [
        "not_started",
        "initiated",
        "pending",
        "clear",
        "review_required",
        "failed",
        "cancelled",
      ],
    },
  },
} as const;
