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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      accounting_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          parent_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_event_templates: {
        Row: {
          auto_post_allowed: boolean
          business_event_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          required_fields: string[]
          requires_review: boolean
          source_module: string
          standard_profile: string
          template_lines: Json
          template_name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          auto_post_allowed?: boolean
          business_event_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          required_fields?: string[]
          requires_review?: boolean
          source_module?: string
          standard_profile?: string
          template_lines?: Json
          template_name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_post_allowed?: boolean
          business_event_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          required_fields?: string[]
          requires_review?: boolean
          source_module?: string
          standard_profile?: string
          template_lines?: Json
          template_name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_event_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_event_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_outbox: {
        Row: {
          created_at: string
          event_type: string
          id: string
          journal_entry_id: string | null
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          reference_id: string
          reference_type: string
          retry_count: number
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          journal_entry_id?: string | null
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload: Json
          processed_at?: string | null
          reference_id: string
          reference_type: string
          retry_count?: number
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          journal_entry_id?: string | null
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          reference_id?: string
          reference_type?: string
          retry_count?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_outbox_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_review_queue: {
        Row: {
          business_event_type: string | null
          created_at: string
          id: string
          message: string
          missing_fields: string[]
          payload: Json
          reason_code: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_id: string
          source_table: string
          status: string
          suggested_template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_event_type?: string | null
          created_at?: string
          id?: string
          message: string
          missing_fields?: string[]
          payload?: Json
          reason_code: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id: string
          source_table: string
          status?: string
          suggested_template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_event_type?: string | null
          created_at?: string
          id?: string
          message?: string
          missing_fields?: string[]
          payload?: Json
          reason_code?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id?: string
          source_table?: string
          status?: string
          suggested_template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_review_queue_suggested_template_id_fkey"
            columns: ["suggested_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_worker_runs: {
        Row: {
          claimed_count: number
          created_at: string
          critical_failure_count: number
          dead_letter_count: number
          details: Json
          duration_ms: number
          error: string | null
          failure_count: number
          finished_at: string
          id: string
          started_at: string
          status: string
          success_count: number
          tenant_ids: string[]
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          critical_failure_count?: number
          dead_letter_count?: number
          details?: Json
          duration_ms?: number
          error?: string | null
          failure_count?: number
          finished_at: string
          id?: string
          started_at: string
          status: string
          success_count?: number
          tenant_ids?: string[]
        }
        Update: {
          claimed_count?: number
          created_at?: string
          critical_failure_count?: number
          dead_letter_count?: number
          details?: Json
          duration_ms?: number
          error?: string | null
          failure_count?: number
          finished_at?: string
          id?: string
          started_at?: string
          status?: string
          success_count?: number
          tenant_ids?: string[]
        }
        Relationships: []
      }
      ai_agent_configs: {
        Row: {
          created_at: string
          gemini_api_key: string | null
          id: string
          is_active: boolean | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gemini_api_key?: string | null
          id?: string
          is_active?: boolean | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gemini_api_key?: string | null
          id?: string
          is_active?: boolean | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ai_agent_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          sender: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          sender: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          sender?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ai_agent_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_partners: {
        Row: {
          allowed_scopes: string[]
          api_key: string
          api_secret: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          failed_requests_count: number
          id: string
          is_active: boolean
          is_sandbox: boolean
          last_error_at: string | null
          last_error_message: string | null
          last_request_at: string | null
          metadata: Json | null
          notes: string | null
          partner_description: string | null
          partner_name: string
          partner_type: string
          rate_limit_burst: number
          rate_limit_per_day: number
          rate_limit_per_minute: number
          rate_limit_tier: string
          tenant_id: string
          total_requests_count: number
          updated_at: string
          updated_by: string | null
          webhook_events: string[] | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          allowed_scopes?: string[]
          api_key: string
          api_secret?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          failed_requests_count?: number
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_request_at?: string | null
          metadata?: Json | null
          notes?: string | null
          partner_description?: string | null
          partner_name: string
          partner_type: string
          rate_limit_burst?: number
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          rate_limit_tier?: string
          tenant_id: string
          total_requests_count?: number
          updated_at?: string
          updated_by?: string | null
          webhook_events?: string[] | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          allowed_scopes?: string[]
          api_key?: string
          api_secret?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          failed_requests_count?: number
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_request_at?: string | null
          metadata?: Json | null
          notes?: string | null
          partner_description?: string | null
          partner_name?: string
          partner_type?: string
          rate_limit_burst?: number
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          rate_limit_tier?: string
          tenant_id?: string
          total_requests_count?: number
          updated_at?: string
          updated_by?: string | null
          webhook_events?: string[] | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "api_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limit_counters: {
        Row: {
          created_at: string
          error_count: number
          id: string
          partner_id: string
          request_count: number
          updated_at: string
          window_start: string
          window_type: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          id?: string
          partner_id: string
          request_count?: number
          updated_at?: string
          window_start: string
          window_type: string
        }
        Update: {
          created_at?: string
          error_count?: number
          id?: string
          partner_id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
          window_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limit_counters_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partner_usage_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "api_rate_limit_counters_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_code: string | null
          error_message: string | null
          error_stack: string | null
          id: string
          idempotency_key: string | null
          ip_address: unknown
          is_error: boolean
          metadata: Json | null
          method: string
          partner_id: string
          query_params: Json | null
          rate_limit_remaining: number | null
          rate_limit_reset_at: string | null
          request_body: Json | null
          request_headers: Json | null
          request_id: string | null
          response_body: Json | null
          response_time_ms: number
          status_code: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: unknown
          is_error?: boolean
          metadata?: Json | null
          method: string
          partner_id: string
          query_params?: Json | null
          rate_limit_remaining?: number | null
          rate_limit_reset_at?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id?: string | null
          response_body?: Json | null
          response_time_ms: number
          status_code: number
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: unknown
          is_error?: boolean
          metadata?: Json | null
          method?: string
          partner_id?: string
          query_params?: Json | null
          rate_limit_remaining?: number | null
          rate_limit_reset_at?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id?: string | null
          response_body?: Json | null
          response_time_ms?: number
          status_code?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partner_usage_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "api_request_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "api_request_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "app_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          checkin_time: string | null
          checkout_time: string | null
          date: string
          id: string
          ktv_id: string
          shift_id: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          checkin_time?: string | null
          checkout_time?: string | null
          date: string
          id?: string
          ktv_id: string
          shift_id?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          checkin_time?: string | null
          checkout_time?: string | null
          date?: string
          id?: string
          ktv_id?: string
          shift_id?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "attendance_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_by_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Insert: {
          action: string
          changed_by_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Update: {
          action?: string
          changed_by_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "audit_logs_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_ai_insights: {
        Row: {
          action_result: string | null
          action_taken: boolean | null
          action_taken_at: string | null
          action_taken_by: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          expires_at: string | null
          id: string
          insight_details: Json | null
          insight_summary: string
          insight_title: string
          insight_type: string
          journey_id: string | null
          lead_id: string | null
          model_name: string | null
          model_version: string | null
          priority: string | null
          query_intent: string | null
          query_parameters: Json | null
          query_text: string | null
          sale_id: string | null
          status: string
          suggested_actions: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_result?: string | null
          action_taken?: boolean | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          insight_details?: Json | null
          insight_summary: string
          insight_title: string
          insight_type: string
          journey_id?: string | null
          lead_id?: string | null
          model_name?: string | null
          model_version?: string | null
          priority?: string | null
          query_intent?: string | null
          query_parameters?: Json | null
          query_text?: string | null
          sale_id?: string | null
          status?: string
          suggested_actions?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_result?: string | null
          action_taken?: boolean | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          insight_details?: Json | null
          insight_summary?: string
          insight_title?: string
          insight_type?: string
          journey_id?: string | null
          lead_id?: string | null
          model_name?: string | null
          model_version?: string | null
          priority?: string | null
          query_intent?: string | null
          query_parameters?: Json | null
          query_text?: string | null
          sale_id?: string | null
          status?: string
          suggested_actions?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      auto_bookings: {
        Row: {
          accounting_entry_id: string | null
          booking_number: string
          color_exterior: string
          created_at: string
          customer_id: string
          deposit_amount: number
          deposit_paid: number
          id: string
          lead_id: string | null
          metadata: Json
          payment_status: string
          status: string
          tenant_id: string
          total_price: number
          updated_at: string
          variant_id: string
          vehicle_id: string | null
        }
        Insert: {
          accounting_entry_id?: string | null
          booking_number: string
          color_exterior: string
          created_at?: string
          customer_id: string
          deposit_amount?: number
          deposit_paid?: number
          id?: string
          lead_id?: string | null
          metadata?: Json
          payment_status?: string
          status?: string
          tenant_id: string
          total_price?: number
          updated_at?: string
          variant_id: string
          vehicle_id?: string | null
        }
        Update: {
          accounting_entry_id?: string | null
          booking_number?: string
          color_exterior?: string
          created_at?: string
          customer_id?: string
          deposit_amount?: number
          deposit_paid?: number
          id?: string
          lead_id?: string | null
          metadata?: Json
          payment_status?: string
          status?: string
          tenant_id?: string
          total_price?: number
          updated_at?: string
          variant_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "auto_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_bookings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "auto_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_bookings_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          customer_id: string | null
          deposit_amount: number | null
          id: string
          status: string
          tenant_id: string
          total_price: number | null
          valid_from: string
          valid_to: string
          variant_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          customer_id?: string | null
          deposit_amount?: number | null
          id: string
          status: string
          tenant_id: string
          total_price?: number | null
          valid_from: string
          valid_to?: string
          variant_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          customer_id?: string | null
          deposit_amount?: number | null
          id?: string
          status?: string
          tenant_id?: string
          total_price?: number | null
          valid_from?: string
          valid_to?: string
          variant_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_bookings_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_bookings_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_brands: {
        Row: {
          country_of_origin: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          country_of_origin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          country_of_origin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_business_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          rollback_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          status: Database["public"]["Enums"]["auto_business_transaction_status"]
          tenant_id: string
          transaction_type: Database["public"]["Enums"]["auto_business_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: Database["public"]["Enums"]["auto_business_transaction_status"]
          tenant_id: string
          transaction_type: Database["public"]["Enums"]["auto_business_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: Database["public"]["Enums"]["auto_business_transaction_status"]
          tenant_id?: string
          transaction_type?: Database["public"]["Enums"]["auto_business_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "auto_business_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_business_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_business_transactions_rolled_back_by_fkey"
            columns: ["rolled_back_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_business_transactions_rolled_back_by_fkey"
            columns: ["rolled_back_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_business_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_business_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_churn_predictions: {
        Row: {
          action_date: string | null
          action_result: string | null
          action_taken: boolean | null
          action_type: string | null
          average_repair_cost: number | null
          average_visit_frequency_days: number | null
          churn_probability: number
          churn_risk_level: string
          created_at: string
          csi_score: number | null
          customer_id: string
          days_since_last_service: number | null
          estimated_days_to_churn: number | null
          estimated_retention_cost: number | null
          factors: Json
          id: string
          model_confidence: number | null
          model_name: string | null
          model_version: string | null
          nps_score: number | null
          prediction_date: string
          primary_reason: string | null
          recommended_actions: Json | null
          retention_strategy: string | null
          status: string
          tenant_id: string
          total_lifetime_value: number | null
          total_service_visits: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          action_date?: string | null
          action_result?: string | null
          action_taken?: boolean | null
          action_type?: string | null
          average_repair_cost?: number | null
          average_visit_frequency_days?: number | null
          churn_probability: number
          churn_risk_level: string
          created_at?: string
          csi_score?: number | null
          customer_id: string
          days_since_last_service?: number | null
          estimated_days_to_churn?: number | null
          estimated_retention_cost?: number | null
          factors: Json
          id?: string
          model_confidence?: number | null
          model_name?: string | null
          model_version?: string | null
          nps_score?: number | null
          prediction_date?: string
          primary_reason?: string | null
          recommended_actions?: Json | null
          retention_strategy?: string | null
          status?: string
          tenant_id: string
          total_lifetime_value?: number | null
          total_service_visits?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          action_date?: string | null
          action_result?: string | null
          action_taken?: boolean | null
          action_type?: string | null
          average_repair_cost?: number | null
          average_visit_frequency_days?: number | null
          churn_probability?: number
          churn_risk_level?: string
          created_at?: string
          csi_score?: number | null
          customer_id?: string
          days_since_last_service?: number | null
          estimated_days_to_churn?: number | null
          estimated_retention_cost?: number | null
          factors?: Json
          id?: string
          model_confidence?: number | null
          model_name?: string | null
          model_version?: string | null
          nps_score?: number | null
          prediction_date?: string
          primary_reason?: string | null
          recommended_actions?: Json | null
          retention_strategy?: string | null
          status?: string
          tenant_id?: string
          total_lifetime_value?: number | null
          total_service_visits?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      auto_csi_scores: {
        Row: {
          after_sales_score: number | null
          created_at: string | null
          customer_id: string
          delivery_timing_score: number | null
          facility_score: number | null
          id: string
          improvement_suggestions: string | null
          journey_id: string | null
          negative_feedback: string | null
          overall_csi: number
          positive_feedback: string | null
          recorded_at: string | null
          sales_consultant_id: string | null
          sales_consultant_score: number | null
          survey_id: string
          survey_type: string
          tenant_id: string
          vehicle_id: string | null
          vehicle_quality_score: number | null
        }
        Insert: {
          after_sales_score?: number | null
          created_at?: string | null
          customer_id: string
          delivery_timing_score?: number | null
          facility_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          journey_id?: string | null
          negative_feedback?: string | null
          overall_csi: number
          positive_feedback?: string | null
          recorded_at?: string | null
          sales_consultant_id?: string | null
          sales_consultant_score?: number | null
          survey_id: string
          survey_type: string
          tenant_id: string
          vehicle_id?: string | null
          vehicle_quality_score?: number | null
        }
        Update: {
          after_sales_score?: number | null
          created_at?: string | null
          customer_id?: string
          delivery_timing_score?: number | null
          facility_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          journey_id?: string | null
          negative_feedback?: string | null
          overall_csi?: number
          positive_feedback?: string | null
          recorded_at?: string | null
          sales_consultant_id?: string | null
          sales_consultant_score?: number | null
          survey_id?: string
          survey_type?: string
          tenant_id?: string
          vehicle_id?: string | null
          vehicle_quality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_csi_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_csi_scores_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_csi_scores_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "auto_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_csi_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_csi_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_csi_scores_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_customer_health_scores: {
        Row: {
          calculated_at: string | null
          calculation_version: string | null
          created_at: string | null
          customer_id: string
          days_since_last_interaction: number | null
          engagement_score: number | null
          health_status: string
          id: string
          last_interaction_date: string | null
          last_purchase_date: string | null
          last_service_date: string | null
          loyalty_score: number | null
          overall_health_score: number
          revenue_score: number | null
          risk_factors: Json | null
          satisfaction_score: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          calculated_at?: string | null
          calculation_version?: string | null
          created_at?: string | null
          customer_id: string
          days_since_last_interaction?: number | null
          engagement_score?: number | null
          health_status: string
          id?: string
          last_interaction_date?: string | null
          last_purchase_date?: string | null
          last_service_date?: string | null
          loyalty_score?: number | null
          overall_health_score: number
          revenue_score?: number | null
          risk_factors?: Json | null
          satisfaction_score?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          calculated_at?: string | null
          calculation_version?: string | null
          created_at?: string | null
          customer_id?: string
          days_since_last_interaction?: number | null
          engagement_score?: number | null
          health_status?: string
          id?: string
          last_interaction_date?: string | null
          last_purchase_date?: string | null
          last_service_date?: string | null
          loyalty_score?: number | null
          overall_health_score?: number
          revenue_score?: number | null
          risk_factors?: Json | null
          satisfaction_score?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_customer_health_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_customer_health_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_customer_health_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_customer_journeys: {
        Row: {
          created_at: string
          current_stage_id: string
          customer_id: string
          entered_stage_at: string
          id: string
          metadata: Json
          sla_deadline: string | null
          sla_status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stage_id: string
          customer_id: string
          entered_stage_at?: string
          id?: string
          metadata?: Json
          sla_deadline?: string | null
          sla_status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stage_id?: string
          customer_id?: string
          entered_stage_at?: string
          id?: string
          metadata?: Json
          sla_deadline?: string | null
          sla_status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_customer_journeys_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "auto_journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_customer_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_customer_journeys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_customer_journeys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_customer_journeys_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          current_stage_id: string | null
          customer_id: string | null
          entered_stage_at: string | null
          id: string
          sla_deadline: string | null
          sla_status: string | null
          tenant_id: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          current_stage_id?: string | null
          customer_id?: string | null
          entered_stage_at?: string | null
          id: string
          sla_deadline?: string | null
          sla_status?: string | null
          tenant_id: string
          valid_from: string
          valid_to?: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          current_stage_id?: string | null
          customer_id?: string | null
          entered_stage_at?: string | null
          id?: string
          sla_deadline?: string | null
          sla_status?: string | null
          tenant_id?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_customer_journeys_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_customer_journeys_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_customer_lifetime_events: {
        Row: {
          cost_amount: number | null
          created_at: string
          created_by: string | null
          csi_score: number | null
          customer_id: string
          event_date: string
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          is_milestone: boolean | null
          journey_id: string | null
          nps_score: number | null
          profit_amount: number | null
          repair_order_id: string | null
          revenue_amount: number | null
          sale_id: string | null
          sentiment: string | null
          service_appointment_id: string | null
          tags: string[] | null
          tenant_id: string
          vehicle_id: string | null
        }
        Insert: {
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          csi_score?: number | null
          customer_id: string
          event_date: string
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          is_milestone?: boolean | null
          journey_id?: string | null
          nps_score?: number | null
          profit_amount?: number | null
          repair_order_id?: string | null
          revenue_amount?: number | null
          sale_id?: string | null
          sentiment?: string | null
          service_appointment_id?: string | null
          tags?: string[] | null
          tenant_id: string
          vehicle_id?: string | null
        }
        Update: {
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          csi_score?: number | null
          customer_id?: string
          event_date?: string
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          is_milestone?: boolean | null
          journey_id?: string | null
          nps_score?: number | null
          profit_amount?: number | null
          repair_order_id?: string | null
          revenue_amount?: number | null
          sale_id?: string | null
          sentiment?: string | null
          service_appointment_id?: string | null
          tags?: string[] | null
          tenant_id?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      auto_customer_profiles: {
        Row: {
          budget_range: string | null
          created_at: string
          customer_id: string
          id: string
          metadata: Json
          preferred_brands: string[] | null
          preferred_segments: string[] | null
          purchasing_purpose: string | null
          tenant_id: string
          total_value_spent: number
          total_vehicles_owned: number
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json
          preferred_brands?: string[] | null
          preferred_segments?: string[] | null
          purchasing_purpose?: string | null
          tenant_id: string
          total_value_spent?: number
          total_vehicles_owned?: number
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json
          preferred_brands?: string[] | null
          preferred_segments?: string[] | null
          purchasing_purpose?: string | null
          tenant_id?: string
          total_value_spent?: number
          total_vehicles_owned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_customer_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_customer_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_customer_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_demand_forecasts: {
        Row: {
          available: number | null
          color: string | null
          confidence_level: number | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          features_used: Json | null
          forecast_date: string
          forecast_period: string
          historical_avg_monthly_sales: number | null
          id: string
          in_transit: number | null
          make: string
          model: string | null
          model_accuracy: number | null
          model_name: string | null
          model_version: string | null
          period_end: string
          period_start: string
          predicted_demand: number
          predicted_demand_max: number | null
          predicted_demand_min: number | null
          recommended_order_date: string | null
          recommended_order_quantity: number | null
          reserved: number | null
          seasonality_factor: number | null
          status: string
          tenant_id: string
          trend_direction: string | null
          urgency: string | null
          variant: string | null
        }
        Insert: {
          available?: number | null
          color?: string | null
          confidence_level?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          features_used?: Json | null
          forecast_date: string
          forecast_period: string
          historical_avg_monthly_sales?: number | null
          id?: string
          in_transit?: number | null
          make: string
          model?: string | null
          model_accuracy?: number | null
          model_name?: string | null
          model_version?: string | null
          period_end: string
          period_start: string
          predicted_demand: number
          predicted_demand_max?: number | null
          predicted_demand_min?: number | null
          recommended_order_date?: string | null
          recommended_order_quantity?: number | null
          reserved?: number | null
          seasonality_factor?: number | null
          status?: string
          tenant_id: string
          trend_direction?: string | null
          urgency?: string | null
          variant?: string | null
        }
        Update: {
          available?: number | null
          color?: string | null
          confidence_level?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          features_used?: Json | null
          forecast_date?: string
          forecast_period?: string
          historical_avg_monthly_sales?: number | null
          id?: string
          in_transit?: number | null
          make?: string
          model?: string | null
          model_accuracy?: number | null
          model_name?: string | null
          model_version?: string | null
          period_end?: string
          period_start?: string
          predicted_demand?: number
          predicted_demand_max?: number | null
          predicted_demand_min?: number | null
          recommended_order_date?: string | null
          recommended_order_quantity?: number | null
          reserved?: number | null
          seasonality_factor?: number | null
          status?: string
          tenant_id?: string
          trend_direction?: string | null
          urgency?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      auto_insurance_policies: {
        Row: {
          auto_renewal: boolean | null
          beneficiary_name: string | null
          beneficiary_relationship: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          certificate_url: string | null
          commission_paid: boolean | null
          commission_paid_date: string | null
          coverage_amount: number | null
          coverage_items: Json | null
          created_at: string
          created_by: string | null
          customer_id: string
          deductible_amount: number | null
          effective_date: string
          expiry_date: string
          id: string
          insurance_agent_name: string | null
          insurance_agent_phone: string | null
          insurance_branch: string | null
          insurance_company: string
          is_active: boolean | null
          notes: string | null
          policy_document_url: string | null
          policy_number: string
          policy_type: string
          premium_amount: number
          premium_payment_frequency: string | null
          referral_commission_amount: number | null
          referral_commission_percentage: number | null
          renewal_reminder_date: string | null
          renewal_reminder_sent: boolean | null
          sale_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          auto_renewal?: boolean | null
          beneficiary_name?: string | null
          beneficiary_relationship?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_url?: string | null
          commission_paid?: boolean | null
          commission_paid_date?: string | null
          coverage_amount?: number | null
          coverage_items?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deductible_amount?: number | null
          effective_date: string
          expiry_date: string
          id?: string
          insurance_agent_name?: string | null
          insurance_agent_phone?: string | null
          insurance_branch?: string | null
          insurance_company: string
          is_active?: boolean | null
          notes?: string | null
          policy_document_url?: string | null
          policy_number: string
          policy_type: string
          premium_amount: number
          premium_payment_frequency?: string | null
          referral_commission_amount?: number | null
          referral_commission_percentage?: number | null
          renewal_reminder_date?: string | null
          renewal_reminder_sent?: boolean | null
          sale_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          auto_renewal?: boolean | null
          beneficiary_name?: string | null
          beneficiary_relationship?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_url?: string | null
          commission_paid?: boolean | null
          commission_paid_date?: string | null
          coverage_amount?: number | null
          coverage_items?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deductible_amount?: number | null
          effective_date?: string
          expiry_date?: string
          id?: string
          insurance_agent_name?: string | null
          insurance_agent_phone?: string | null
          insurance_branch?: string | null
          insurance_company?: string
          is_active?: boolean | null
          notes?: string | null
          policy_document_url?: string | null
          policy_number?: string
          policy_type?: string
          premium_amount?: number
          premium_payment_frequency?: string | null
          referral_commission_amount?: number | null
          referral_commission_percentage?: number | null
          renewal_reminder_date?: string | null
          renewal_reminder_sent?: boolean | null
          sale_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      auto_journey_events: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          duration_hours: number | null
          from_stage_id: string | null
          id: string
          journey_id: string
          metadata: Json
          reason: string | null
          tenant_id: string
          to_stage_id: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          duration_hours?: number | null
          from_stage_id?: string | null
          id?: string
          journey_id: string
          metadata?: Json
          reason?: string | null
          tenant_id: string
          to_stage_id: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          duration_hours?: number | null
          from_stage_id?: string | null
          id?: string
          journey_id?: string
          metadata?: Json
          reason?: string | null
          tenant_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_journey_events_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_journey_events_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_journey_events_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "auto_journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_journey_events_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_journey_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_journey_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_journey_events_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "auto_journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_journey_stages: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sla_hours: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sla_hours?: number | null
          sort_order: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sla_hours?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_journey_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_journey_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_leads: {
        Row: {
          assigned_at: string | null
          assigned_sales_agent_id: string | null
          budget_limit: number | null
          created_at: string
          customer_id: string
          id: string
          lost_reason: string | null
          metadata: Json
          notes: string | null
          preferred_color: string | null
          preferred_variant_id: string | null
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_sales_agent_id?: string | null
          budget_limit?: number | null
          created_at?: string
          customer_id: string
          id?: string
          lost_reason?: string | null
          metadata?: Json
          notes?: string | null
          preferred_color?: string | null
          preferred_variant_id?: string | null
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_sales_agent_id?: string | null
          budget_limit?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          lost_reason?: string | null
          metadata?: Json
          notes?: string | null
          preferred_color?: string | null
          preferred_variant_id?: string | null
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_leads_assigned_sales_agent_id_fkey"
            columns: ["assigned_sales_agent_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_leads_assigned_sales_agent_id_fkey"
            columns: ["assigned_sales_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_leads_preferred_variant_id_fkey"
            columns: ["preferred_variant_id"]
            isOneToOne: false
            referencedRelation: "auto_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_loan_applications: {
        Row: {
          application_date: string
          application_number: string
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          approved_interest_rate: number | null
          approved_term_months: number | null
          bank_branch: string | null
          bank_contact_person: string | null
          bank_contact_phone: string | null
          bank_name: string
          bank_notes: string | null
          commission_paid: boolean | null
          commission_paid_date: string | null
          created_at: string
          created_by: string | null
          customer_credit_score: number | null
          customer_employment_type: string | null
          customer_id: string
          customer_income_monthly: number | null
          disbursed_at: string | null
          documents_checklist: Json | null
          down_payment: number
          id: string
          interest_rate: number
          internal_notes: string | null
          loan_amount: number
          loan_term_months: number
          monthly_payment: number | null
          referral_commission_amount: number | null
          referral_commission_percentage: number | null
          rejection_date: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          sale_id: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          application_date?: string
          application_number: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_interest_rate?: number | null
          approved_term_months?: number | null
          bank_branch?: string | null
          bank_contact_person?: string | null
          bank_contact_phone?: string | null
          bank_name: string
          bank_notes?: string | null
          commission_paid?: boolean | null
          commission_paid_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_credit_score?: number | null
          customer_employment_type?: string | null
          customer_id: string
          customer_income_monthly?: number | null
          disbursed_at?: string | null
          documents_checklist?: Json | null
          down_payment: number
          id?: string
          interest_rate: number
          internal_notes?: string | null
          loan_amount: number
          loan_term_months: number
          monthly_payment?: number | null
          referral_commission_amount?: number | null
          referral_commission_percentage?: number | null
          rejection_date?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          sale_id?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          application_date?: string
          application_number?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_interest_rate?: number | null
          approved_term_months?: number | null
          bank_branch?: string | null
          bank_contact_person?: string | null
          bank_contact_phone?: string | null
          bank_name?: string
          bank_notes?: string | null
          commission_paid?: boolean | null
          commission_paid_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_credit_score?: number | null
          customer_employment_type?: string | null
          customer_id?: string
          customer_income_monthly?: number | null
          disbursed_at?: string | null
          documents_checklist?: Json | null
          down_payment?: number
          id?: string
          interest_rate?: number
          internal_notes?: string | null
          loan_amount?: number
          loan_term_months?: number
          monthly_payment?: number | null
          referral_commission_amount?: number | null
          referral_commission_percentage?: number | null
          rejection_date?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          sale_id?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      auto_lost_analysis: {
        Row: {
          ai_analysis_result: Json | null
          ai_analyzed: boolean | null
          ai_prevention_suggestions: Json | null
          competitor_brand: string | null
          competitor_model: string | null
          competitor_price: number | null
          consultant_notes: string | null
          created_at: string | null
          customer_feedback: string | null
          customer_id: string
          id: string
          journey_id: string
          lost_at_stage: string
          lost_date: string
          price_difference: number | null
          primary_reason: string
          recovery_attempted: boolean | null
          recovery_notes: string | null
          recovery_outcome: string | null
          sales_consultant_id: string | null
          secondary_reasons: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_analysis_result?: Json | null
          ai_analyzed?: boolean | null
          ai_prevention_suggestions?: Json | null
          competitor_brand?: string | null
          competitor_model?: string | null
          competitor_price?: number | null
          consultant_notes?: string | null
          created_at?: string | null
          customer_feedback?: string | null
          customer_id: string
          id?: string
          journey_id: string
          lost_at_stage: string
          lost_date: string
          price_difference?: number | null
          primary_reason: string
          recovery_attempted?: boolean | null
          recovery_notes?: string | null
          recovery_outcome?: string | null
          sales_consultant_id?: string | null
          secondary_reasons?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_analysis_result?: Json | null
          ai_analyzed?: boolean | null
          ai_prevention_suggestions?: Json | null
          competitor_brand?: string | null
          competitor_model?: string | null
          competitor_price?: number | null
          consultant_notes?: string | null
          created_at?: string | null
          customer_feedback?: string | null
          customer_id?: string
          id?: string
          journey_id?: string
          lost_at_stage?: string
          lost_date?: string
          price_difference?: number | null
          primary_reason?: string
          recovery_attempted?: boolean | null
          recovery_notes?: string | null
          recovery_outcome?: string | null
          sales_consultant_id?: string | null
          secondary_reasons?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_lost_analysis_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_lost_analysis_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_lost_analysis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_lost_analysis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_market_valuations: {
        Row: {
          created_at: string
          created_by: string | null
          data_source: string | null
          depreciation_rate: number | null
          effective_date: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          make: string
          mileage_bracket_end: number | null
          mileage_bracket_start: number | null
          model: string
          notes: string | null
          popularity_score: number | null
          price_excellent: number | null
          price_fair: number | null
          price_good: number | null
          price_poor: number | null
          region: string | null
          regional_adjustment_percentage: number | null
          source_url: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          variant: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          depreciation_rate?: number | null
          effective_date?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          make: string
          mileage_bracket_end?: number | null
          mileage_bracket_start?: number | null
          model: string
          notes?: string | null
          popularity_score?: number | null
          price_excellent?: number | null
          price_fair?: number | null
          price_good?: number | null
          price_poor?: number | null
          region?: string | null
          regional_adjustment_percentage?: number | null
          source_url?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          variant?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          depreciation_rate?: number | null
          effective_date?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          make?: string
          mileage_bracket_end?: number | null
          mileage_bracket_start?: number | null
          model?: string
          notes?: string | null
          popularity_score?: number | null
          price_excellent?: number | null
          price_fair?: number | null
          price_good?: number | null
          price_poor?: number | null
          region?: string | null
          regional_adjustment_percentage?: number | null
          source_url?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          variant?: string | null
          year?: number
        }
        Relationships: []
      }
      auto_mobile_notifications: {
        Row: {
          action_data: Json | null
          action_type: string | null
          created_at: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          in_app_notification_sent: boolean | null
          message: string
          notification_type: string
          priority: string
          push_notification_sent: boolean | null
          read_at: string | null
          retry_count: number | null
          send_error: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          in_app_notification_sent?: boolean | null
          message: string
          notification_type: string
          priority?: string
          push_notification_sent?: boolean | null
          read_at?: string | null
          retry_count?: number | null
          send_error?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          in_app_notification_sent?: boolean | null
          message?: string
          notification_type?: string
          priority?: string
          push_notification_sent?: boolean | null
          read_at?: string | null
          retry_count?: number | null
          send_error?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_mobile_sessions: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_model: string | null
          device_os_version: string | null
          device_type: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          is_offline_mode: boolean | null
          last_active_at: string
          location_accuracy: number | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          network_type: string | null
          session_token: string
          started_at: string
          tenant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
          user_role: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_model?: string | null
          device_os_version?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_offline_mode?: boolean | null
          last_active_at?: string
          location_accuracy?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          network_type?: string | null
          session_token: string
          started_at?: string
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          user_role: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_model?: string | null
          device_os_version?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_offline_mode?: boolean | null
          last_active_at?: string
          location_accuracy?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          network_type?: string | null
          session_token?: string
          started_at?: string
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      auto_models: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          segment: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          segment?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          segment?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "auto_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_models_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_models_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_next_best_actions: {
        Row: {
          action_description: string
          action_priority: string
          action_title: string
          action_type: string
          assigned_at: string | null
          assigned_to: string | null
          completed_at: string | null
          confidence_score: number | null
          created_at: string | null
          customer_id: string
          data_points: Json | null
          id: string
          is_expired: boolean | null
          journey_id: string | null
          outcome: string | null
          outcome_notes: string | null
          reason: string
          status: string | null
          status_reason: string | null
          tenant_id: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          action_description: string
          action_priority: string
          action_title: string
          action_type: string
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          customer_id: string
          data_points?: Json | null
          id?: string
          is_expired?: boolean | null
          journey_id?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          reason: string
          status?: string | null
          status_reason?: string | null
          tenant_id: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          action_description?: string
          action_priority?: string
          action_title?: string
          action_type?: string
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          customer_id?: string
          data_points?: Json | null
          id?: string
          is_expired?: boolean | null
          journey_id?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          reason?: string
          status?: string | null
          status_reason?: string | null
          tenant_id?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_next_best_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_next_best_actions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_next_best_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_next_best_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_nps_scores: {
        Row: {
          category: string
          created_at: string | null
          customer_id: string
          feedback_text: string | null
          follow_up_completed: boolean | null
          follow_up_required: boolean | null
          id: string
          journey_id: string | null
          recorded_at: string | null
          score: number
          survey_id: string
          survey_type: string
          tenant_id: string
          vehicle_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          customer_id: string
          feedback_text?: string | null
          follow_up_completed?: boolean | null
          follow_up_required?: boolean | null
          id?: string
          journey_id?: string | null
          recorded_at?: string | null
          score: number
          survey_id: string
          survey_type: string
          tenant_id: string
          vehicle_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          customer_id?: string
          feedback_text?: string | null
          follow_up_completed?: boolean | null
          follow_up_required?: boolean | null
          id?: string
          journey_id?: string | null
          recorded_at?: string | null
          score?: number
          survey_id?: string
          survey_type?: string
          tenant_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_nps_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_nps_scores_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_nps_scores_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "auto_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_nps_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_nps_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_nps_scores_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_offline_actions: {
        Row: {
          action_data: Json
          action_type: string
          conflict_resolution: string | null
          conflict_resolved_at: string | null
          conflict_resolved_by: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          last_sync_attempt_at: string | null
          priority: number | null
          session_id: string | null
          status: string
          sync_attempts: number | null
          sync_error: string | null
          synced_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_data: Json
          action_type: string
          conflict_resolution?: string | null
          conflict_resolved_at?: string | null
          conflict_resolved_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          last_sync_attempt_at?: string | null
          priority?: number | null
          session_id?: string | null
          status?: string
          sync_attempts?: number | null
          sync_error?: string | null
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          conflict_resolution?: string | null
          conflict_resolved_at?: string | null
          conflict_resolved_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_sync_attempt_at?: string | null
          priority?: number | null
          session_id?: string | null
          status?: string
          sync_attempts?: number | null
          sync_error?: string | null
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_offline_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "auto_mobile_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_photo_uploads: {
        Row: {
          captured_at: string
          compressed_height: number | null
          compressed_width: number | null
          compression_ratio: number | null
          created_at: string
          device_type: string | null
          entity_id: string
          entity_type: string
          file_mime_type: string
          file_name: string
          file_size: number
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          original_height: number | null
          original_width: number | null
          photo_category: string
          session_id: string | null
          storage_bucket: string
          storage_path: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
          upload_error: string | null
          upload_status: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string
          compressed_height?: number | null
          compressed_width?: number | null
          compression_ratio?: number | null
          created_at?: string
          device_type?: string | null
          entity_id: string
          entity_type: string
          file_mime_type: string
          file_name: string
          file_size: number
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          original_height?: number | null
          original_width?: number | null
          photo_category: string
          session_id?: string | null
          storage_bucket?: string
          storage_path: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          upload_error?: string | null
          upload_status?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string
          compressed_height?: number | null
          compressed_width?: number | null
          compression_ratio?: number | null
          created_at?: string
          device_type?: string | null
          entity_id?: string
          entity_type?: string
          file_mime_type?: string
          file_name?: string
          file_size?: number
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          original_height?: number | null
          original_width?: number | null
          photo_category?: string
          session_id?: string | null
          storage_bucket?: string
          storage_path?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          upload_error?: string | null
          upload_status?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_photo_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "auto_mobile_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_repair_order_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          hourly_rate: number | null
          id: string
          inventory_item_id: string | null
          is_warranty_covered: boolean | null
          item_code: string | null
          item_name: string
          item_type: string
          labor_hours: number | null
          part_number: string | null
          performed_by: string | null
          quantity: number
          repair_order_id: string
          status: string | null
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          total_amount: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          hourly_rate?: number | null
          id?: string
          inventory_item_id?: string | null
          is_warranty_covered?: boolean | null
          item_code?: string | null
          item_name: string
          item_type: string
          labor_hours?: number | null
          part_number?: string | null
          performed_by?: string | null
          quantity?: number
          repair_order_id: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id: string
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          hourly_rate?: number | null
          id?: string
          inventory_item_id?: string | null
          is_warranty_covered?: boolean | null
          item_code?: string | null
          item_name?: string
          item_type?: string
          labor_hours?: number | null
          part_number?: string | null
          performed_by?: string | null
          quantity?: number
          repair_order_id?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_repair_order_items_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "auto_repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_repair_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_repair_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_repair_orders: {
        Row: {
          actual_hours: number | null
          actual_labor_cost: number | null
          actual_parts_cost: number | null
          actual_total: number | null
          additional_technicians: Json | null
          appointment_id: string | null
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          bay_number: string | null
          created_at: string | null
          created_by: string | null
          customer_approval_date: string | null
          customer_approved: boolean | null
          customer_complaints: Json | null
          customer_id: string
          customer_informed: boolean | null
          delivered_at: string | null
          diagnosed_at: string | null
          diagnosis_notes: string | null
          estimated_hours: number | null
          estimated_labor_cost: number | null
          estimated_parts_cost: number | null
          estimated_total: number | null
          fuel_level: string | null
          id: string
          internal_notes: string | null
          invoiced_at: string | null
          is_warranty_work: boolean | null
          mileage_in: number | null
          opened_at: string | null
          order_date: string
          order_number: string
          order_type: string
          primary_technician_id: string | null
          quality_check_notes: string | null
          quality_check_passed: boolean | null
          quality_checked_at: string | null
          quality_checked_by: string | null
          requires_approval: boolean | null
          service_advisor_id: string | null
          status: string | null
          technician_notes: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          vehicle_condition_notes: string | null
          vehicle_id: string
          warranty_claim_id: string | null
          work_completed_at: string | null
          work_description: string
          work_started_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          actual_labor_cost?: number | null
          actual_parts_cost?: number | null
          actual_total?: number | null
          additional_technicians?: Json | null
          appointment_id?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bay_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_approval_date?: string | null
          customer_approved?: boolean | null
          customer_complaints?: Json | null
          customer_id: string
          customer_informed?: boolean | null
          delivered_at?: string | null
          diagnosed_at?: string | null
          diagnosis_notes?: string | null
          estimated_hours?: number | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          estimated_total?: number | null
          fuel_level?: string | null
          id?: string
          internal_notes?: string | null
          invoiced_at?: string | null
          is_warranty_work?: boolean | null
          mileage_in?: number | null
          opened_at?: string | null
          order_date?: string
          order_number: string
          order_type: string
          primary_technician_id?: string | null
          quality_check_notes?: string | null
          quality_check_passed?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          requires_approval?: boolean | null
          service_advisor_id?: string | null
          status?: string | null
          technician_notes?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_condition_notes?: string | null
          vehicle_id: string
          warranty_claim_id?: string | null
          work_completed_at?: string | null
          work_description: string
          work_started_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          actual_labor_cost?: number | null
          actual_parts_cost?: number | null
          actual_total?: number | null
          additional_technicians?: Json | null
          appointment_id?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bay_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_approval_date?: string | null
          customer_approved?: boolean | null
          customer_complaints?: Json | null
          customer_id?: string
          customer_informed?: boolean | null
          delivered_at?: string | null
          diagnosed_at?: string | null
          diagnosis_notes?: string | null
          estimated_hours?: number | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          estimated_total?: number | null
          fuel_level?: string | null
          id?: string
          internal_notes?: string | null
          invoiced_at?: string | null
          is_warranty_work?: boolean | null
          mileage_in?: number | null
          opened_at?: string | null
          order_date?: string
          order_number?: string
          order_type?: string
          primary_technician_id?: string | null
          quality_check_notes?: string | null
          quality_check_passed?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          requires_approval?: boolean | null
          service_advisor_id?: string | null
          status?: string | null
          technician_notes?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_condition_notes?: string | null
          vehicle_id?: string
          warranty_claim_id?: string | null
          work_completed_at?: string | null
          work_description?: string
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_repair_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "auto_service_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_repair_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_repair_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_repair_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_repair_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_rollback_audit_log: {
        Row: {
          affected_entities: Json | null
          created_at: string
          id: string
          metadata: Json | null
          rollback_approved_by: string | null
          rollback_executed_by: string | null
          rollback_reason: string
          steps_rolled_back: number
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          affected_entities?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rollback_approved_by?: string | null
          rollback_executed_by?: string | null
          rollback_reason: string
          steps_rolled_back?: number
          tenant_id: string
          transaction_id: string
        }
        Update: {
          affected_entities?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rollback_approved_by?: string | null
          rollback_executed_by?: string | null
          rollback_reason?: string
          steps_rolled_back?: number
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_rollback_audit_log_rollback_approved_by_fkey"
            columns: ["rollback_approved_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_rollback_approved_by_fkey"
            columns: ["rollback_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_rollback_executed_by_fkey"
            columns: ["rollback_executed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_rollback_executed_by_fkey"
            columns: ["rollback_executed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_rollback_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "auto_business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_service_appointments: {
        Row: {
          appointment_date: string
          appointment_number: string
          appointment_time: string
          assigned_bay: string | null
          assigned_technicians: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          current_mileage: number | null
          customer_id: string
          customer_notes: string | null
          estimated_cost: number | null
          estimated_duration_minutes: number | null
          final_cost: number | null
          id: string
          internal_notes: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          reported_issues: string | null
          requested_services: string
          service_advisor_id: string | null
          service_package_id: string | null
          service_type: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          vehicle_delivered_at: string | null
          vehicle_id: string
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          appointment_date: string
          appointment_number: string
          appointment_time: string
          assigned_bay?: string | null
          assigned_technicians?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_mileage?: number | null
          customer_id: string
          customer_notes?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          final_cost?: number | null
          id?: string
          internal_notes?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          reported_issues?: string | null
          requested_services: string
          service_advisor_id?: string | null
          service_package_id?: string | null
          service_type: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_delivered_at?: string | null
          vehicle_id: string
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_number?: string
          appointment_time?: string
          assigned_bay?: string | null
          assigned_technicians?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_mileage?: number | null
          customer_id?: string
          customer_notes?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          final_cost?: number | null
          id?: string
          internal_notes?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          reported_issues?: string | null
          requested_services?: string
          service_advisor_id?: string | null
          service_package_id?: string | null
          service_type?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_delivered_at?: string | null
          vehicle_id?: string
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_service_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_appointments_service_package_id_fkey"
            columns: ["service_package_id"]
            isOneToOne: false
            referencedRelation: "auto_service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_service_appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_service_history: {
        Row: {
          appointment_id: string | null
          created_at: string
          customer_feedback: string | null
          id: string
          is_locked: boolean | null
          is_warranty_service: boolean | null
          labor_cost: number | null
          labor_hours: number | null
          locked_at: string | null
          locked_by: string | null
          mileage: number
          next_service_due_date: string | null
          next_service_due_mileage: number | null
          parts_cost: number | null
          parts_replaced: Json | null
          quality_rating: number | null
          recorded_at: string
          recorded_by: string
          repair_order_id: string | null
          service_advisor_id: string | null
          service_date: string
          service_description: string
          service_type: string
          services_performed: Json
          technician_ids: Json | null
          tenant_id: string
          total_cost: number | null
          vehicle_id: string
          vin: string
          warranty_expiry_date: string | null
          warranty_mileage_limit: number | null
          workshop_location: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          customer_feedback?: string | null
          id?: string
          is_locked?: boolean | null
          is_warranty_service?: boolean | null
          labor_cost?: number | null
          labor_hours?: number | null
          locked_at?: string | null
          locked_by?: string | null
          mileage: number
          next_service_due_date?: string | null
          next_service_due_mileage?: number | null
          parts_cost?: number | null
          parts_replaced?: Json | null
          quality_rating?: number | null
          recorded_at?: string
          recorded_by: string
          repair_order_id?: string | null
          service_advisor_id?: string | null
          service_date: string
          service_description: string
          service_type: string
          services_performed?: Json
          technician_ids?: Json | null
          tenant_id: string
          total_cost?: number | null
          vehicle_id: string
          vin: string
          warranty_expiry_date?: string | null
          warranty_mileage_limit?: number | null
          workshop_location?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          customer_feedback?: string | null
          id?: string
          is_locked?: boolean | null
          is_warranty_service?: boolean | null
          labor_cost?: number | null
          labor_hours?: number | null
          locked_at?: string | null
          locked_by?: string | null
          mileage?: number
          next_service_due_date?: string | null
          next_service_due_mileage?: number | null
          parts_cost?: number | null
          parts_replaced?: Json | null
          quality_rating?: number | null
          recorded_at?: string
          recorded_by?: string
          repair_order_id?: string | null
          service_advisor_id?: string | null
          service_date?: string
          service_description?: string
          service_type?: string
          services_performed?: Json
          technician_ids?: Json | null
          tenant_id?: string
          total_cost?: number | null
          vehicle_id?: string
          vin?: string
          warranty_expiry_date?: string | null
          warranty_mileage_limit?: number | null
          workshop_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_service_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "auto_service_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_history_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "auto_repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_service_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_service_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_service_packages: {
        Row: {
          applicable_brands: Json | null
          applicable_models: Json | null
          base_price: number
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          estimated_duration_minutes: number
          id: string
          included_services: Json | null
          is_active: boolean | null
          mileage_interval: number | null
          name: string
          required_parts: Json | null
          service_type: string
          tenant_id: string
          time_interval_months: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          applicable_brands?: Json | null
          applicable_models?: Json | null
          base_price?: number
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          included_services?: Json | null
          is_active?: boolean | null
          mileage_interval?: number | null
          name: string
          required_parts?: Json | null
          service_type: string
          tenant_id: string
          time_interval_months?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          applicable_brands?: Json | null
          applicable_models?: Json | null
          base_price?: number
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          included_services?: Json | null
          is_active?: boolean | null
          mileage_interval?: number | null
          name?: string
          required_parts?: Json | null
          service_type?: string
          tenant_id?: string
          time_interval_months?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_service_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_service_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_survey_responses: {
        Row: {
          answer_numeric: number | null
          answer_text: string | null
          answer_value: string | null
          id: string
          question_id: string
          question_text: string
          question_type: string
          responded_at: string | null
          response_source: string | null
          survey_id: string
          tenant_id: string
        }
        Insert: {
          answer_numeric?: number | null
          answer_text?: string | null
          answer_value?: string | null
          id?: string
          question_id: string
          question_text: string
          question_type: string
          responded_at?: string | null
          response_source?: string | null
          survey_id: string
          tenant_id: string
        }
        Update: {
          answer_numeric?: number | null
          answer_text?: string | null
          answer_value?: string | null
          id?: string
          question_id?: string
          question_text?: string
          question_type?: string
          responded_at?: string | null
          response_source?: string | null
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "auto_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_survey_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_survey_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_survey_templates: {
        Row: {
          auto_send: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          questions: Json
          send_delay_hours: number | null
          survey_type: string
          tenant_id: string
          trigger_event: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          auto_send?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          questions?: Json
          send_delay_hours?: number | null
          survey_type: string
          tenant_id: string
          trigger_event: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          auto_send?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          questions?: Json
          send_delay_hours?: number | null
          survey_type?: string
          tenant_id?: string
          trigger_event?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_survey_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_survey_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_surveys: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customer_id: string
          delivery_id: string | null
          expires_at: string | null
          id: string
          journey_id: string | null
          questions: Json
          quotation_id: string | null
          sent_at: string | null
          service_appointment_id: string | null
          status: string | null
          survey_type: string
          template_id: string | null
          tenant_id: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          delivery_id?: string | null
          expires_at?: string | null
          id?: string
          journey_id?: string | null
          questions?: Json
          quotation_id?: string | null
          sent_at?: string | null
          service_appointment_id?: string | null
          status?: string | null
          survey_type: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          delivery_id?: string | null
          expires_at?: string | null
          id?: string
          journey_id?: string | null
          questions?: Json
          quotation_id?: string | null
          sent_at?: string | null
          service_appointment_id?: string | null
          status?: string | null
          survey_type?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_surveys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_surveys_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "auto_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "auto_survey_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_surveys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_surveys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_surveys_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_technician_time_logs: {
        Row: {
          clock_in_time: string
          clock_out_time: string | null
          created_at: string | null
          id: string
          is_billable: boolean | null
          line_item_id: string | null
          repair_order_id: string
          technician_id: string
          technician_name: string | null
          tenant_id: string
          total_hours: number | null
          updated_at: string | null
          work_description: string | null
        }
        Insert: {
          clock_in_time: string
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          is_billable?: boolean | null
          line_item_id?: string | null
          repair_order_id: string
          technician_id: string
          technician_name?: string | null
          tenant_id: string
          total_hours?: number | null
          updated_at?: string | null
          work_description?: string | null
        }
        Update: {
          clock_in_time?: string
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          is_billable?: boolean | null
          line_item_id?: string | null
          repair_order_id?: string
          technician_id?: string
          technician_name?: string | null
          tenant_id?: string
          total_hours?: number | null
          updated_at?: string | null
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_technician_time_logs_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "auto_repair_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_technician_time_logs_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "auto_repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_technician_time_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_technician_time_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_touchpoints: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          customer_id: string
          direction: string
          id: string
          interacted_at: string
          metadata: Json
          staff_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          customer_id: string
          direction?: string
          id?: string
          interacted_at?: string
          metadata?: Json
          staff_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          customer_id?: string
          direction?: string
          id?: string
          interacted_at?: string
          metadata?: Json
          staff_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_touchpoints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_touchpoints_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_touchpoints_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_touchpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_touchpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_trade_in_appraisals: {
        Row: {
          appraisal_date: string
          appraisal_number: string
          appraised_by: string | null
          appraiser_name: string | null
          approved_at: string | null
          approved_by: string | null
          approver_name: string | null
          color: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_expectations: string | null
          customer_id: string | null
          customer_response_at: string | null
          documents_condition: Json | null
          engine_condition: Json | null
          estimated_market_value: number | null
          expires_at: string | null
          exterior_condition: Json | null
          final_trade_in_value: number | null
          first_registration_date: string | null
          id: string
          interior_condition: Json | null
          internal_notes: string | null
          license_plate: string | null
          linked_sale_id: string | null
          make: string
          market_average: number | null
          market_high: number | null
          market_low: number | null
          mileage: number
          model: string
          number_of_owners: number | null
          offer_sent_at: string | null
          offered_trade_in_value: number | null
          overall_condition: string | null
          overall_notes: string | null
          registration_date: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          tires_brakes_condition: Json | null
          transmission_condition: Json | null
          updated_at: string
          updated_by: string | null
          used_as_down_payment: boolean | null
          variant: string | null
          vehicle_id: string | null
          vin: string | null
          year: number
        }
        Insert: {
          appraisal_date?: string
          appraisal_number: string
          appraised_by?: string | null
          appraiser_name?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approver_name?: string | null
          color?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_expectations?: string | null
          customer_id?: string | null
          customer_response_at?: string | null
          documents_condition?: Json | null
          engine_condition?: Json | null
          estimated_market_value?: number | null
          expires_at?: string | null
          exterior_condition?: Json | null
          final_trade_in_value?: number | null
          first_registration_date?: string | null
          id?: string
          interior_condition?: Json | null
          internal_notes?: string | null
          license_plate?: string | null
          linked_sale_id?: string | null
          make: string
          market_average?: number | null
          market_high?: number | null
          market_low?: number | null
          mileage: number
          model: string
          number_of_owners?: number | null
          offer_sent_at?: string | null
          offered_trade_in_value?: number | null
          overall_condition?: string | null
          overall_notes?: string | null
          registration_date?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          tires_brakes_condition?: Json | null
          transmission_condition?: Json | null
          updated_at?: string
          updated_by?: string | null
          used_as_down_payment?: boolean | null
          variant?: string | null
          vehicle_id?: string | null
          vin?: string | null
          year: number
        }
        Update: {
          appraisal_date?: string
          appraisal_number?: string
          appraised_by?: string | null
          appraiser_name?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approver_name?: string | null
          color?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_expectations?: string | null
          customer_id?: string | null
          customer_response_at?: string | null
          documents_condition?: Json | null
          engine_condition?: Json | null
          estimated_market_value?: number | null
          expires_at?: string | null
          exterior_condition?: Json | null
          final_trade_in_value?: number | null
          first_registration_date?: string | null
          id?: string
          interior_condition?: Json | null
          internal_notes?: string | null
          license_plate?: string | null
          linked_sale_id?: string | null
          make?: string
          market_average?: number | null
          market_high?: number | null
          market_low?: number | null
          mileage?: number
          model?: string
          number_of_owners?: number | null
          offer_sent_at?: string | null
          offered_trade_in_value?: number | null
          overall_condition?: string | null
          overall_notes?: string | null
          registration_date?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          tires_brakes_condition?: Json | null
          transmission_condition?: Json | null
          updated_at?: string
          updated_by?: string | null
          used_as_down_payment?: boolean | null
          variant?: string | null
          vehicle_id?: string | null
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
      auto_trade_in_photos: {
        Row: {
          appraisal_id: string
          created_at: string
          damage_markers: Json | null
          description: string | null
          display_order: number | null
          file_name: string | null
          file_size_bytes: number | null
          height_px: number | null
          id: string
          is_primary: boolean | null
          mime_type: string | null
          notes: string | null
          photo_category: string
          photo_thumbnail_url: string | null
          photo_url: string
          tenant_id: string
          uploaded_at: string
          uploaded_by: string | null
          width_px: number | null
        }
        Insert: {
          appraisal_id: string
          created_at?: string
          damage_markers?: Json | null
          description?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          photo_category: string
          photo_thumbnail_url?: string | null
          photo_url: string
          tenant_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          width_px?: number | null
        }
        Update: {
          appraisal_id?: string
          created_at?: string
          damage_markers?: Json | null
          description?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          photo_category?: string
          photo_thumbnail_url?: string | null
          photo_url?: string
          tenant_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_trade_in_photos_appraisal_id_fkey"
            columns: ["appraisal_id"]
            isOneToOne: false
            referencedRelation: "auto_trade_in_appraisals"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_transaction_steps: {
        Row: {
          action: string
          compensating_action: string | null
          compensating_params: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          executed_at: string | null
          id: string
          metadata: Json | null
          rolled_back_at: string | null
          sequence: number
          snapshot_after: Json | null
          snapshot_before: Json | null
          status: Database["public"]["Enums"]["auto_transaction_step_status"]
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          action: string
          compensating_action?: string | null
          compensating_params?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          rolled_back_at?: string | null
          sequence: number
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          status?: Database["public"]["Enums"]["auto_transaction_step_status"]
          tenant_id: string
          transaction_id: string
        }
        Update: {
          action?: string
          compensating_action?: string | null
          compensating_params?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          rolled_back_at?: string | null
          sequence?: number
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          status?: Database["public"]["Enums"]["auto_transaction_step_status"]
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_transaction_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_transaction_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_transaction_steps_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "auto_business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_variants: {
        Row: {
          created_at: string
          fuel_type: string | null
          id: string
          is_active: boolean
          model_id: string
          name: string
          specs_json: Json
          tenant_id: string
          transmission: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          model_id: string
          name: string
          specs_json?: Json
          tenant_id: string
          transmission?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          model_id?: string
          name?: string
          specs_json?: Json
          tenant_id?: string
          transmission?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_variants_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "auto_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_vehicle_owners: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          license_plate: string | null
          metadata: Json
          ownership_type: string
          registration_date: string | null
          tenant_id: string
          transfer_notes: string | null
          transferred_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          metadata?: Json
          ownership_type?: string
          registration_date?: string | null
          tenant_id: string
          transfer_notes?: string | null
          transferred_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          metadata?: Json
          ownership_type?: string
          registration_date?: string | null
          tenant_id?: string
          transfer_notes?: string | null
          transferred_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_vehicle_owners_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicle_owners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_vehicle_owners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicle_owners_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_vehicle_status_logs: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["auto_vehicle_status"] | null
          id: string
          metadata: Json
          reason: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["auto_vehicle_status"]
          vehicle_id: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["auto_vehicle_status"]
            | null
          id?: string
          metadata?: Json
          reason?: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["auto_vehicle_status"]
          vehicle_id: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["auto_vehicle_status"]
            | null
          id?: string
          metadata?: Json
          reason?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["auto_vehicle_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_vehicle_status_logs_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_vehicle_status_logs_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicle_status_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_vehicle_status_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicle_status_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_vehicles: {
        Row: {
          actual_arrival_date: string | null
          allocated_at: string | null
          allocated_by_user_id: string | null
          allocated_to_contract_id: string | null
          chassis_number: string | null
          color_exterior: string
          color_interior: string | null
          cost_price: number
          created_at: string
          delivered_at: string | null
          delivered_to_customer_id: string | null
          delivery_notes: string | null
          engine_number: string | null
          expected_arrival_date: string | null
          id: string
          import_declaration_number: string | null
          list_price: number
          location_note: string | null
          metadata: Json
          model_year: number
          status: Database["public"]["Enums"]["auto_vehicle_status"]
          tenant_id: string
          updated_at: string
          variant_id: string
          vin: string
        }
        Insert: {
          actual_arrival_date?: string | null
          allocated_at?: string | null
          allocated_by_user_id?: string | null
          allocated_to_contract_id?: string | null
          chassis_number?: string | null
          color_exterior: string
          color_interior?: string | null
          cost_price?: number
          created_at?: string
          delivered_at?: string | null
          delivered_to_customer_id?: string | null
          delivery_notes?: string | null
          engine_number?: string | null
          expected_arrival_date?: string | null
          id?: string
          import_declaration_number?: string | null
          list_price?: number
          location_note?: string | null
          metadata?: Json
          model_year: number
          status?: Database["public"]["Enums"]["auto_vehicle_status"]
          tenant_id: string
          updated_at?: string
          variant_id: string
          vin: string
        }
        Update: {
          actual_arrival_date?: string | null
          allocated_at?: string | null
          allocated_by_user_id?: string | null
          allocated_to_contract_id?: string | null
          chassis_number?: string | null
          color_exterior?: string
          color_interior?: string | null
          cost_price?: number
          created_at?: string
          delivered_at?: string | null
          delivered_to_customer_id?: string | null
          delivery_notes?: string | null
          engine_number?: string | null
          expected_arrival_date?: string | null
          id?: string
          import_declaration_number?: string | null
          list_price?: number
          location_note?: string | null
          metadata?: Json
          model_year?: number
          status?: Database["public"]["Enums"]["auto_vehicle_status"]
          tenant_id?: string
          updated_at?: string
          variant_id?: string
          vin?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_vehicles_allocated_by_user_id_fkey"
            columns: ["allocated_by_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_vehicles_allocated_by_user_id_fkey"
            columns: ["allocated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_vehicles_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "auto_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_vehicles_history: {
        Row: {
          allocated_at: string | null
          allocated_to_contract_id: string | null
          change_reason: string | null
          changed_by: string | null
          chassis_number: string | null
          color_exterior: string
          color_interior: string | null
          cost_price: number | null
          delivered_at: string | null
          delivered_to_customer_id: string | null
          engine_number: string | null
          id: string
          list_price: number | null
          location_note: string | null
          model_year: number
          status: string
          tenant_id: string
          valid_from: string
          valid_to: string
          variant_id: string
          vin: string
        }
        Insert: {
          allocated_at?: string | null
          allocated_to_contract_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          chassis_number?: string | null
          color_exterior: string
          color_interior?: string | null
          cost_price?: number | null
          delivered_at?: string | null
          delivered_to_customer_id?: string | null
          engine_number?: string | null
          id: string
          list_price?: number | null
          location_note?: string | null
          model_year: number
          status: string
          tenant_id: string
          valid_from: string
          valid_to?: string
          variant_id: string
          vin: string
        }
        Update: {
          allocated_at?: string | null
          allocated_to_contract_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          chassis_number?: string | null
          color_exterior?: string
          color_interior?: string | null
          cost_price?: number | null
          delivered_at?: string | null
          delivered_to_customer_id?: string | null
          engine_number?: string | null
          id?: string
          list_price?: number | null
          location_note?: string | null
          model_year?: number
          status?: string
          tenant_id?: string
          valid_from?: string
          valid_to?: string
          variant_id?: string
          vin?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_vehicles_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "auto_vehicles_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_warranty_claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          claim_date: string
          claim_number: string
          claim_type: string
          closed_at: string | null
          coverage_percentage: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          customer_responsibility: number | null
          denial_reason: string | null
          failure_date: string | null
          failure_mileage: number | null
          id: string
          internal_notes: string | null
          is_covered: boolean | null
          is_within_warranty: boolean | null
          issue_description: string
          labor_approved: number | null
          labor_claimed: number | null
          labor_covered: boolean | null
          manufacturer_case_number: string | null
          paid_at: string | null
          parts_approved: number | null
          parts_claimed: number | null
          parts_covered: Json | null
          repair_order_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string | null
          submitted_at: string | null
          supporting_documents: Json | null
          tenant_id: string
          total_approved: number | null
          total_claimed: number | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
          warranty_end_date: string | null
          warranty_mileage_limit: number | null
          warranty_start_date: string | null
          warranty_type: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          claim_date?: string
          claim_number: string
          claim_type: string
          closed_at?: string | null
          coverage_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          customer_responsibility?: number | null
          denial_reason?: string | null
          failure_date?: string | null
          failure_mileage?: number | null
          id?: string
          internal_notes?: string | null
          is_covered?: boolean | null
          is_within_warranty?: boolean | null
          issue_description: string
          labor_approved?: number | null
          labor_claimed?: number | null
          labor_covered?: boolean | null
          manufacturer_case_number?: string | null
          paid_at?: string | null
          parts_approved?: number | null
          parts_claimed?: number | null
          parts_covered?: Json | null
          repair_order_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submitted_at?: string | null
          supporting_documents?: Json | null
          tenant_id: string
          total_approved?: number | null
          total_claimed?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
          warranty_end_date?: string | null
          warranty_mileage_limit?: number | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          claim_date?: string
          claim_number?: string
          claim_type?: string
          closed_at?: string | null
          coverage_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          customer_responsibility?: number | null
          denial_reason?: string | null
          failure_date?: string | null
          failure_mileage?: number | null
          id?: string
          internal_notes?: string | null
          is_covered?: boolean | null
          is_within_warranty?: boolean | null
          issue_description?: string
          labor_approved?: number | null
          labor_claimed?: number | null
          labor_covered?: boolean | null
          manufacturer_case_number?: string | null
          paid_at?: string | null
          parts_approved?: number | null
          parts_claimed?: number | null
          parts_covered?: Json | null
          repair_order_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submitted_at?: string | null
          supporting_documents?: Json | null
          tenant_id?: string
          total_approved?: number | null
          total_claimed?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
          warranty_end_date?: string | null
          warranty_mileage_limit?: number | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_warranty_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_warranty_claims_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "auto_repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_warranty_claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "auto_warranty_claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_warranty_claims_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "auto_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          bed_name: string | null
          bed_number: string
          created_at: string | null
          id: string
          notes: string | null
          room_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          bed_name?: string | null
          bed_number: string
          created_at?: string | null
          id?: string
          notes?: string | null
          room_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          bed_name?: string | null
          bed_number?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          room_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "beds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          booking_id: string
          created_at: string | null
          created_by: string | null
          created_by_role: string | null
          event_data: Json | null
          event_description: string | null
          event_type: string
          id: string
          ip_address: unknown
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          event_data?: Json | null
          event_description?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          event_data?: Json | null
          event_description?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "booking_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_resources: {
        Row: {
          branch_tenant_id: string | null
          capacity: number
          created_at: string
          id: string
          location_note: string | null
          metadata: Json
          name: string
          resource_type: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_tenant_id?: string | null
          capacity?: number
          created_at?: string
          id?: string
          location_note?: string | null
          metadata?: Json
          name: string
          resource_type?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_tenant_id?: string | null
          capacity?: number
          created_at?: string
          id?: string
          location_note?: string | null
          metadata?: Json
          name?: string
          resource_type?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_resources_branch_tenant_id_fkey"
            columns: ["branch_tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "booking_resources_branch_tenant_id_fkey"
            columns: ["branch_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "booking_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_items: {
        Row: {
          booking_id: string
          calculated_commission: number
          completed_date: string | null
          created_at: string
          id: string
          ktv_id: string | null
          notes: string | null
          override_commission_type: string | null
          override_commission_value: number | null
          package_id: string | null
          quantity: number
          service_category: string | null
          service_name: string
          status: string
          subtotal: number
          tenant_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          calculated_commission?: number
          completed_date?: string | null
          created_at?: string
          id?: string
          ktv_id?: string | null
          notes?: string | null
          override_commission_type?: string | null
          override_commission_value?: number | null
          package_id?: string | null
          quantity?: number
          service_category?: string | null
          service_name: string
          status?: string
          subtotal?: number
          tenant_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          calculated_commission?: number
          completed_date?: string | null
          created_at?: string
          id?: string
          ktv_id?: string | null
          notes?: string | null
          override_commission_type?: string | null
          override_commission_value?: number | null
          package_id?: string | null
          quantity?: number
          service_category?: string | null
          service_name?: string
          status?: string
          subtotal?: number
          tenant_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_items_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "booking_service_items_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "booking_service_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_bed_id: string | null
          assigned_ktv_id: string | null
          assigned_room_id: string | null
          booking_number: string
          completed_sessions: number | null
          contract_signed: boolean | null
          contract_url: string | null
          created_at: string | null
          customer_id: string
          deposit_amount: number | null
          discount_percent: number | null
          end_date: string | null
          expected_birth_date: string | null
          full_price: number | null
          id: string
          is_in_care: boolean | null
          ktv_commission: number | null
          last_updated_date: string | null
          metadata: Json | null
          package_id: string | null
          package_name: string | null
          preferred_time: string | null
          required_equipment_ids: Json | null
          share_token: string | null
          start_date: string | null
          status: string | null
          tenant_id: string
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_bed_id?: string | null
          assigned_ktv_id?: string | null
          assigned_room_id?: string | null
          booking_number: string
          completed_sessions?: number | null
          contract_signed?: boolean | null
          contract_url?: string | null
          created_at?: string | null
          customer_id: string
          deposit_amount?: number | null
          discount_percent?: number | null
          end_date?: string | null
          expected_birth_date?: string | null
          full_price?: number | null
          id?: string
          is_in_care?: boolean | null
          ktv_commission?: number | null
          last_updated_date?: string | null
          metadata?: Json | null
          package_id?: string | null
          package_name?: string | null
          preferred_time?: string | null
          required_equipment_ids?: Json | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id: string
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_bed_id?: string | null
          assigned_ktv_id?: string | null
          assigned_room_id?: string | null
          booking_number?: string
          completed_sessions?: number | null
          contract_signed?: boolean | null
          contract_url?: string | null
          created_at?: string | null
          customer_id?: string
          deposit_amount?: number | null
          discount_percent?: number | null
          end_date?: string | null
          expected_birth_date?: string | null
          full_price?: number | null
          id?: string
          is_in_care?: boolean | null
          ktv_commission?: number | null
          last_updated_date?: string | null
          metadata?: Json | null
          package_id?: string | null
          package_name?: string | null
          preferred_time?: string | null
          required_equipment_ids?: Json | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_bed_id_fkey"
            columns: ["assigned_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_assigned_ktv_id_fkey"
            columns: ["assigned_ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "bookings_assigned_ktv_id_fkey"
            columns: ["assigned_ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_assigned_room_id_fkey"
            columns: ["assigned_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_snapshots: {
        Row: {
          available_capacity: number
          booked_capacity: number
          branch_id: string | null
          buffer_reserved: number
          created_at: string | null
          id: string
          snapshot_date: string
          snapshot_hour: number
          tenant_id: string
          time_slot: string | null
          total_capacity: number
          utilization_rate: number | null
        }
        Insert: {
          available_capacity: number
          booked_capacity: number
          branch_id?: string | null
          buffer_reserved?: number
          created_at?: string | null
          id?: string
          snapshot_date: string
          snapshot_hour: number
          tenant_id: string
          time_slot?: string | null
          total_capacity: number
          utilization_rate?: number | null
        }
        Update: {
          available_capacity?: number
          booked_capacity?: number
          branch_id?: string | null
          buffer_reserved?: number
          created_at?: string | null
          id?: string
          snapshot_date?: string
          snapshot_hour?: number
          tenant_id?: string
          time_slot?: string | null
          total_capacity?: number
          utilization_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capacity_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "capacity_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          is_read: boolean | null
          message: string
          sender_id: string | null
          sender_type: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          sender_id?: string | null
          sender_type: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string | null
          sender_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          sequence_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sequence_order: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sequence_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module_key: string
          specialty: string | null
          status: string
          tenant_id: string
          theory_duration_minutes: number
          title: string
          tuition_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_key?: string
          specialty?: string | null
          status?: string
          tenant_id: string
          theory_duration_minutes?: number
          title: string
          tuition_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_key?: string
          specialty?: string | null
          status?: string
          tenant_id?: string
          theory_duration_minutes?: number
          title?: string
          tuition_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          dob_baby: string | null
          dob_expected: string | null
          gender_baby: string | null
          id: string
          latitude: number | null
          longitude: number | null
          loyalty_points: number | null
          metadata: Json | null
          name_baby: string | null
          name_mother: string
          notes: string | null
          phone: string
          referrer_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          zalo_oa_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          dob_baby?: string | null
          dob_expected?: string | null
          gender_baby?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          loyalty_points?: number | null
          metadata?: Json | null
          name_baby?: string | null
          name_mother: string
          notes?: string | null
          phone: string
          referrer_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          zalo_oa_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          dob_baby?: string | null
          dob_expected?: string | null
          gender_baby?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          loyalty_points?: number | null
          metadata?: Json | null
          name_baby?: string | null
          name_mother?: string
          notes?: string | null
          phone?: string
          referrer_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          zalo_oa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "customers_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_engine_metrics: {
        Row: {
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          execution_time_ms: number
          id: string
          ktv_id: string | null
          metadata: Json | null
          operation: string
          outcome: string | null
          provider_type: string
          success: boolean
          tenant_id: string
          was_assignment_skipped: boolean | null
          was_capacity_skipped: boolean | null
          was_conflict_skipped: boolean | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          execution_time_ms: number
          id?: string
          ktv_id?: string | null
          metadata?: Json | null
          operation: string
          outcome?: string | null
          provider_type: string
          success: boolean
          tenant_id: string
          was_assignment_skipped?: boolean | null
          was_capacity_skipped?: boolean | null
          was_conflict_skipped?: boolean | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          execution_time_ms?: number
          id?: string
          ktv_id?: string | null
          metadata?: Json | null
          operation?: string
          outcome?: string | null
          provider_type?: string
          success?: boolean
          tenant_id?: string
          was_assignment_skipped?: boolean | null
          was_capacity_skipped?: boolean | null
          was_conflict_skipped?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_engine_metrics_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_engine_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_engine_metrics_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "decision_engine_metrics_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_engine_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "decision_engine_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string | null
          equipment_code: string
          equipment_name: string
          equipment_type: string | null
          id: string
          notes: string | null
          quantity: number | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_code: string
          equipment_name: string
          equipment_type?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_code?: string
          equipment_name?: string
          equipment_type?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "equipment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          accounting_metadata: Json
          accounting_review_status: string
          accounting_template_id: string | null
          amount: number
          approved_by_id: string | null
          business_event_type: string | null
          category: string
          description: string | null
          expense_date: string
          id: string
          is_locked: boolean | null
          receipt_url: string | null
          status: string | null
          submitted_by_id: string | null
          tenant_id: string | null
        }
        Insert: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          amount: number
          approved_by_id?: string | null
          business_event_type?: string | null
          category: string
          description?: string | null
          expense_date: string
          id?: string
          is_locked?: boolean | null
          receipt_url?: string | null
          status?: string | null
          submitted_by_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          amount?: number
          approved_by_id?: string | null
          business_event_type?: string | null
          category?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_locked?: boolean | null
          receipt_url?: string | null
          status?: string | null
          submitted_by_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_accounting_template_id_fkey"
            columns: ["accounting_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "expenses_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_id_fkey"
            columns: ["submitted_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_id_fkey"
            columns: ["submitted_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      external_ads_data: {
        Row: {
          clicks: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          created_at: string
          ctr: number | null
          date: string
          external_ad_id: string | null
          external_adset_id: string | null
          external_campaign_id: string
          id: string
          impressions: number | null
          internal_campaign_id: string | null
          platform: string
          raw_data: Json | null
          revenue: number | null
          roas: number | null
          roi: number | null
          spend: number | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id: string
          id?: string
          impressions?: number | null
          internal_campaign_id?: string | null
          platform: string
          raw_data?: Json | null
          revenue?: number | null
          roas?: number | null
          roi?: number | null
          spend?: number | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string
          id?: string
          impressions?: number | null
          internal_campaign_id?: string | null
          platform?: string
          raw_data?: Json | null
          revenue?: number | null
          roas?: number | null
          roi?: number | null
          spend?: number | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_ads_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "external_ads_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_ads_data_campaign"
            columns: ["internal_campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_ads_data_campaign"
            columns: ["internal_campaign_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_performance"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      forecast_results: {
        Row: {
          accuracy_error: number | null
          accuracy_pct: number | null
          actual_value: number | null
          confidence_level: number | null
          confidence_lower: number | null
          confidence_upper: number | null
          created_at: string
          created_by: string | null
          features: Json | null
          forecast_date: string
          forecast_horizon: number
          forecast_type: string
          id: string
          metadata: Json | null
          model_name: string
          model_version: string
          predicted_value: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          accuracy_error?: number | null
          accuracy_pct?: number | null
          actual_value?: number | null
          confidence_level?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string
          created_by?: string | null
          features?: Json | null
          forecast_date: string
          forecast_horizon: number
          forecast_type: string
          id?: string
          metadata?: Json | null
          model_name: string
          model_version: string
          predicted_value?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          accuracy_error?: number | null
          accuracy_pct?: number | null
          actual_value?: number | null
          confidence_level?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string
          created_by?: string | null
          features?: Json | null
          forecast_date?: string
          forecast_horizon?: number
          forecast_type?: string
          id?: string
          metadata?: Json | null
          model_name?: string
          model_version?: string
          predicted_value?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "forecast_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_royalty_invoices: {
        Row: {
          calculated_amount: number
          created_at: string | null
          gross_revenue: number
          id: string
          invoice_number: string
          month_year: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          royalty_fixed_amount: number | null
          royalty_rate: number | null
          royalty_type: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          calculated_amount: number
          created_at?: string | null
          gross_revenue: number
          id?: string
          invoice_number: string
          month_year: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          royalty_fixed_amount?: number | null
          royalty_rate?: number | null
          royalty_type: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          calculated_amount?: number
          created_at?: string | null
          gross_revenue?: number
          id?: string
          invoice_number?: string
          month_year?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          royalty_fixed_amount?: number | null
          royalty_rate?: number | null
          royalty_type?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchise_royalty_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "franchise_royalty_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gate3_monitoring_snapshots: {
        Row: {
          circuit_breaker_state: string
          dlq_size: number
          failure_count: number
          id: string
          queue_depth: number
          queue_failed: number
          raw_health_data: Json | null
          status: string
          success_count: number
          timestamp: string
        }
        Insert: {
          circuit_breaker_state?: string
          dlq_size?: number
          failure_count?: number
          id?: string
          queue_depth?: number
          queue_failed?: number
          raw_health_data?: Json | null
          status: string
          success_count?: number
          timestamp?: string
        }
        Update: {
          circuit_breaker_state?: string
          dlq_size?: number
          failure_count?: number
          id?: string
          queue_depth?: number
          queue_failed?: number
          raw_health_data?: Json | null
          status?: string
          success_count?: number
          timestamp?: string
        }
        Relationships: []
      }
      hr_contracts: {
        Row: {
          agreed_allowances: Json | null
          agreed_base_salary: number | null
          contract_number: string | null
          contract_title: string | null
          contract_type: string
          created_at: string
          document_url: string | null
          end_date: string | null
          id: string
          metadata: Json
          notes: string | null
          profile_id: string
          signed_at: string | null
          signed_by_company: boolean
          signed_by_employee: boolean
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agreed_allowances?: Json | null
          agreed_base_salary?: number | null
          contract_number?: string | null
          contract_title?: string | null
          contract_type: string
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          profile_id: string
          signed_at?: string | null
          signed_by_company?: boolean
          signed_by_employee?: boolean
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agreed_allowances?: Json | null
          agreed_base_salary?: number | null
          contract_number?: string | null
          contract_title?: string | null
          contract_type?: string
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          profile_id?: string
          signed_at?: string | null
          signed_by_company?: boolean
          signed_by_employee?: boolean
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_contracts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "hr_employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "hr_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          head_person_id: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          org_unit_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          head_person_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          org_unit_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          head_person_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          org_unit_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_head_person_id_fkey"
            columns: ["head_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "hr_departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employee_profiles: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          base_salary: number | null
          bhxh_number: string | null
          confirmation_date: string | null
          created_at: string
          currency: string
          department_id: string | null
          employment_status: string
          employment_type: string
          grade: string | null
          hire_date: string | null
          id: string
          manager_person_id: string | null
          metadata: Json
          person_id: string
          position_title: string | null
          probation_end: string | null
          salary_band: string | null
          tax_code: string | null
          tenant_id: string
          termination_date: string | null
          updated_at: string
          work_schedule: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          bhxh_number?: string | null
          confirmation_date?: string | null
          created_at?: string
          currency?: string
          department_id?: string | null
          employment_status?: string
          employment_type?: string
          grade?: string | null
          hire_date?: string | null
          id?: string
          manager_person_id?: string | null
          metadata?: Json
          person_id: string
          position_title?: string | null
          probation_end?: string | null
          salary_band?: string | null
          tax_code?: string | null
          tenant_id: string
          termination_date?: string | null
          updated_at?: string
          work_schedule?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          bhxh_number?: string | null
          confirmation_date?: string | null
          created_at?: string
          currency?: string
          department_id?: string | null
          employment_status?: string
          employment_type?: string
          grade?: string | null
          hire_date?: string | null
          id?: string
          manager_person_id?: string | null
          metadata?: Json
          person_id?: string
          position_title?: string | null
          probation_end?: string | null
          salary_band?: string | null
          tax_code?: string | null
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_profiles_manager_person_id_fkey"
            columns: ["manager_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "hr_employee_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_branch_clearing_records: {
        Row: {
          calculated_amount: number
          cleared_at: string | null
          clearing_number: string
          clearing_rate: number
          created_at: string | null
          creditor_tenant_id: string | null
          debtor_tenant_id: string | null
          id: string
          month_year: string
          notes: string | null
          payment_method: string | null
          session_count: number
          status: string | null
        }
        Insert: {
          calculated_amount: number
          cleared_at?: string | null
          clearing_number: string
          clearing_rate?: number
          created_at?: string | null
          creditor_tenant_id?: string | null
          debtor_tenant_id?: string | null
          id?: string
          month_year: string
          notes?: string | null
          payment_method?: string | null
          session_count?: number
          status?: string | null
        }
        Update: {
          calculated_amount?: number
          cleared_at?: string | null
          clearing_number?: string
          clearing_rate?: number
          created_at?: string | null
          creditor_tenant_id?: string | null
          debtor_tenant_id?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          payment_method?: string | null
          session_count?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inter_branch_clearing_records_creditor_tenant_id_fkey"
            columns: ["creditor_tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inter_branch_clearing_records_creditor_tenant_id_fkey"
            columns: ["creditor_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_clearing_records_debtor_tenant_id_fkey"
            columns: ["debtor_tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inter_branch_clearing_records_debtor_tenant_id_fkey"
            columns: ["debtor_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          min_stock_level: number
          name: string
          notes: string | null
          price_per_unit: number
          sku: string | null
          stock_level: number
          tenant_id: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          min_stock_level?: number
          name: string
          notes?: string | null
          price_per_unit?: number
          sku?: string | null
          stock_level?: number
          tenant_id: string
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          min_stock_level?: number
          name?: string
          notes?: string | null
          price_per_unit?: number
          sku?: string | null
          stock_level?: number
          tenant_id?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          accounting_metadata: Json
          accounting_review_status: string
          accounting_template_id: string | null
          business_event_type: string | null
          change_amount: number
          created_at: string | null
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          reason: string
          session_log_id: string | null
          tenant_id: string
        }
        Insert: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          business_event_type?: string | null
          change_amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          reason?: string
          session_log_id?: string | null
          tenant_id: string
        }
        Update: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          business_event_type?: string | null
          change_amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          reason?: string
          session_log_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_accounting_template_id_fkey"
            columns: ["accounting_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "inventory_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_inventory_status"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_logs_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_orders: {
        Row: {
          approved_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          items: Json
          notes: string | null
          order_number: string
          rejection_reason: string | null
          requester_tenant_id: string
          shipped_at: string | null
          shipping_carrier: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          items: Json
          notes?: string | null
          order_number: string
          rejection_reason?: string | null
          requester_tenant_id: string
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          rejection_reason?: string | null
          requester_tenant_id?: string
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_orders_requester_tenant_id_fkey"
            columns: ["requester_tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_transfer_orders_requester_tenant_id_fkey"
            columns: ["requester_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_print_logs: {
        Row: {
          amount_due: number
          booking_id: string
          created_at: string
          id: string
          invoice_number: string
          print_count: number
          print_type: string
          printed_by: string | null
          reason: string | null
          session_log_id: string | null
          tenant_id: string
          transfer_memo: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_due?: number
          booking_id: string
          created_at?: string
          id?: string
          invoice_number: string
          print_count?: number
          print_type?: string
          printed_by?: string | null
          reason?: string | null
          session_log_id?: string | null
          tenant_id: string
          transfer_memo?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_due?: number
          booking_id?: string
          created_at?: string
          id?: string
          invoice_number?: string
          print_count?: number
          print_type?: string
          printed_by?: string | null
          reason?: string | null
          session_log_id?: string | null
          tenant_id?: string
          transfer_memo?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_print_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_print_logs_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "invoice_print_logs_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_print_logs_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_print_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoice_print_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_print_logs_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "invoice_print_logs_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          entry_date: string
          id: string
          period_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          period_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          period_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          branch_id: string | null
          cost_center_id: string | null
          created_at: string | null
          credit_amount: number
          debit_amount: number
          entry_id: string
          id: string
          ktv_id: string | null
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_id: string
          id?: string
          ktv_id?: string | null
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_id?: string
          id?: string
          ktv_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_records: {
        Row: {
          bonus_amount: number | null
          customer_satisfaction: number | null
          id: string
          kpi_achievement_rate: number | null
          ktv_id: string
          month_year: string
          notes: string | null
          on_time_rate: number | null
          sessions_completed: number | null
          target_sessions: number | null
          tenant_id: string | null
          violations_count: number | null
        }
        Insert: {
          bonus_amount?: number | null
          customer_satisfaction?: number | null
          id?: string
          kpi_achievement_rate?: number | null
          ktv_id: string
          month_year: string
          notes?: string | null
          on_time_rate?: number | null
          sessions_completed?: number | null
          target_sessions?: number | null
          tenant_id?: string | null
          violations_count?: number | null
        }
        Update: {
          bonus_amount?: number | null
          customer_satisfaction?: number | null
          id?: string
          kpi_achievement_rate?: number | null
          ktv_id?: string
          month_year?: string
          notes?: string | null
          on_time_rate?: number | null
          sessions_completed?: number | null
          target_sessions?: number | null
          tenant_id?: string | null
          violations_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "kpi_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "kpi_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ktv_schedule: {
        Row: {
          date: string
          id: string
          ktv_id: string
          note: string | null
          off_paid: boolean | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          date: string
          id?: string
          ktv_id: string
          note?: string | null
          off_paid?: boolean | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          ktv_id?: string
          note?: string | null
          off_paid?: boolean | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ktv_schedule_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "ktv_schedule_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ktv_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ktv_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activity_log: {
        Row: {
          action: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action?: string | null
          changed_by?: string | null
          created_at?: string | null
          id: string
          lead_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "lead_activity_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "re_partner_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_reason: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          decision_confidence: number | null
          decision_id: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days: number
          decision_confidence?: number | null
          decision_id?: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason?: string | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          decision_confidence?: number | null
          decision_id?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "leave_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body: string | null
          content_type: string
          content_url: string | null
          created_at: string
          id: string
          module_id: string
          required_view_percentage: number
          required_view_seconds: number
          sequence_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          id?: string
          module_id: string
          required_view_percentage?: number
          required_view_seconds?: number
          sequence_order: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          id?: string
          module_id?: string
          required_view_percentage?: number
          required_view_seconds?: number
          sequence_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          budget: number | null
          created_at: string
          created_by_id: string | null
          description: string | null
          end_date: string | null
          external_mappings: Json | null
          id: string
          name: string
          start_date: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          end_date?: string | null
          external_mappings?: Json | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          end_date?: string | null
          external_mappings?: Json | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_meta_ad_account_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          id: string
          meta_ad_account_id: string
          tenant_id: string
          token_last_four: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          id?: string
          meta_ad_account_id: string
          tenant_id: string
          token_last_four?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          id?: string
          meta_ad_account_id?: string
          tenant_id?: string
          token_last_four?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_meta_ad_account_tokens_meta_ad_account_id_fkey"
            columns: ["meta_ad_account_id"]
            isOneToOne: true
            referencedRelation: "marketing_meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_meta_ad_account_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_meta_ad_account_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_meta_ad_accounts: {
        Row: {
          account_name: string | null
          ad_account_id: string
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          tenant_id: string
          timezone_name: string | null
          token_last_four: string | null
          token_updated_at: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          ad_account_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          tenant_id: string
          timezone_name?: string | null
          token_last_four?: string | null
          token_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          ad_account_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          tenant_id?: string
          timezone_name?: string | null
          token_last_four?: string | null
          token_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_meta_ad_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_meta_ad_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_meta_ads_insights_daily: {
        Row: {
          actions: Json
          ad_account_id: string
          ad_id: string
          ad_name: string | null
          adset_id: string
          adset_name: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number
          cpc: number
          cpm: number
          created_at: string
          ctr: number
          date_start: string
          date_stop: string
          id: string
          impressions: number
          raw_payload: Json
          reach: number
          spend: number
          synced_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          ad_account_id: string
          ad_id?: string
          ad_name?: string | null
          adset_id?: string
          adset_name?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date_start: string
          date_stop: string
          id?: string
          impressions?: number
          raw_payload?: Json
          reach?: number
          spend?: number
          synced_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          ad_account_id?: string
          ad_id?: string
          ad_name?: string | null
          adset_id?: string
          adset_name?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date_start?: string
          date_stop?: string
          id?: string
          impressions?: number
          raw_payload?: Json
          reach?: number
          spend?: number
          synced_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_meta_ads_insights_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_meta_ads_insights_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_meta_ads_sync_runs: {
        Row: {
          ad_account_id: string
          created_at: string
          date_from: string
          date_to: string
          error_message: string | null
          finished_at: string | null
          id: string
          rows_synced: number
          started_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          date_from: string
          date_to: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number
          started_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          date_from?: string
          date_to?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number
          started_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_meta_ads_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_meta_ads_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_records: {
        Row: {
          benefits_redeemed: string[] | null
          created_at: string | null
          customer_id: string
          expires_at: string | null
          id: string
          points_used: number | null
          tenant_id: string | null
          tier: string | null
          tier_upgrade_date: string | null
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          benefits_redeemed?: string[] | null
          created_at?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          points_used?: number | null
          tenant_id?: string | null
          tier?: string | null
          tier_upgrade_date?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          benefits_redeemed?: string[] | null
          created_at?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          points_used?: number | null
          tenant_id?: string | null
          tier?: string | null
          tier_upgrade_date?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "membership_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          createdAt: string
          id: string
          isRead: boolean
          message: string
          tenantId: string
          title: string
          type: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          isRead?: boolean
          message: string
          tenantId: string
          title: string
          type?: string
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          isRead?: boolean
          message?: string
          tenantId?: string
          title?: string
          type?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: []
      }
      org_relationships: {
        Row: {
          created_at: string
          from_id: string
          from_type: string
          id: string
          metadata: Json
          rel_type: string
          role: string | null
          since: string | null
          tenant_id: string
          to_id: string
          to_type: string
          until: string | null
        }
        Insert: {
          created_at?: string
          from_id: string
          from_type: string
          id?: string
          metadata?: Json
          rel_type: string
          role?: string | null
          since?: string | null
          tenant_id: string
          to_id: string
          to_type: string
          until?: string | null
        }
        Update: {
          created_at?: string
          from_id?: string
          from_type?: string
          id?: string
          metadata?: Json
          rel_type?: string
          role?: string | null
          since?: string | null
          tenant_id?: string
          to_id?: string
          to_type?: string
          until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "org_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          parent_id: string | null
          tenant_id: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          parent_id?: string | null
          tenant_id: string
          unit_type: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          parent_id?: string | null
          tenant_id?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "org_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_materials: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          package_id: string
          quantity_per_session: number
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          package_id: string
          quantity_per_session?: number
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          package_id?: string
          quantity_per_session?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_inventory_status"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "package_materials_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "package_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          allowed_franchise_override: boolean | null
          before_after_required: boolean
          care_note_template: string | null
          created_at: string | null
          default_duration_minutes: number
          default_resource_type: string | null
          description: string | null
          details: string[] | null
          duration: string | null
          estimated_duration: number | null
          full_price: number
          id: string
          is_hq_template: boolean | null
          ktv_commission: number | null
          metadata: Json | null
          module_key: string
          name: string
          offer: string | null
          price: number | null
          price_cap: number | null
          price_floor: number | null
          product_usage: Json | null
          required_workers: number | null
          requires_resource: boolean
          service_category: string | null
          service_kind: string
          session_multiplier: number | null
          status: string | null
          template_id: string | null
          tenant_id: string | null
          total_sessions: number
          updated_at: string | null
        }
        Insert: {
          allowed_franchise_override?: boolean | null
          before_after_required?: boolean
          care_note_template?: string | null
          created_at?: string | null
          default_duration_minutes?: number
          default_resource_type?: string | null
          description?: string | null
          details?: string[] | null
          duration?: string | null
          estimated_duration?: number | null
          full_price?: number
          id?: string
          is_hq_template?: boolean | null
          ktv_commission?: number | null
          metadata?: Json | null
          module_key?: string
          name: string
          offer?: string | null
          price?: number | null
          price_cap?: number | null
          price_floor?: number | null
          product_usage?: Json | null
          required_workers?: number | null
          requires_resource?: boolean
          service_category?: string | null
          service_kind?: string
          session_multiplier?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          total_sessions?: number
          updated_at?: string | null
        }
        Update: {
          allowed_franchise_override?: boolean | null
          before_after_required?: boolean
          care_note_template?: string | null
          created_at?: string | null
          default_duration_minutes?: number
          default_resource_type?: string | null
          description?: string | null
          details?: string[] | null
          duration?: string | null
          estimated_duration?: number | null
          full_price?: number
          id?: string
          is_hq_template?: boolean | null
          ktv_commission?: number | null
          metadata?: Json | null
          module_key?: string
          name?: string
          offer?: string | null
          price?: number | null
          price_cap?: number | null
          price_floor?: number | null
          product_usage?: Json | null
          required_workers?: number | null
          requires_resource?: boolean
          service_category?: string | null
          service_kind?: string
          session_multiplier?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          total_sessions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_application_logs: {
        Row: {
          action: Database["public"]["Enums"]["partner_application_log_action"]
          action_description: string | null
          application_id: string
          created_at: string
          id: string
          new_status:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          old_status:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          performed_by_role: string | null
          performed_by_user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["partner_application_log_action"]
          action_description?: string | null
          application_id: string
          created_at?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          old_status?:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          performed_by_role?: string | null
          performed_by_user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["partner_application_log_action"]
          action_description?: string | null
          application_id?: string
          created_at?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          old_status?:
            | Database["public"]["Enums"]["partner_application_status"]
            | null
          performed_by_role?: string | null
          performed_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_application_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "partner_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          activated_at: string | null
          activation_token: string | null
          activation_token_expires_at: string | null
          additional_info_requested: string | null
          additional_notes: string | null
          approval_notes: string | null
          business_type: Database["public"]["Enums"]["partner_applicant_type"]
          city: string | null
          company_address: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          documents: Json | null
          email: string
          email_verified_at: string | null
          expected_monthly_sales: number | null
          full_name: string
          id: string
          identity_id: string | null
          phone: string
          provisioned_at: string | null
          referral_source: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["partner_application_status"]
          submitted_at: string | null
          tax_code: string | null
          tenant_id: string | null
          updated_at: string
          verification_token: string | null
          verification_token_expires_at: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_token?: string | null
          activation_token_expires_at?: string | null
          additional_info_requested?: string | null
          additional_notes?: string | null
          approval_notes?: string | null
          business_type?: Database["public"]["Enums"]["partner_applicant_type"]
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          documents?: Json | null
          email: string
          email_verified_at?: string | null
          expected_monthly_sales?: number | null
          full_name: string
          id?: string
          identity_id?: string | null
          phone: string
          provisioned_at?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["partner_application_status"]
          submitted_at?: string | null
          tax_code?: string | null
          tenant_id?: string | null
          updated_at?: string
          verification_token?: string | null
          verification_token_expires_at?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_token?: string | null
          activation_token_expires_at?: string | null
          additional_info_requested?: string | null
          additional_notes?: string | null
          approval_notes?: string | null
          business_type?: Database["public"]["Enums"]["partner_applicant_type"]
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          documents?: Json | null
          email?: string
          email_verified_at?: string | null
          expected_monthly_sales?: number | null
          full_name?: string
          id?: string
          identity_id?: string | null
          phone?: string
          provisioned_at?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["partner_application_status"]
          submitted_at?: string | null
          tax_code?: string | null
          tenant_id?: string | null
          updated_at?: string
          verification_token?: string | null
          verification_token_expires_at?: string | null
        }
        Relationships: []
      }
      people_directory: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          metadata: Json
          person_type: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          metadata?: Json
          person_type: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          person_type?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_directory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_directory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          metadata: Json
          org_unit_ids: string[] | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          metadata?: Json
          org_unit_ids?: string[] | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          org_unit_ids?: string[] | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          condition: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          multiplier: number
          priority: number
          rule_name: string
          rule_type: string
          tenant_id: string
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          condition: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          multiplier: number
          priority?: number
          rule_name: string
          rule_type: string
          tenant_id: string
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          condition?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          multiplier?: number
          priority?: number
          rule_name?: string
          rule_type?: string
          tenant_id?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pricing_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          booking_id: string | null
          calculated_commission: number
          created_at: string
          customer_id: string | null
          id: string
          ktv_id: string
          notes: string | null
          override_commission_type: string | null
          override_commission_value: number | null
          payment_method: string | null
          product_category: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          sale_date: string
          status: string
          tenant_id: string
          total_sales_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          calculated_commission?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          ktv_id: string
          notes?: string | null
          override_commission_type?: string | null
          override_commission_value?: number | null
          payment_method?: string | null
          product_category?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          sale_date: string
          status?: string
          tenant_id: string
          total_sales_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          calculated_commission?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          ktv_id?: string
          notes?: string | null
          override_commission_type?: string | null
          override_commission_value?: number | null
          payment_method?: string | null
          product_category?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          sale_date?: string
          status?: string
          tenant_id?: string
          total_sales_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "product_sales_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "product_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          description: string
          discount_code: string | null
          discount_percent: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          start_date: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount_code?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_code?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_bookings: {
        Row: {
          booking_fee: number
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          product_id: string
          reservation_id: string | null
          state: Database["public"]["Enums"]["booking_state"]
          state_changed_at: string | null
          submitted_at: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booking_fee?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          product_id: string
          reservation_id?: string | null
          state?: Database["public"]["Enums"]["booking_state"]
          state_changed_at?: string | null
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booking_fee?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          product_id?: string
          reservation_id?: string | null
          state?: Database["public"]["Enums"]["booking_state"]
          state_changed_at?: string | null
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "real_estate_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_bookings_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "re_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      re_commission_ledger: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          commission_amount: number
          commission_rate: number | null
          commission_type: string
          created_at: string
          earned_date: string
          expected_payout_date: string | null
          id: string
          metadata: Json
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          person_id: string | null
          product_id: string | null
          status: string
          tenant_id: string
          transaction_id: string | null
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          commission_amount: number
          commission_rate?: number | null
          commission_type: string
          created_at?: string
          earned_date: string
          expected_payout_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          person_id?: string | null
          product_id?: string | null
          status?: string
          tenant_id: string
          transaction_id?: string | null
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          commission_amount?: number
          commission_rate?: number | null
          commission_type?: string
          created_at?: string
          earned_date?: string
          expected_payout_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          person_id?: string | null
          product_id?: string | null
          status?: string
          tenant_id?: string
          transaction_id?: string | null
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_commission_ledger_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_commission_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "real_estate_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_commission_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_commission_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_commissions: {
        Row: {
          agent_id: string
          approved_at: string | null
          base_amount: number
          booking_id: string | null
          commission_amount: number
          commission_percentage: number | null
          contract_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          earned_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          approved_at?: string | null
          base_amount: number
          booking_id?: string | null
          commission_amount: number
          commission_percentage?: number | null
          contract_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          earned_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          approved_at?: string | null
          base_amount?: number
          booking_id?: string | null
          commission_amount?: number
          commission_percentage?: number | null
          contract_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          earned_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "re_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "re_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      re_contracts: {
        Row: {
          activated_at: string | null
          booking_id: string | null
          contract_number: string | null
          contract_price: number
          created_at: string | null
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          end_date: string | null
          id: string
          installments: Json | null
          metadata: Json | null
          notes: string | null
          product_id: string
          signed_date: string | null
          start_date: string | null
          state: Database["public"]["Enums"]["contract_state"]
          state_changed_at: string | null
          submitted_at: string | null
          tenant_id: string
          terminated_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          booking_id?: string | null
          contract_number?: string | null
          contract_price: number
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          installments?: Json | null
          metadata?: Json | null
          notes?: string | null
          product_id: string
          signed_date?: string | null
          start_date?: string | null
          state?: Database["public"]["Enums"]["contract_state"]
          state_changed_at?: string | null
          submitted_at?: string | null
          tenant_id: string
          terminated_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          booking_id?: string | null
          contract_number?: string | null
          contract_price?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          installments?: Json | null
          metadata?: Json | null
          notes?: string | null
          product_id?: string
          signed_date?: string | null
          start_date?: string | null
          state?: Database["public"]["Enums"]["contract_state"]
          state_changed_at?: string | null
          submitted_at?: string | null
          tenant_id?: string
          terminated_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "re_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "real_estate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_customers: {
        Row: {
          co_owners: Json | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          family_members: Json | null
          id: string
          investment_profile: Json | null
          metadata: Json | null
          name: string
          phone: string
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          co_owners?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_members?: Json | null
          id?: string
          investment_profile?: Json | null
          metadata?: Json | null
          name: string
          phone: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          co_owners?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_members?: Json | null
          id?: string
          investment_profile?: Json | null
          metadata?: Json | null
          name?: string
          phone?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      re_documents: {
        Row: {
          allowed_roles: string[] | null
          created_at: string
          description: string | null
          document_type: string
          download_count: number
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_latest: boolean
          is_public: boolean
          metadata: Json
          mime_type: string | null
          project_id: string | null
          supersedes_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          allowed_roles?: string[] | null
          created_at?: string
          description?: string | null
          document_type: string
          download_count?: number
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_latest?: boolean
          is_public?: boolean
          metadata?: Json
          mime_type?: string | null
          project_id?: string | null
          supersedes_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Update: {
          allowed_roles?: string[] | null
          created_at?: string
          description?: string | null
          document_type?: string
          download_count?: number
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_latest?: boolean
          is_public?: boolean
          metadata?: Json
          mime_type?: string | null
          project_id?: string | null
          supersedes_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "real_estate_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "re_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          lost_reason: string | null
          metadata: Json | null
          name: string
          phone: string
          source: string | null
          state: Database["public"]["Enums"]["lead_state"]
          state_changed_at: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name: string
          phone: string
          source?: string | null
          state?: Database["public"]["Enums"]["lead_state"]
          state_changed_at?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name?: string
          phone?: string
          source?: string | null
          state?: Database["public"]["Enums"]["lead_state"]
          state_changed_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      re_partner_leads: {
        Row: {
          budget: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          phone: string
          protected_until: string
          status: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          budget?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          phone: string
          protected_until: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          budget?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          phone?: string
          protected_until?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_partner_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_partner_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_partner_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_partner_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_partner_leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_partner_leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_partner_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_partner_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      re_project_checkins: {
        Row: {
          checkin_lat: number | null
          checkin_lng: number | null
          checkin_time: string
          checkout_lat: number | null
          checkout_lng: number | null
          checkout_time: string | null
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          person_id: string | null
          photo_urls: string[] | null
          project_id: string
          qr_code_scanned: string | null
          tenant_id: string
          user_id: string
          verification_method: string | null
          visit_purpose: string | null
        }
        Insert: {
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_time?: string
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_time?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          person_id?: string | null
          photo_urls?: string[] | null
          project_id: string
          qr_code_scanned?: string | null
          tenant_id: string
          user_id: string
          verification_method?: string | null
          visit_purpose?: string | null
        }
        Update: {
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_time?: string
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_time?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          person_id?: string | null
          photo_urls?: string[] | null
          project_id?: string
          qr_code_scanned?: string | null
          tenant_id?: string
          user_id?: string
          verification_method?: string | null
          visit_purpose?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_project_checkins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_project_checkins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "real_estate_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_project_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_project_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_reservations: {
        Row: {
          cancelled_at: string | null
          converted_at: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          deposited_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          product_id: string
          reserved_at: string | null
          status: Database["public"]["Enums"]["re_reservation_status"]
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deposited_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          product_id: string
          reserved_at?: string | null
          status?: Database["public"]["Enums"]["re_reservation_status"]
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deposited_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string
          reserved_at?: string | null
          status?: Database["public"]["Enums"]["re_reservation_status"]
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "real_estate_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "re_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      re_sales_kpi_targets: {
        Row: {
          achievement_rate: number
          actual_bookings: number
          actual_contracts: number
          actual_deposits: number
          actual_leads: number
          actual_revenue: number
          actual_site_visits: number
          created_at: string
          id: string
          metadata: Json
          month_year: string
          person_id: string | null
          target_bookings: number
          target_contracts: number
          target_deposits: number
          target_leads: number
          target_revenue: number
          target_site_visits: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_rate?: number
          actual_bookings?: number
          actual_contracts?: number
          actual_deposits?: number
          actual_leads?: number
          actual_revenue?: number
          actual_site_visits?: number
          created_at?: string
          id?: string
          metadata?: Json
          month_year: string
          person_id?: string | null
          target_bookings?: number
          target_contracts?: number
          target_deposits?: number
          target_leads?: number
          target_revenue?: number
          target_site_visits?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_rate?: number
          actual_bookings?: number
          actual_contracts?: number
          actual_deposits?: number
          actual_leads?: number
          actual_revenue?: number
          actual_site_visits?: number
          created_at?: string
          id?: string
          metadata?: Json
          month_year?: string
          person_id?: string | null
          target_bookings?: number
          target_contracts?: number
          target_deposits?: number
          target_leads?: number
          target_revenue?: number
          target_site_visits?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_sales_kpi_targets_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_sales_kpi_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_sales_kpi_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_tasks: {
        Row: {
          assigned_to_person_id: string | null
          assigned_to_user_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          metadata: Json
          priority: string
          related_customer_id: string | null
          related_lead_id: string | null
          related_product_id: string | null
          reminder_enabled: boolean
          reminder_time: string | null
          status: string
          task_type: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_person_id?: string | null
          assigned_to_user_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          metadata?: Json
          priority?: string
          related_customer_id?: string | null
          related_lead_id?: string | null
          related_product_id?: string | null
          reminder_enabled?: boolean
          reminder_time?: string | null
          status?: string
          task_type: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_person_id?: string | null
          assigned_to_user_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          metadata?: Json
          priority?: string
          related_customer_id?: string | null
          related_lead_id?: string | null
          related_product_id?: string | null
          reminder_enabled?: boolean
          reminder_time?: string | null
          status?: string
          task_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_tasks_assigned_to_person_id_fkey"
            columns: ["assigned_to_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_tasks_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "real_estate_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "re_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      re_transactions: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          id: string
          installment_number: number | null
          metadata: Json | null
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          status: string | null
          tenant_id: string
          transaction_date: string
          transaction_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          installment_number?: number | null
          metadata?: Json | null
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string | null
          tenant_id: string
          transaction_date: string
          transaction_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          installment_number?: number | null
          metadata?: Json | null
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string | null
          tenant_id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "re_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      real_estate_products: {
        Row: {
          area: number
          area_m2: number | null
          block: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction: string | null
          floor: string | null
          floor_number: number | null
          id: string
          metadata: Json | null
          owner_name: string | null
          product_code: string
          product_type: Database["public"]["Enums"]["re_product_type"]
          project_id: string
          status: Database["public"]["Enums"]["re_product_status"]
          tenant_id: string
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area?: number
          area_m2?: number | null
          block?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string | null
          floor?: string | null
          floor_number?: number | null
          id?: string
          metadata?: Json | null
          owner_name?: string | null
          product_code: string
          product_type: Database["public"]["Enums"]["re_product_type"]
          project_id: string
          status: Database["public"]["Enums"]["re_product_status"]
          tenant_id: string
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: number
          area_m2?: number | null
          block?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string | null
          floor?: string | null
          floor_number?: number | null
          id?: string
          metadata?: Json | null
          owner_name?: string | null
          product_code?: string
          product_type?: Database["public"]["Enums"]["re_product_type"]
          project_id?: string
          status?: Database["public"]["Enums"]["re_product_status"]
          tenant_id?: string
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "real_estate_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_estate_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "real_estate_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_estate_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "real_estate_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_estate_products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "real_estate_products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      real_estate_projects: {
        Row: {
          code: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          developer: string | null
          id: string
          launch_date: string | null
          location: string | null
          metadata: Json | null
          name: string
          status: string
          tenant_id: string
          total_units: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          developer?: string | null
          id?: string
          launch_date?: string | null
          location?: string | null
          metadata?: Json | null
          name: string
          status?: string
          tenant_id: string
          total_units?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          developer?: string | null
          id?: string
          launch_date?: string | null
          location?: string | null
          metadata?: Json | null
          name?: string
          status?: string
          tenant_id?: string
          total_units?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "real_estate_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_estate_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "real_estate_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_estate_projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "real_estate_projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_cache: {
        Row: {
          algorithm_name: string
          algorithm_version: string
          cache_key: string
          confidence_score: number | null
          context: Json | null
          created_at: string
          created_by: string | null
          customer_id: string
          diversity_score: number | null
          expires_at: string
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          recommendation_type: string
          recommendations: Json
          relevance_score: number | null
          tenant_id: string
        }
        Insert: {
          algorithm_name: string
          algorithm_version: string
          cache_key: string
          confidence_score?: number | null
          context?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          diversity_score?: number | null
          expires_at: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          recommendation_type: string
          recommendations: Json
          relevance_score?: number | null
          tenant_id: string
        }
        Update: {
          algorithm_name?: string
          algorithm_version?: string
          cache_key?: string
          confidence_score?: number | null
          context?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          diversity_score?: number | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          recommendation_type?: string
          recommendations?: Json
          relevance_score?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_cache_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recommendation_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          applied_at: string
          certifications: string[] | null
          cover_letter: string | null
          created_at: string
          current_company: string | null
          current_stage: string
          current_title: string | null
          date_of_birth: string | null
          education_level: string | null
          email: string | null
          full_name: string
          hired_as_user_id: string | null
          hired_at: string | null
          id: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          position_id: string
          recruitment_cost: number | null
          rejection_reason: string | null
          resume_url: string | null
          screened_at: string | null
          screened_by: string | null
          screening_notes: string | null
          screening_status: string
          skills: string[] | null
          source: string
          source_details: string | null
          stage_updated_at: string
          status: string
          tenant_id: string
          updated_at: string
          years_of_experience: number | null
        }
        Insert: {
          applied_at?: string
          certifications?: string[] | null
          cover_letter?: string | null
          created_at?: string
          current_company?: string | null
          current_stage?: string
          current_title?: string | null
          date_of_birth?: string | null
          education_level?: string | null
          email?: string | null
          full_name: string
          hired_as_user_id?: string | null
          hired_at?: string | null
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          position_id: string
          recruitment_cost?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          screened_at?: string | null
          screened_by?: string | null
          screening_notes?: string | null
          screening_status?: string
          skills?: string[] | null
          source?: string
          source_details?: string | null
          stage_updated_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
          years_of_experience?: number | null
        }
        Update: {
          applied_at?: string
          certifications?: string[] | null
          cover_letter?: string | null
          created_at?: string
          current_company?: string | null
          current_stage?: string
          current_title?: string | null
          date_of_birth?: string | null
          education_level?: string | null
          email?: string | null
          full_name?: string
          hired_as_user_id?: string | null
          hired_at?: string | null
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          position_id?: string
          recruitment_cost?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          screened_at?: string | null
          screened_by?: string | null
          screening_notes?: string | null
          screening_status?: string
          skills?: string[] | null
          source?: string
          source_details?: string | null
          stage_updated_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_hired_as_user_id_fkey"
            columns: ["hired_as_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_candidates_hired_as_user_id_fkey"
            columns: ["hired_as_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "recruitment_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_screened_by_fkey"
            columns: ["screened_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_candidates_screened_by_fkey"
            columns: ["screened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recruitment_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interviews: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          candidate_id: string
          communication_rating: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          cultural_fit_rating: number | null
          duration_minutes: number | null
          feedback_at: string | null
          feedback_by: string | null
          feedback_notes: string | null
          id: string
          interview_round: number
          interview_type: string
          interviewer_ids: string[] | null
          location: string | null
          overall_rating: number | null
          position_id: string
          recommendation: string | null
          scheduled_at: string
          status: string
          technical_rating: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          candidate_id: string
          communication_rating?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cultural_fit_rating?: number | null
          duration_minutes?: number | null
          feedback_at?: string | null
          feedback_by?: string | null
          feedback_notes?: string | null
          id?: string
          interview_round?: number
          interview_type?: string
          interviewer_ids?: string[] | null
          location?: string | null
          overall_rating?: number | null
          position_id: string
          recommendation?: string | null
          scheduled_at: string
          status?: string
          technical_rating?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          candidate_id?: string
          communication_rating?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cultural_fit_rating?: number | null
          duration_minutes?: number | null
          feedback_at?: string | null
          feedback_by?: string | null
          feedback_notes?: string | null
          id?: string
          interview_round?: number
          interview_type?: string
          interviewer_ids?: string[] | null
          location?: string | null
          overall_rating?: number | null
          position_id?: string
          recommendation?: string | null
          scheduled_at?: string
          status?: string
          technical_rating?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_feedback_by_fkey"
            columns: ["feedback_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_interviews_feedback_by_fkey"
            columns: ["feedback_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "recruitment_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recruitment_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_pipelines: {
        Row: {
          candidate_id: string
          created_at: string
          from_stage: string | null
          id: string
          notes: string | null
          tenant_id: string
          to_stage: string
          transitioned_at: string
          transitioned_by: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          notes?: string | null
          tenant_id: string
          to_stage: string
          transitioned_at?: string
          transitioned_by?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          notes?: string | null
          tenant_id?: string
          to_stage?: string
          transitioned_at?: string
          transitioned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_pipelines_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recruitment_pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_pipelines_transitioned_by_fkey"
            columns: ["transitioned_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_pipelines_transitioned_by_fkey"
            columns: ["transitioned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_positions: {
        Row: {
          benefits: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          department: string
          employment_type: string
          experience_level: string
          headcount_filled: number
          headcount_target: number
          id: string
          job_description: string | null
          min_experience_years: number | null
          opened_at: string | null
          position_title: string
          required_certifications: string[] | null
          required_skills: string[] | null
          responsibilities: string | null
          role: string
          salary_max: number | null
          salary_min: number | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department: string
          employment_type?: string
          experience_level?: string
          headcount_filled?: number
          headcount_target?: number
          id?: string
          job_description?: string | null
          min_experience_years?: number | null
          opened_at?: string | null
          position_title: string
          required_certifications?: string[] | null
          required_skills?: string[] | null
          responsibilities?: string | null
          role: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department?: string
          employment_type?: string
          experience_level?: string
          headcount_filled?: number
          headcount_target?: number
          id?: string
          job_description?: string | null
          min_experience_years?: number | null
          opened_at?: string | null
          position_title?: string
          required_certifications?: string[] | null
          required_skills?: string[] | null
          responsibilities?: string | null
          role?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_positions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "recruitment_positions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recruitment_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue: {
        Row: {
          accounting_metadata: Json
          accounting_review_status: string
          accounting_template_id: string | null
          amount: number
          booking_id: string | null
          business_event_type: string | null
          id: string
          is_locked: boolean | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          received_date: string
          recorded_by_id: string | null
          revenue_type: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          amount: number
          booking_id?: string | null
          business_event_type?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          received_date: string
          recorded_by_id?: string | null
          revenue_type?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          amount?: number
          booking_id?: string | null
          business_event_type?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          received_date?: string
          recorded_by_id?: string | null
          revenue_type?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_accounting_template_id_fkey"
            columns: ["accounting_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recorded_by_id_fkey"
            columns: ["recorded_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "revenue_recorded_by_id_fkey"
            columns: ["recorded_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "revenue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          notes: string | null
          room_name: string | null
          room_number: string
          room_type: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          room_name?: string | null
          room_number: string
          room_type?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          room_name?: string | null
          room_number?: string
          room_type?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_approvals: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          reviewed_at: string | null
          reviewer_id: string | null
          rule_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          rule_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rule_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rule_approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rule_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_simulations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          results: Json
          summary: Json
          tenant_id: string
          test_data: Json
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          results: Json
          summary: Json
          tenant_id: string
          test_data: Json
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          results?: Json
          summary?: Json
          tenant_id?: string
          test_data?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_simulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rule_simulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_simulations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rule_simulations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_simulations_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_test_results: {
        Row: {
          actual_output: Json | null
          error_message: string | null
          executed_actions: Json | null
          execution_time_ms: number | null
          expected_output: Json | null
          id: string
          input_data: Json
          matched_conditions: Json | null
          passed: boolean
          rule_id: string
          tenant_id: string
          test_name: string | null
          test_type: string
          tested_at: string
          tested_by: string | null
          trace: Json | null
        }
        Insert: {
          actual_output?: Json | null
          error_message?: string | null
          executed_actions?: Json | null
          execution_time_ms?: number | null
          expected_output?: Json | null
          id?: string
          input_data: Json
          matched_conditions?: Json | null
          passed: boolean
          rule_id: string
          tenant_id: string
          test_name?: string | null
          test_type: string
          tested_at?: string
          tested_by?: string | null
          trace?: Json | null
        }
        Update: {
          actual_output?: Json | null
          error_message?: string | null
          executed_actions?: Json | null
          execution_time_ms?: number | null
          expected_output?: Json | null
          id?: string
          input_data?: Json
          matched_conditions?: Json | null
          passed?: boolean
          rule_id?: string
          tenant_id?: string
          test_name?: string | null
          test_type?: string
          tested_at?: string
          tested_by?: string | null
          trace?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_test_results_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_test_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rule_test_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_test_results_tested_by_fkey"
            columns: ["tested_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rule_test_results_tested_by_fkey"
            columns: ["tested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_versions: {
        Row: {
          change_summary: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          diff: Json | null
          id: string
          rule_id: string
          snapshot: Json
          tenant_id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          rule_id: string
          snapshot: Json
          tenant_id: string
          version: number
        }
        Update: {
          change_summary?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          rule_id?: string
          snapshot?: Json
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rule_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rule_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          actions: Json
          activated_at: string | null
          approval_comment: string | null
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          category: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          description: string | null
          id: string
          name: string
          parent_rule_id: string | null
          priority: number
          provider: string
          scheduled_activation_at: string | null
          status: string
          submitted_by: string | null
          submitted_for_approval_at: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          actions?: Json
          activated_at?: string | null
          approval_comment?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_rule_id?: string | null
          priority?: number
          provider: string
          scheduled_activation_at?: string | null
          status?: string
          submitted_by?: string | null
          submitted_for_approval_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          actions?: Json
          activated_at?: string | null
          approval_comment?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_rule_id?: string | null
          priority?: number
          provider?: string
          scheduled_activation_at?: string | null
          status?: string
          submitted_by?: string | null
          submitted_for_approval_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_parent_rule_id_fkey"
            columns: ["parent_rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rules_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          approved_at: string | null
          approved_by_id: string | null
          category: string
          created_at: string
          created_by_id: string
          id: string
          ktv_id: string
          month_year: string
          notes: string | null
          reason: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          approved_at?: string | null
          approved_by_id?: string | null
          category: string
          created_at?: string
          created_by_id: string
          id?: string
          ktv_id: string
          month_year: string
          notes?: string | null
          reason: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          approved_at?: string | null
          approved_by_id?: string | null
          category?: string
          created_at?: string
          created_by_id?: string
          id?: string
          ktv_id?: string
          month_year?: string
          notes?: string | null
          reason?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_adjustments_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_adjustments_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_adjustments_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "salary_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_disputes: {
        Row: {
          admin_response: string | null
          created_at: string | null
          dispute_reason: string
          id: string
          ktv_id: string
          resolved_at: string | null
          salary_record_id: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          dispute_reason: string
          id?: string
          ktv_id: string
          resolved_at?: string | null
          salary_record_id: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          dispute_reason?: string
          id?: string
          ktv_id?: string
          resolved_at?: string | null
          salary_record_id?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_disputes_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_disputes_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_disputes_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "salary_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_disputes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "salary_disputes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          accounting_metadata: Json
          accounting_review_status: string
          accounting_template_id: string | null
          base_salary: number | null
          business_event_type: string | null
          confirmed_by_admin: boolean | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          finalized_at: string | null
          id: string
          is_locked: boolean | null
          kpi_bonus: number | null
          ktv_confirmed_at: string | null
          ktv_id: string
          manual_adjustments: number
          month_year: string
          notes: string | null
          paid_date: string | null
          paid_method: string | null
          position_bonus: number
          product_sales_commission: number
          published_at: string | null
          rating_bonus: number | null
          seniority_bonus: number
          service_commission: number
          service_percentage_bonus: number | null
          session_bonus: number | null
          status: string | null
          tenant_id: string | null
          total_salary: number | null
          total_sessions: number | null
          violations_deduction: number | null
        }
        Insert: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          base_salary?: number | null
          business_event_type?: string | null
          confirmed_by_admin?: boolean | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          finalized_at?: string | null
          id?: string
          is_locked?: boolean | null
          kpi_bonus?: number | null
          ktv_confirmed_at?: string | null
          ktv_id: string
          manual_adjustments?: number
          month_year: string
          notes?: string | null
          paid_date?: string | null
          paid_method?: string | null
          position_bonus?: number
          product_sales_commission?: number
          published_at?: string | null
          rating_bonus?: number | null
          seniority_bonus?: number
          service_commission?: number
          service_percentage_bonus?: number | null
          session_bonus?: number | null
          status?: string | null
          tenant_id?: string | null
          total_salary?: number | null
          total_sessions?: number | null
          violations_deduction?: number | null
        }
        Update: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          base_salary?: number | null
          business_event_type?: string | null
          confirmed_by_admin?: boolean | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          finalized_at?: string | null
          id?: string
          is_locked?: boolean | null
          kpi_bonus?: number | null
          ktv_confirmed_at?: string | null
          ktv_id?: string
          manual_adjustments?: number
          month_year?: string
          notes?: string | null
          paid_date?: string | null
          paid_method?: string | null
          position_bonus?: number
          product_sales_commission?: number
          published_at?: string | null
          rating_bonus?: number | null
          seniority_bonus?: number
          service_commission?: number
          service_percentage_bonus?: number | null
          session_bonus?: number | null
          status?: string | null
          tenant_id?: string | null
          total_salary?: number | null
          total_sessions?: number | null
          violations_deduction?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_accounting_template_id_fkey"
            columns: ["accounting_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "salary_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          accounting_metadata: Json
          accounting_review_status: string
          accounting_template_id: string | null
          actual_duration: number | null
          address: string | null
          assigned_date: string | null
          assigned_time: string | null
          booking_id: string
          booking_resource_id: string | null
          business_event_type: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          checkout_lat: number | null
          checkout_lon: number | null
          completed_by_ktv_id: string | null
          completed_date: string | null
          created_at: string | null
          duration_warning_type: string | null
          end_time: string | null
          id: string
          is_confirmed: boolean | null
          ktv_checkout_note: string | null
          notes: string | null
          rating: number | null
          rating_comment: string | null
          session_number: number
          standard_duration: number | null
          start_time: string | null
          status: string | null
          tenant_id: string
          time_deviation: number | null
          zalo_reminder_sent: boolean | null
          zalo_reminder_time: string | null
        }
        Insert: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          actual_duration?: number | null
          address?: string | null
          assigned_date?: string | null
          assigned_time?: string | null
          booking_id: string
          booking_resource_id?: string | null
          business_event_type?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          completed_by_ktv_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          duration_warning_type?: string | null
          end_time?: string | null
          id?: string
          is_confirmed?: boolean | null
          ktv_checkout_note?: string | null
          notes?: string | null
          rating?: number | null
          rating_comment?: string | null
          session_number: number
          standard_duration?: number | null
          start_time?: string | null
          status?: string | null
          tenant_id: string
          time_deviation?: number | null
          zalo_reminder_sent?: boolean | null
          zalo_reminder_time?: string | null
        }
        Update: {
          accounting_metadata?: Json
          accounting_review_status?: string
          accounting_template_id?: string | null
          actual_duration?: number | null
          address?: string | null
          assigned_date?: string | null
          assigned_time?: string | null
          booking_id?: string
          booking_resource_id?: string | null
          business_event_type?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          completed_by_ktv_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          duration_warning_type?: string | null
          end_time?: string | null
          id?: string
          is_confirmed?: boolean | null
          ktv_checkout_note?: string | null
          notes?: string | null
          rating?: number | null
          rating_comment?: string | null
          session_number?: number
          standard_duration?: number | null
          start_time?: string | null
          status?: string | null
          tenant_id?: string
          time_deviation?: number | null
          zalo_reminder_sent?: boolean | null
          zalo_reminder_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_accounting_template_id_fkey"
            columns: ["accounting_template_id"]
            isOneToOne: false
            referencedRelation: "accounting_event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_booking_resource_id_fkey"
            columns: ["booking_resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_completed_by_ktv_id_fkey"
            columns: ["completed_by_ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "session_logs_completed_by_ktv_id_fkey"
            columns: ["completed_by_ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "session_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reviews: {
        Row: {
          created_at: string | null
          id: string
          is_hidden_from_ktv: boolean | null
          ktv_id: string | null
          note: string | null
          note_encrypted: boolean | null
          rating: number
          reviewer_id: string | null
          session_log_id: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_hidden_from_ktv?: boolean | null
          ktv_id?: string | null
          note?: string | null
          note_encrypted?: boolean | null
          rating: number
          reviewer_id?: string | null
          session_log_id: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_hidden_from_ktv?: boolean | null
          ktv_id?: string | null
          note?: string | null
          note_encrypted?: boolean | null
          rating?: number
          reviewer_id?: string | null
          session_log_id?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reviews_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "session_reviews_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reviews_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "session_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          address: string | null
          booking_id: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          checkin_time: string | null
          checkout_lat: number | null
          checkout_lon: number | null
          checkout_time: string | null
          customer_id: string | null
          date: string
          end_time: string | null
          id: string
          ktv_id: string
          start_time: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          booking_id?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkin_time?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          checkout_time?: string | null
          customer_id?: string | null
          date: string
          end_time?: string | null
          id?: string
          ktv_id: string
          start_time?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          booking_id?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkin_time?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          checkout_time?: string | null
          customer_id?: string | null
          date?: string
          end_time?: string | null
          id?: string
          ktv_id?: string
          start_time?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "shifts_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leaves: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          leave_date: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          leave_date: string
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          leave_date?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leaves_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "staff_leaves_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leaves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "staff_leaves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leaves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "staff_leaves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_attendance: {
        Row: {
          attendance_status: string
          checked_by: string | null
          checked_in_at: string | null
          class_id: string
          created_at: string
          id: string
          note: string | null
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attendance_status?: string
          checked_by?: string | null
          checked_in_at?: string | null
          class_id: string
          created_at?: string
          id?: string
          note?: string | null
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attendance_status?: string
          checked_by?: string | null
          checked_in_at?: string | null
          class_id?: string
          created_at?: string
          id?: string
          note?: string | null
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_class_attendance_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "student_class_attendance_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "training_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "student_class_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          last_accessed_at: string
          lesson_id: string
          student_id: string
          tenant_id: string
          time_spent_seconds: number
          updated_at: string
          view_percentage: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_accessed_at?: string
          lesson_id: string
          student_id: string
          tenant_id: string
          time_spent_seconds?: number
          updated_at?: string
          view_percentage?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_accessed_at?: string
          lesson_id?: string
          student_id?: string
          tenant_id?: string
          time_spent_seconds?: number
          updated_at?: string
          view_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "student_lesson_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tuition_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_at: string
          payment_method: string
          payment_status: string
          receipt_number: string | null
          recorded_by: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          payment_method?: string
          payment_status?: string
          receipt_number?: string | null
          recorded_by?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          payment_method?: string
          payment_status?: string
          receipt_number?: string | null
          recorded_by?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_tuition_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "student_tuition_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tuition_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tuition_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "student_tuition_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          course_id: string
          created_at: string
          email: string | null
          enrolled_at: string
          enrollment_status: string
          full_name: string
          graduated_at: string | null
          id: string
          notes: string | null
          phone: string | null
          tenant_id: string
          tuition_paid: number
          tuition_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          email?: string | null
          enrolled_at?: string
          enrollment_status?: string
          full_name: string
          graduated_at?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          tuition_paid?: number
          tuition_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          email?: string | null
          enrolled_at?: string
          enrollment_status?: string
          full_name?: string
          graduated_at?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          tuition_paid?: number
          tuition_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          created_at: string | null
          duration_months: number
          id: string
          invoice_number: string
          paid_at: string | null
          payment_method: string | null
          status: string | null
          tenant_id: string | null
          tier: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          duration_months: number
          id?: string
          invoice_number: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          tenant_id?: string | null
          tier: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          duration_months?: number
          id?: string
          invoice_number?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          tenant_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "subscription_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_entitlements: {
        Row: {
          created_at: string
          description: string | null
          enforcement_mode: string
          feature_key: string
          id: string
          is_unlimited: boolean
          limit_value: number | null
          plan_code: string
          reset_period: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enforcement_mode?: string
          feature_key: string
          id?: string
          is_unlimited?: boolean
          limit_value?: number | null
          plan_code: string
          reset_period?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enforcement_mode?: string
          feature_key?: string
          id?: string
          is_unlimited?: boolean
          limit_value?: number | null
          plan_code?: string
          reset_period?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_entitlements_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
          plan_code: string
          price_monthly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          is_active?: boolean
          plan_code: string
          price_monthly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          is_active?: boolean
          plan_code?: string
          price_monthly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenant_payroll_config: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          notes: string | null
          provider_key: string
          strategy: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          notes?: string | null
          provider_key: string
          strategy?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          notes?: string | null
          provider_key?: string
          strategy?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      tenant_payroll_config_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          config_id: string | null
          id: string
          ip_address: unknown
          new_value: Json
          old_value: Json | null
          provider_key: string
          reason: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          config_id?: string | null
          id?: string
          ip_address?: unknown
          new_value: Json
          old_value?: Json | null
          provider_key: string
          reason?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          config_id?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json
          old_value?: Json | null
          provider_key?: string
          reason?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payroll_config_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "tenant_payroll_config"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscription_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          enforcement_mode: string
          expires_at: string | null
          feature_key: string
          id: string
          is_active: boolean
          is_unlimited: boolean
          limit_value: number | null
          reason: string | null
          reset_period: string
          starts_at: string
          tenant_id: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enforcement_mode?: string
          expires_at?: string | null
          feature_key: string
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          limit_value?: number | null
          reason?: string | null
          reset_period?: string
          starts_at?: string
          tenant_id: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enforcement_mode?: string
          expires_at?: string | null
          feature_key?: string
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          limit_value?: number | null
          reason?: string | null
          reset_period?: string
          starts_at?: string
          tenant_id?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscription_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "tenant_subscription_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscription_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_subscription_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscription_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "tenant_subscription_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_counters: {
        Row: {
          feature_key: string
          last_increment_at: string | null
          metadata: Json
          period_end: string
          period_start: string
          tenant_id: string
          updated_at: string
          used_value: number
        }
        Insert: {
          feature_key: string
          last_increment_at?: string | null
          metadata?: Json
          period_end: string
          period_start: string
          tenant_id: string
          updated_at?: string
          used_value?: number
        }
        Update: {
          feature_key?: string
          last_increment_at?: string | null
          metadata?: Json
          period_end?: string
          period_start?: string
          tenant_id?: string
          updated_at?: string
          used_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accounting_mode: string | null
          address: string | null
          brand_theme: Json
          commission_config: Json | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          email: string | null
          enabled_modules: Json
          franchise_agreement_date: string | null
          gps_threshold_m: number | null
          id: string
          internal_clearing_rate: number | null
          logo_url: string | null
          metadata: Json | null
          name: string
          parent_tenant_id: string | null
          qr_account_name: string | null
          qr_account_number: string | null
          qr_bank_code: string | null
          role_permissions: Json | null
          royalty_fixed_amount: number | null
          royalty_rate: number | null
          royalty_type: string | null
          salary_config: Json | null
          sms_allotment_used: number | null
          status: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          tenant_lat: number | null
          tenant_lon: number | null
          updated_at: string | null
          zalo_access_token: string | null
          zalo_app_id: string | null
          zalo_auto_scan: boolean | null
          zalo_oa_id: string | null
          zalo_refresh_token: string | null
          zalo_secret_key: string | null
          zalo_template_birthday_id: string | null
          zalo_template_reminder_id: string | null
          zalo_token_expires_at: string | null
        }
        Insert: {
          accounting_mode?: string | null
          address?: string | null
          brand_theme?: Json
          commission_config?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          enabled_modules?: Json
          franchise_agreement_date?: string | null
          gps_threshold_m?: number | null
          id?: string
          internal_clearing_rate?: number | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          parent_tenant_id?: string | null
          qr_account_name?: string | null
          qr_account_number?: string | null
          qr_bank_code?: string | null
          role_permissions?: Json | null
          royalty_fixed_amount?: number | null
          royalty_rate?: number | null
          royalty_type?: string | null
          salary_config?: Json | null
          sms_allotment_used?: number | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tenant_lat?: number | null
          tenant_lon?: number | null
          updated_at?: string | null
          zalo_access_token?: string | null
          zalo_app_id?: string | null
          zalo_auto_scan?: boolean | null
          zalo_oa_id?: string | null
          zalo_refresh_token?: string | null
          zalo_secret_key?: string | null
          zalo_template_birthday_id?: string | null
          zalo_template_reminder_id?: string | null
          zalo_token_expires_at?: string | null
        }
        Update: {
          accounting_mode?: string | null
          address?: string | null
          brand_theme?: Json
          commission_config?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          enabled_modules?: Json
          franchise_agreement_date?: string | null
          gps_threshold_m?: number | null
          id?: string
          internal_clearing_rate?: number | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          parent_tenant_id?: string | null
          qr_account_name?: string | null
          qr_account_number?: string | null
          qr_bank_code?: string | null
          role_permissions?: Json | null
          royalty_fixed_amount?: number | null
          royalty_rate?: number | null
          royalty_type?: string | null
          salary_config?: Json | null
          sms_allotment_used?: number | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tenant_lat?: number | null
          tenant_lon?: number | null
          updated_at?: string | null
          zalo_access_token?: string | null
          zalo_app_id?: string | null
          zalo_auto_scan?: boolean | null
          zalo_oa_id?: string | null
          zalo_refresh_token?: string | null
          zalo_secret_key?: string | null
          zalo_template_birthday_id?: string | null
          zalo_template_reminder_id?: string | null
          zalo_token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_classes: {
        Row: {
          capacity: number
          class_type: string
          course_id: string
          created_at: string
          ends_at: string | null
          id: string
          location_note: string | null
          starts_at: string
          status: string
          tenant_id: string
          title: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          class_type?: string
          course_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location_note?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          title: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          class_type?: string
          course_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location_note?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          title?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_classes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "training_classes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_classes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "training_classes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role_name: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_name: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_name?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          base_salary: number | null
          created_at: string | null
          email: string
          full_name: string
          hire_date: string | null
          id: string
          leave_balance: number | null
          metadata: Json | null
          phone: string | null
          position_tier: string
          resignation_date: string | null
          role: string
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          id?: string
          leave_balance?: number | null
          metadata?: Json | null
          phone?: string | null
          position_tier?: string
          resignation_date?: string | null
          role: string
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          leave_balance?: number | null
          metadata?: Json | null
          phone?: string | null
          position_tier?: string
          resignation_date?: string | null
          role?: string
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          cancelled_at: string | null
          cancelled_reason: string | null
          converted_booking_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          expires_at: string
          id: string
          notes: string | null
          notified_at: string | null
          package_id: string
          preferred_date: string
          preferred_ktv_id: string | null
          preferred_time_slot: string | null
          priority_score: number
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          converted_booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          expires_at: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          package_id: string
          preferred_date: string
          preferred_ktv_id?: string | null
          preferred_time_slot?: string | null
          priority_score?: number
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          converted_booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          expires_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          package_id?: string
          preferred_date?: string
          preferred_ktv_id?: string | null
          preferred_time_slot?: string | null
          priority_score?: number
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_converted_booking_id_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_preferred_ktv_id_fkey"
            columns: ["preferred_ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "waitlist_preferred_ktv_id_fkey"
            columns: ["preferred_ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          booking_id: string | null
          booking_request_id: string | null
          booking_value: number
          converted_at: string | null
          converted_to_booking_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          customer_id: string
          customer_name: string
          customer_tier: string
          duration_minutes: number
          estimated_wait_minutes: number | null
          expires_at: string
          flexibility_bonus: number | null
          id: string
          internal_notes: string | null
          is_flexible: boolean | null
          last_notification_at: string | null
          notes: string | null
          notification_channel: string | null
          notification_count: number | null
          notified_at: string | null
          package_id: string
          package_name: string
          position: number
          preferred_date: string
          preferred_ktv_id: string | null
          preferred_ktv_name: string | null
          preferred_resource_id: string | null
          preferred_resource_name: string | null
          preferred_start_time: string
          priority_score: number
          removal_reason: string | null
          removed_at: string | null
          removed_by_user_id: string | null
          reservation_expires_at: string | null
          reserved_at: string | null
          status: string
          tenant_id: string
          tier_score: number | null
          updated_at: string | null
          value_score: number | null
          wait_minutes: number | null
          wait_time_score: number | null
        }
        Insert: {
          booking_id?: string | null
          booking_request_id?: string | null
          booking_value?: number
          converted_at?: string | null
          converted_to_booking_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          customer_id: string
          customer_name: string
          customer_tier?: string
          duration_minutes?: number
          estimated_wait_minutes?: number | null
          expires_at: string
          flexibility_bonus?: number | null
          id?: string
          internal_notes?: string | null
          is_flexible?: boolean | null
          last_notification_at?: string | null
          notes?: string | null
          notification_channel?: string | null
          notification_count?: number | null
          notified_at?: string | null
          package_id: string
          package_name: string
          position?: number
          preferred_date: string
          preferred_ktv_id?: string | null
          preferred_ktv_name?: string | null
          preferred_resource_id?: string | null
          preferred_resource_name?: string | null
          preferred_start_time: string
          priority_score?: number
          removal_reason?: string | null
          removed_at?: string | null
          removed_by_user_id?: string | null
          reservation_expires_at?: string | null
          reserved_at?: string | null
          status?: string
          tenant_id: string
          tier_score?: number | null
          updated_at?: string | null
          value_score?: number | null
          wait_minutes?: number | null
          wait_time_score?: number | null
        }
        Update: {
          booking_id?: string | null
          booking_request_id?: string | null
          booking_value?: number
          converted_at?: string | null
          converted_to_booking_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          customer_id?: string
          customer_name?: string
          customer_tier?: string
          duration_minutes?: number
          estimated_wait_minutes?: number | null
          expires_at?: string
          flexibility_bonus?: number | null
          id?: string
          internal_notes?: string | null
          is_flexible?: boolean | null
          last_notification_at?: string | null
          notes?: string | null
          notification_channel?: string | null
          notification_count?: number | null
          notified_at?: string | null
          package_id?: string
          package_name?: string
          position?: number
          preferred_date?: string
          preferred_ktv_id?: string | null
          preferred_ktv_name?: string | null
          preferred_resource_id?: string | null
          preferred_resource_name?: string | null
          preferred_start_time?: string
          priority_score?: number
          removal_reason?: string | null
          removed_at?: string | null
          removed_by_user_id?: string | null
          reservation_expires_at?: string | null
          reserved_at?: string | null
          status?: string
          tenant_id?: string
          tier_score?: number | null
          updated_at?: string | null
          value_score?: number | null
          wait_minutes?: number | null
          wait_time_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_converted_to_booking_id_fkey"
            columns: ["converted_to_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "waitlist_entries_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_preferred_ktv_id_fkey"
            columns: ["preferred_ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "waitlist_entries_preferred_ktv_id_fkey"
            columns: ["preferred_ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_preferred_resource_id_fkey"
            columns: ["preferred_resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_removed_by_user_id_fkey"
            columns: ["removed_by_user_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "waitlist_entries_removed_by_user_id_fkey"
            columns: ["removed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "waitlist_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_notification_logs: {
        Row: {
          channel: string
          created_at: string | null
          customer_id: string
          customer_response: string | null
          customer_response_at: string | null
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          max_retries: number | null
          message_content: string | null
          message_template_id: string | null
          metadata: Json | null
          notification_type: string
          read_at: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          tenant_id: string
          waitlist_entry_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          customer_id: string
          customer_response?: string | null
          customer_response_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number | null
          message_content?: string | null
          message_template_id?: string | null
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          waitlist_entry_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          customer_id?: string
          customer_response?: string | null
          customer_response_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number | null
          message_content?: string | null
          message_template_id?: string | null
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_notification_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "waitlist_notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_notification_logs_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          category: string
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "workflow_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "workflow_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_rules: {
        Row: {
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          priority: number
          rule_type: string
          tenant_id: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          priority?: number
          rule_type: string
          tenant_id: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          priority?: number
          rule_type?: string
          tenant_id?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "workflow_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "workflow_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_rules_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          change_summary: string | null
          config: Json
          created_at: string | null
          created_by: string | null
          id: string
          tenant_id: string
          version: number
          workflow_id: string
        }
        Insert: {
          change_summary?: string | null
          config: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          tenant_id: string
          version: number
          workflow_id: string
        }
        Update: {
          change_summary?: string | null
          config?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          tenant_id?: string
          version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "workflow_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "workflow_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_partner_usage_summary: {
        Row: {
          avg_response_time_ms: number | null
          error_rate_percent: number | null
          error_requests_30d: number | null
          is_sandbox: boolean | null
          last_request_at: string | null
          max_response_time_ms: number | null
          partner_id: string | null
          partner_name: string | null
          partner_type: string | null
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          tenant_id: string | null
          total_requests_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "api_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      db_policies: {
        Row: {
          cmd: string | null
          permissive: string | null
          policyname: unknown
          qual: string | null
          schemaname: unknown
          tablename: unknown
          with_check: string | null
        }
        Relationships: []
      }
      mv_attendance_summary: {
        Row: {
          attendance_performance_score: number | null
          attendance_rate_pct: number | null
          attendance_status: string | null
          avg_late_minutes: number | null
          computed_at: string | null
          days_absent: number | null
          days_half_day: number | null
          days_late: number | null
          days_present: number | null
          ktv_id: string | null
          ktv_name: string | null
          ktv_role: string | null
          month: string | null
          on_time_rate_pct: number | null
          performance_rank: number | null
          tenant_id: string | null
          total_days: number | null
          working_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "attendance_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_budget_variance: {
        Row: {
          actual_amount: number | null
          budget_status: string | null
          budgeted_amount: number | null
          category: string | null
          computed_at: string | null
          month: string | null
          tenant_id: string | null
          transaction_count: number | null
          utilization_pct: number | null
          variance_amount: number | null
          variance_pct: number | null
        }
        Relationships: []
      }
      mv_campaign_performance: {
        Row: {
          avg_cpa: number | null
          avg_cpc: number | null
          avg_ctr: number | null
          avg_roas: number | null
          campaign_budget: number | null
          campaign_end_date: string | null
          campaign_id: string | null
          campaign_name: string | null
          campaign_start_date: string | null
          campaign_status: string | null
          computed_at: string | null
          first_ad_date: string | null
          last_ad_date: string | null
          platforms_count: number | null
          platforms_list: Json | null
          roi_pct: number | null
          tenant_id: string | null
          total_clicks: number | null
          total_conversions: number | null
          total_impressions: number | null
          total_revenue: number | null
          total_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_cash_flow: {
        Row: {
          bank_transfer_inflow: number | null
          bank_transfer_outflow: number | null
          burn_rate: number | null
          card_inflow: number | null
          card_outflow: number | null
          cash_flow_ratio: number | null
          cash_inflow: number | null
          cash_outflow: number | null
          computed_at: string | null
          cumulative_cash_flow: number | null
          inflow_transaction_count: number | null
          maintenance_outflow: number | null
          marketing_outflow: number | null
          momo_inflow: number | null
          momo_outflow: number | null
          month: string | null
          net_cash_flow: number | null
          other_outflow: number | null
          outflow_transaction_count: number | null
          rent_outflow: number | null
          salary_outflow: number | null
          supplies_outflow: number | null
          tenant_id: string | null
          total_inflow: number | null
          total_outflow: number | null
          utilities_outflow: number | null
          zalo_pay_inflow: number | null
          zalo_pay_outflow: number | null
        }
        Relationships: []
      }
      mv_channel_performance: {
        Row: {
          avg_cpa: number | null
          avg_cpc: number | null
          avg_ctr: number | null
          avg_roas: number | null
          campaigns_count: number | null
          computed_at: string | null
          month: string | null
          platform: string | null
          records_count: number | null
          roi_pct: number | null
          tenant_id: string | null
          total_clicks: number | null
          total_conversions: number | null
          total_impressions: number | null
          total_revenue: number | null
          total_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_ads_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "external_ads_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_employee_performance: {
        Row: {
          absent_days: number | null
          avg_star_rating: number | null
          below_four_count: number | null
          computed_at: string | null
          customer_satisfaction_score: number | null
          five_star_count: number | null
          four_star_count: number | null
          is_active: boolean | null
          kpi_amount: number | null
          kpi_score: number | null
          ktv_id: string | null
          ktv_name: string | null
          ktv_phone: string | null
          ktv_role: string | null
          month: string | null
          on_time_days: number | null
          overall_performance_score: number | null
          performance_rank: number | null
          performance_tier: string | null
          ratings_count: number | null
          revenue_per_session: number | null
          revenue_transaction_count: number | null
          sessions_per_working_day: number | null
          tenant_id: string | null
          total_bookings_served: number | null
          total_revenue_contributed: number | null
          total_sessions_completed: number | null
          working_days: number | null
        }
        Relationships: []
      }
      mv_inventory_status: {
        Row: {
          avg_daily_usage: number | null
          category: string | null
          computed_at: string | null
          current_stock: number | null
          days_until_stockout: number | null
          inventory_updated_at: string | null
          last_restock_date: string | null
          last_restock_quantity: number | null
          last_usage_date: string | null
          max_stock_level: number | null
          product_id: string | null
          product_name: string | null
          reorder_point: number | null
          reorder_quantity: number | null
          reorder_recommendation: string | null
          sku: string | null
          stock_status: string | null
          stock_value: number | null
          suggested_reorder_date: string | null
          supplier_contact: string | null
          supplier_email: string | null
          supplier_id: string | null
          supplier_lead_time_days: number | null
          supplier_name: string | null
          supplier_phone: string | null
          tenant_id: string | null
          unit_of_measure: string | null
          usage_last_30_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_ktv_performance_summary: {
        Row: {
          attendance_rate_pct: number | null
          avg_rating: number | null
          avg_revenue_per_session: number | null
          completion_rate_pct: number | null
          computed_at: string | null
          days_absent: number | null
          days_late: number | null
          days_present: number | null
          high_ratings_count: number | null
          ktv_email: string | null
          ktv_id: string | null
          ktv_name: string | null
          ktv_phone: string | null
          last_session_date: string | null
          low_ratings_count: number | null
          month: string | null
          tenant_id: string | null
          total_attendance_days: number | null
          total_ratings_count: number | null
          total_revenue: number | null
          total_service_commission: number | null
          total_session_bonus: number | null
          total_sessions_all: number | null
          total_sessions_cancelled: number | null
          total_sessions_completed: number | null
          total_sessions_no_show: number | null
          unique_customers_served: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_monthly_pnl: {
        Row: {
          booking_revenue: number | null
          computed_at: string | null
          gross_revenue: number | null
          ktv_count: number | null
          maintenance_expense: number | null
          marketing_expense: number | null
          month: string | null
          net_profit: number | null
          operating_expense_transaction_count: number | null
          other_operating_expense: number | null
          other_revenue: number | null
          package_revenue: number | null
          product_revenue: number | null
          profit_margin_pct: number | null
          rent_expense: number | null
          revenue_transaction_count: number | null
          supplies_expense: number | null
          tenant_id: string | null
          total_bookings: number | null
          total_expenses: number | null
          total_ktv_salaries: number | null
          total_operating_expenses: number | null
          total_revenue: number | null
          total_sessions_completed: number | null
          utilities_expense: number | null
        }
        Relationships: []
      }
      mv_payroll_summary: {
        Row: {
          avg_base_salary: number | null
          avg_salary_per_session: number | null
          avg_sessions_per_ktv: number | null
          avg_total_salary: number | null
          base_salary: number | null
          bonus_to_base_pct: number | null
          computed_at: string | null
          confirmed_at: string | null
          kpi_bonus: number | null
          ktv_id: string | null
          ktv_name: string | null
          ktv_role: string | null
          ktvs_draft: number | null
          ktvs_paid: number | null
          month: string | null
          net_salary: number | null
          other_adjustments: number | null
          payroll_share_pct: number | null
          payroll_status: string | null
          published_at: string | null
          rating_bonus: number | null
          salary_rank: number | null
          service_percentage_bonus: number | null
          session_bonus: number | null
          tenant_id: string | null
          total_base_salary: number | null
          total_kpi_bonus: number | null
          total_ktvs: number | null
          total_other_adjustments: number | null
          total_payroll_cost: number | null
          total_rating_bonus: number | null
          total_salary: number | null
          total_service_percentage_bonus: number | null
          total_session_bonus: number | null
          total_sessions: number | null
          total_sessions_all_ktvs: number | null
          total_violations_deduction: number | null
          violations_deduction: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "mv_ktv_performance_summary"
            referencedColumns: ["ktv_id"]
          },
          {
            foreignKeyName: "salary_records_ktv_id_fkey"
            columns: ["ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "salary_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_session_analytics: {
        Row: {
          afternoon_sessions: number | null
          avg_duration_minutes: number | null
          avg_revenue_per_session: number | null
          avg_satisfaction_rating: number | null
          basic_package_sessions: number | null
          cancellation_rate_pct: number | null
          cancelled_sessions: number | null
          completed_sessions: number | null
          completion_rate_pct: number | null
          computed_at: string | null
          date: string | null
          evening_sessions: number | null
          high_satisfaction_count: number | null
          in_progress_sessions: number | null
          low_satisfaction_count: number | null
          max_duration_minutes: number | null
          medium_satisfaction_count: number | null
          min_duration_minutes: number | null
          morning_sessions: number | null
          no_show_rate_pct: number | null
          no_show_sessions: number | null
          peak_hour: number | null
          premium_package_sessions: number | null
          quality_success_rate_pct: number | null
          scheduled_sessions: number | null
          successful_quality_sessions: number | null
          tenant_id: string | null
          total_ratings: number | null
          total_revenue: number | null
          total_sessions: number | null
          unique_customers: number | null
          unique_ktvs: number | null
          vip_package_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "session_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_workforce_analytics: {
        Row: {
          avg_tenure_months: number | null
          computed_at: string | null
          current_headcount: number | null
          month: string | null
          new_hires: number | null
          role: string | null
          role_distribution_pct: number | null
          tenant_id: string | null
          terminations: number | null
          total_ever_hired: number | null
          turnover_rate_pct: number | null
        }
        Relationships: []
      }
      outbox_health: {
        Row: {
          avg_latency_seconds: number | null
          count: number | null
          event_type: string | null
          last_completed: string | null
          latest_event: string | null
          status: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_health_today"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "accounting_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_health_today: {
        Row: {
          check_date: string | null
          has_ledger_entries: boolean | null
          has_legacy_revenue: boolean | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Insert: {
          check_date?: never
          has_ledger_entries?: never
          has_legacy_revenue?: never
          tenant_id?: string | null
          tenant_name?: string | null
        }
        Update: {
          check_date?: never
          has_ledger_entries?: never
          has_legacy_revenue?: never
          tenant_id?: string | null
          tenant_name?: string | null
        }
        Relationships: []
      }
      v_cron_jobs_status: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      v_mv_refresh_status: {
        Row: {
          definition: string | null
          hasindexes: boolean | null
          ispopulated: boolean | null
          matviewname: unknown
          matviewowner: unknown
          schemaname: unknown
          tablespace: unknown
        }
        Relationships: []
      }
    }
    Functions: {
      acc_balance_at: {
        Args: {
          p_account_code_prefix: string
          p_as_of_date: string
          p_tenant_id: string
        }
        Returns: number
      }
      accounting_missing_required_fields: {
        Args: { p_business_event_type: string; p_payload: Json }
        Returns: string[]
      }
      add_partner_document: {
        Args: {
          p_application_id: string
          p_category: string
          p_file_path: string
          p_file_url: string
          p_metadata: Json
        }
        Returns: undefined
      }
      apply_rating_bonus: { Args: { p_session_id: string }; Returns: undefined }
      auto_confirm_stale_salary_records: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      backfill_accounting_metadata: {
        Args: { p_limit?: number; p_tenant_id?: string }
        Returns: {
          classified_records: number
          review_created: number
          scanned_records: number
          source_table: string
        }[]
      }
      calculate_ktv_salary_sheet: {
        Args: { p_month_year: string; p_tenant_id?: string }
        Returns: {
          advances: number
          base_salary: number
          deductions: number
          kpi_bonus: number
          ktv_id: string
          ktv_name: string
          product_sales_commission: number
          rating_bonus: number
          session_bonus: number
          status: string
          total_salary: number
          total_sessions: number
        }[]
      }
      calculate_ktv_salary_sheet_test: {
        Args: { p_month_year: string }
        Returns: {
          advances: number
          base_salary: number
          deductions: number
          kpi_bonus: number
          ktv_id: string
          ktv_name: string
          product_sales_commission: number
          rating_bonus: number
          session_bonus: number
          status: string
          total_salary: number
          total_sessions: number
        }[]
      }
      calculate_waitlist_priority: {
        Args: { p_customer_id: string; p_tenant_id: string }
        Returns: number
      }
      check_expiring_insurance_policies: {
        Args: { p_days_before?: number; p_tenant_id: string }
        Returns: {
          customer_id: string
          customer_name: string
          days_until_expiry: number
          expiry_date: string
          insurance_company: string
          policy_id: string
          policy_number: string
          premium_amount: number
          vehicle_id: string
        }[]
      }
      claim_outbox_batch: {
        Args: { p_limit?: number }
        Returns: {
          event_type: string
          id: string
          payload: Json
          reference_id: string
          reference_type: string
          retry_count: number
          tenant_id: string
        }[]
      }
      cleanup_expired_recommendation_cache: { Args: never; Returns: number }
      close_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      create_onboarding_user: {
        Args: { p_email: string; p_full_name: string; p_password: string }
        Returns: string
      }
      create_salary_accrual_journals: {
        Args: {
          p_created_by?: string
          p_from_date?: string
          p_tenant_id: string
          p_to_date?: string
        }
        Returns: {
          action: string
          base_component: number
          entry_id: string
          ktv_id: string
          month_year: string
          salary_record_id: string
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      enqueue_accounting_event: {
        Args: {
          p_event_type: string
          p_payload: Json
          p_reference_id: string
          p_reference_type: string
          p_tenant_id: string
        }
        Returns: string
      }
      ensure_open_period: {
        Args: { p_date: string; p_tenant_id: string }
        Returns: string
      }
      exec_sql: { Args: { sql_query: string }; Returns: undefined }
      expire_old_waitlist_entries: { Args: never; Returns: undefined }
      generate_api_key: { Args: { is_test?: boolean }; Returns: string }
      generate_appointment_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_closing_entries: {
        Args: { p_period_id: string }
        Returns: {
          entry_id: string
          step: string
          total_amount: number
        }[]
      }
      generate_loan_application_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_repair_order_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_trade_in_appraisal_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_warranty_claim_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      get_account_ledger: {
        Args: {
          p_account_id: string
          p_from_date: string
          p_tenant_id: string
          p_to_date: string
        }
        Returns: {
          credit_amount: number
          debit_amount: number
          description: string
          entry_date: string
          entry_id: string
          line_id: string
          reference_id: string
          reference_type: string
          running_balance: number
        }[]
      }
      get_accounting_readiness: {
        Args: { p_tenant_id: string }
        Returns: {
          classified_records: number
          missing_business_event: number
          needs_review: number
          posting_failed: number
          source_table: string
          total_records: number
        }[]
      }
      get_active_ai_insights: {
        Args: { p_limit?: number; p_tenant_id: string }
        Returns: {
          confidence_score: number
          created_at: string
          insight_id: string
          insight_summary: string
          insight_title: string
          insight_type: string
          priority: string
        }[]
      }
      get_ai_attendance_kpis: {
        Args: { p_month_year: string }
        Returns: {
          absent_count: number
          gps_anomaly_count: number
          ktv_id: string
          ktv_name: string
          late_count: number
          present_count: number
          total_shifts: number
        }[]
      }
      get_auth_tenant_id: { Args: never; Returns: string }
      get_available_capacity: {
        Args: { p_date: string; p_tenant_id: string; p_time_slot: string }
        Returns: {
          available_capacity: number
          booked_capacity: number
          buffer_reserved: number
          total_capacity: number
          utilization_rate: number
        }[]
      }
      get_balance_sheet: {
        Args: { p_as_of_date: string; p_tenant_id: string }
        Returns: {
          accounts_payable: number
          accounts_receivable: number
          accumulated_depreciation: number
          cash_and_equivalents: number
          employee_payables: number
          fixed_assets_cost: number
          inventory: number
          other_payables: number
          owners_capital: number
          prepaid_expenses: number
          retained_earnings: number
          taxes_payable: number
          total_assets: number
          total_equity: number
          total_equity_and_liabilities: number
          total_liabilities: number
          unearned_revenue: number
        }[]
      }
      get_booking_as_of: {
        Args: { p_as_of_date: string; p_entity_id: string; p_tenant_id: string }
        Returns: {
          customer_id: string
          deposit_amount: number
          id: string
          status: string
          tenant_id: string
          total_price: number
          variant_id: string
          vehicle_id: string
        }[]
      }
      get_booking_engine_metrics: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_business_transaction_with_steps: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      get_cached_recommendations: {
        Args: { p_cache_key: string; p_tenant_id: string }
        Returns: Json
      }
      get_cash_flow_statement: {
        Args: { p_from_date: string; p_tenant_id: string; p_to_date: string }
        Returns: {
          change_in_inventory: number
          change_in_payables: number
          change_in_receivables: number
          change_in_unearned_revenue: number
          closing_cash: number
          depreciation: number
          fixed_assets_purchased: number
          fixed_assets_sold: number
          loans_received: number
          loans_repaid: number
          net_cash_financing: number
          net_cash_investing: number
          net_cash_operating: number
          net_change_in_cash: number
          opening_cash: number
          owner_contributions: number
          profit_before_tax: number
          tax_paid: number
          verification_diff: number
        }[]
      }
      get_chat_customers:
        | {
            Args: never
            Returns: {
              created_at: string
              customer_level: string
              full_name: string
              id: string
              last_package_name: string
              phone: string
              total_spent: number
              unread_count: number
            }[]
          }
        | {
            Args: { p_tenant_id: string }
            Returns: {
              created_at: string
              customer_level: string
              full_name: string
              id: string
              last_package_name: string
              phone: string
              total_spent: number
              unread_count: number
            }[]
          }
      get_consolidated_pnl: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: {
          cost_of_goods_sold: number
          deductions: number
          financial_expense: number
          financial_income: number
          gross_profit: number
          gross_revenue: number
          internal_cogs_eliminated: number
          internal_revenue_eliminated: number
          net_margin_percent: number
          net_profit: number
          net_revenue: number
          operating_expense: number
          operating_profit: number
          other_expense: number
          other_income: number
          profit_before_tax: number
          tax_expense: number
          tenant_id: string
          tenant_name: string
          total_bookings_count: number
          total_sessions_completed: number
        }[]
      }
      get_customer_lifetime_summary: {
        Args: { p_customer_id: string; p_tenant_id: string }
        Returns: {
          average_csi: number
          average_nps: number
          first_contact_date: string
          last_event_date: string
          last_event_type: string
          total_events: number
          total_revenue: number
          total_service_visits: number
          vehicles_purchased: number
          years_as_customer: number
        }[]
      }
      get_dashboard_summary: { Args: { p_tenant_id: string }; Returns: Json }
      get_distinct_audit_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      get_effective_subscription_entitlements: {
        Args: { p_tenant_id: string }
        Returns: {
          enforcement_mode: string
          feature_key: string
          is_unlimited: boolean
          limit_value: number
          plan_code: string
          reset_period: string
          source: string
          tenant_id: string
          unit: string
        }[]
      }
      get_entity_rollback_history: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          rollback_reason: string
          rolled_back_at: string
          rolled_back_by_email: string
          status: Database["public"]["Enums"]["auto_business_transaction_status"]
          steps_count: number
          transaction_id: string
          transaction_type: Database["public"]["Enums"]["auto_business_transaction_type"]
        }[]
      }
      get_external_campaign_id: {
        Args: {
          campaign_row: Database["public"]["Tables"]["marketing_campaigns"]["Row"]
          platform_name: string
        }
        Returns: string
      }
      get_financial_anomalies: { Args: { p_tenant_id: string }; Returns: Json }
      get_hr_employee_summary: {
        Args: { p_status?: string; p_tenant_id: string }
        Returns: {
          base_salary: number
          department_name: string
          display_name: string
          employment_status: string
          employment_type: string
          hire_date: string
          person_id: string
          person_type: string
          position_title: string
        }[]
      }
      get_income_statement: {
        Args: { p_from_date: string; p_tenant_id: string; p_to_date: string }
        Returns: {
          cost_of_goods_sold: number
          deductions: number
          financial_expense: number
          financial_income: number
          gross_profit: number
          gross_revenue: number
          net_profit: number
          net_revenue: number
          operating_expense: number
          operating_profit: number
          other_expense: number
          other_income: number
          profit_before_tax: number
          tax_expense: number
        }[]
      }
      get_journey_as_of: {
        Args: { p_as_of_date: string; p_entity_id: string; p_tenant_id: string }
        Returns: {
          current_stage_id: string
          customer_id: string
          id: string
          sla_status: string
          tenant_id: string
        }[]
      }
      get_ktv_leaderboard: {
        Args: { p_month: string; p_tenant_id: string }
        Returns: {
          absent_days: number
          average_rating: number
          commissions: number
          customer_rating: number
          discipline_score: number
          full_name: string
          ktv_id: string
          late_days: number
          max_late_streak: number
          rank: number
          sessions: number
          total_kpi_bonus: number
        }[]
      }
      get_ktv_salary_detail: {
        Args: { p_ktv_id: string; p_month: string }
        Returns: {
          base_salary: number
          confirmed_by_admin: boolean
          dispute_reason: string
          kpi_bonus: number
          notes: string
          published_at: string
          rating_bonus: number
          record_id: string
          service_percentage_bonus: number
          session_bonus: number
          status: string
          total_salary: number
          total_sessions: number
          violations_deduction: number
        }[]
      }
      get_monthly_pnl: {
        Args: { p_month: string; p_tenant_id: string }
        Returns: {
          is_locked: boolean
          month_year: string
          net_profit: number
          total_bookings: number
          total_ktv_salaries: number
          total_operating_expenses: number
          total_revenue: number
          total_sessions_completed: number
        }[]
      }
      get_my_tenant_id: { Args: never; Returns: string }
      get_pending_offline_actions: {
        Args: { p_limit?: number; p_tenant_id: string; p_user_id: string }
        Returns: {
          action_data: Json
          action_id: string
          action_type: string
          created_at: string
          entity_type: string
          priority: number
        }[]
      }
      get_pending_rule_approvals: {
        Args: { p_tenant_id: string }
        Returns: {
          approval_id: string
          comments: string
          requested_at: string
          requested_by_name: string
          reviewer_name: string
          rule_id: string
          rule_name: string
          rule_provider: string
          status: string
        }[]
      }
      get_reconciliation_report: {
        Args: { p_from_date: string; p_tenant_id: string; p_to_date: string }
        Returns: {
          category: string
          category_label: string
          diff_amount: number
          diff_percent: number
          ledger_amount: number
          legacy_amount: number
          status: string
        }[]
      }
      get_rule_simulation_results: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_tenant_id: string
          p_workflow_id?: string
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          results: Json
          summary: Json
          tenant_id: string
          test_data: Json
          workflow_id: string
        }[]
      }
      get_rule_test_stats: {
        Args: { p_days?: number; p_rule_id: string }
        Returns: {
          avg_execution_time_ms: number
          failed_tests: number
          passed_tests: number
          success_rate: number
          total_tests: number
        }[]
      }
      get_rule_with_history: {
        Args: { p_rule_id: string }
        Returns: {
          rule_actions: Json
          rule_category: string
          rule_conditions: Json
          rule_description: string
          rule_id: string
          rule_name: string
          rule_priority: number
          rule_provider: string
          rule_status: string
          rule_version: number
          version_history: Json
        }[]
      }
      get_salary_reconciliation: {
        Args: { p_month_year: string }
        Returns: {
          ai_total: number
          diff_amount: number
          diff_percent: number
          has_legacy_record: boolean
          ktv_id: string
          ktv_name: string
          legacy_status: string
          legacy_total: number
          status: string
        }[]
      }
      get_salary_reconciliation_report: {
        Args: { p_month_year: string; p_tenant_id: string }
        Returns: {
          ai_base_salary: number
          ai_deductions: number
          ai_kpi_bonus: number
          ai_product_sales_commission: number
          ai_session_bonus: number
          ai_total: number
          diff_percent: number
          diff_total: number
          ktv_id: string
          ktv_name: string
          legacy_base_salary: number
          legacy_deductions: number
          legacy_kpi_bonus: number
          legacy_product_sales_commission: number
          legacy_session_bonus: number
          legacy_status: string
          legacy_total: number
          status: string
        }[]
      }
      get_service_performance: {
        Args: { p_tenant_id: string }
        Returns: {
          net_service_profit: number
          package_name: string
          profit_margin_percent: number
          total_bookings: number
          total_ktv_cost: number
          total_revenue: number
        }[]
      }
      get_tenant_sms_usage: { Args: { p_tenant_id: string }; Returns: number }
      get_trial_balance: {
        Args: { p_as_of_date: string; p_tenant_id: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: string
          closing_credit: number
          closing_debit: number
          opening_credit: number
          opening_debit: number
          period_credit: number
          period_debit: number
        }[]
      }
      get_unread_notifications: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: {
          action_data: Json
          action_type: string
          created_at: string
          message: string
          notification_id: string
          notification_type: string
          priority: string
          title: string
        }[]
      }
      get_user_by_email_v1: {
        Args: { p_email: string }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          status: string
          tenant_id: string
        }[]
      }
      get_vehicle_as_of: {
        Args: { p_as_of_date: string; p_entity_id: string; p_tenant_id: string }
        Returns: {
          chassis_number: string
          color_exterior: string
          color_interior: string
          cost_price: number
          engine_number: string
          id: string
          list_price: number
          location_note: string
          model_year: number
          status: string
          tenant_id: string
          variant_id: string
          vin: string
        }[]
      }
      get_workflow_definitions: {
        Args: {
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_tenant_id: string
        }
        Returns: {
          category: string
          config: Json
          created_at: string
          created_by: string
          description: string
          id: string
          metadata: Json
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }[]
      }
      get_workflow_rules: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_rule_type?: string
          p_status?: string
          p_tenant_id: string
          p_workflow_id?: string
        }
        Returns: {
          config: Json
          created_at: string
          created_by: string
          description: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          priority: number
          rule_type: string
          tenant_id: string
          updated_at: string
          workflow_id: string
        }[]
      }
      has_external_mapping: {
        Args: {
          campaign_row: Database["public"]["Tables"]["marketing_campaigns"]["Row"]
          platform_name: string
        }
        Returns: boolean
      }
      increment_loyalty_points: {
        Args: { p_customer_id: string; p_points: number }
        Returns: undefined
      }
      increment_tenant_sms: { Args: { p_tenant_id: string }; Returns: number }
      is_accountant: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_hq_admin: { Args: never; Returns: boolean }
      is_hq_super_admin: { Args: never; Returns: boolean }
      is_hr: { Args: never; Returns: boolean }
      is_valid_tenant: { Args: { t_id: string }; Returns: boolean }
      lock_monthly_records: {
        Args: { p_month: string; p_tenant_id: string }
        Returns: undefined
      }
      log_api_request: {
        Args: {
          p_endpoint: string
          p_error_code?: string
          p_error_message?: string
          p_ip_address?: string
          p_is_error?: boolean
          p_method: string
          p_partner_id: string
          p_request_id?: string
          p_response_time_ms: number
          p_status_code: number
          p_tenant_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      mark_notification_read: {
        Args: {
          p_notification_id: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      mark_outbox_completed: {
        Args: { p_journal_entry_id: string; p_outbox_id: string }
        Returns: undefined
      }
      mark_outbox_failed: {
        Args: { p_error: string; p_outbox_id: string }
        Returns: undefined
      }
      onboard_tenant: {
        Args: {
          p_address: string
          p_admin_email: string
          p_admin_id: string
          p_admin_name: string
          p_contact_phone: string
          p_email: string
          p_spa_name: string
        }
        Returns: string
      }
      preview_closing_entries: {
        Args: { p_period_id: string }
        Returns: {
          amount: number
          credit_account_code: string
          debit_account_code: string
          description: string
          step: number
          step_name: string
        }[]
      }
      preview_legacy_ledger_sync: {
        Args: { p_tenant_id: string }
        Returns: {
          expense_amount: number
          journal_entries_to_create: number
          pending_expense_count: number
          pending_revenue_count: number
          pending_salary_count: number
          revenue_amount: number
          salary_amount: number
        }[]
      }
      record_remaining_payment_atomic: {
        Args: {
          p_accounting_metadata?: Json
          p_accounting_review_status?: string
          p_actor_id?: string
          p_amount: number
          p_booking_id: string
          p_business_event_type?: string
          p_notes?: string
          p_outbox_payload?: Json
          p_payment_method: string
          p_receipt_url?: string
          p_received_date: string
          p_revenue_type?: string
          p_status?: string
        }
        Returns: Json
      }
      refresh_all_intelligence_materialized_views: {
        Args: never
        Returns: {
          refresh_duration: string
          refresh_status: string
          view_name: string
        }[]
      }
      refresh_marketing_materialized_views: { Args: never; Returns: undefined }
      refresh_operational_materialized_views: {
        Args: never
        Returns: undefined
      }
      remove_partner_document: {
        Args: { p_application_id: string; p_file_path: string }
        Returns: undefined
      }
      renew_tenant_subscription: {
        Args: { p_invoice_number: string; p_payment_method: string }
        Returns: boolean
      }
      reopen_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      reserve_product: {
        Args: {
          p_customer_id?: string
          p_duration_minutes?: number
          p_product_id: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      resolve_accounting_review_item: {
        Args: { p_review_item_id: string; p_status: string }
        Returns: {
          review_item_id: string
          review_status: string
          source_id: string
          source_review_status: string
          source_table: string
        }[]
      }
      rollback_rule_to_version: {
        Args: { p_rule_id: string; p_target_version: number; p_user_id: string }
        Returns: Json
      }
      rpc_ktv_dashboard_stats: {
        Args: { p_ktv_id: string; p_tenant_id: string; p_today: string }
        Returns: {
          completed_sessions: number
          total_sessions: number
        }[]
      }
      rpc_mobile_today_sessions: {
        Args: { p_ktv_id?: string; p_tenant_id: string; p_today: string }
        Returns: {
          assigned_time: string
          baby_name: string
          booking_id: string
          completed_sessions: number
          customer_name: string
          ktv_name: string
          package_name: string
          session_id: string
          status: string
          total_sessions: number
        }[]
      }
      seed_default_coa: { Args: { p_tenant_id: string }; Returns: number }
      set_session_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      sync_legacy_to_ledger_atomic: {
        Args: { p_created_by?: string; p_tenant_id: string }
        Returns: {
          synced_expense_count: number
          synced_revenue_count: number
          synced_salary_count: number
        }[]
      }
      validate_api_partner: {
        Args: { p_api_key: string }
        Returns: {
          allowed_scopes: string[]
          is_active: boolean
          is_sandbox: boolean
          partner_id: string
          partner_name: string
          rate_limit_per_day: number
          rate_limit_per_minute: number
          tenant_id: string
        }[]
      }
    }
    Enums: {
      AttendanceStatus: "present" | "late" | "absent" | "half_day"
      auto_business_transaction_status:
        | "pending"
        | "committed"
        | "rolled_back"
        | "failed"
      auto_business_transaction_type:
        | "vehicle_delivery"
        | "service_complete"
        | "trade_in_approval"
        | "loan_disbursement"
        | "deposit_payment"
        | "quotation_approval"
        | "test_drive_complete"
        | "warranty_claim_approval"
      auto_transaction_step_status:
        | "pending"
        | "executed"
        | "rolled_back"
        | "failed"
      auto_vehicle_status:
        | "in_transit"
        | "warehouse"
        | "showroom"
        | "allocated"
        | "delivered"
        | "returned"
        | "scrapped"
      booking_state: "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED"
      BookingStatus:
        | "inquiry"
        | "deposit_pending"
        | "booked"
        | "in_progress"
        | "completed"
        | "cancelled"
      contract_state: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "TERMINATED"
      CustomerStatus: "prospect" | "active" | "completed" | "inactive"
      ExpenseStatus: "submitted" | "approved" | "rejected"
      lead_state:
        | "NEW"
        | "ASSIGNED"
        | "CONTACTED"
        | "QUALIFIED"
        | "VISIT_SCHEDULED"
        | "NEGOTIATING"
        | "CONVERTED"
        | "LOST"
      MessageType: "text" | "system" | "file"
      partner_applicant_type: "individual" | "company"
      partner_application_log_action:
        | "created"
        | "submitted"
        | "email_verified"
        | "document_uploaded"
        | "info_requested"
        | "resubmitted"
        | "approved"
        | "rejected"
        | "provisioned"
        | "activated"
        | "status_changed"
        | "comment_added"
      partner_application_status:
        | "draft"
        | "pending_verification"
        | "pending_review"
        | "need_more_info"
        | "approved"
        | "rejected"
        | "provisioned"
        | "activated"
      PaymentMethod: "cash" | "bank_transfer" | "zalo_pay" | "momo"
      product_type: "apartment" | "townhouse" | "shophouse" | "villa"
      re_commission_status: "pending" | "approved" | "paid" | "cancelled"
      re_document_type:
        | "brochure"
        | "price_list"
        | "legal_docs"
        | "bank_policy"
        | "faq"
        | "training"
        | "contract_template"
        | "other"
      re_product_status:
        | "available"
        | "booked"
        | "deposited"
        | "contracted"
        | "paid"
        | "handed_over"
        | "cancelled"
      re_product_type:
        | "apartment"
        | "townhouse"
        | "shophouse"
        | "villa"
        | "land_plot"
        | "office"
      re_reservation_status: "active" | "released" | "expired" | "converted"
      re_transaction_type:
        | "booking"
        | "deposit"
        | "contract"
        | "payment_milestone"
        | "adjustment"
      reservation_status:
        | "pending_deposit"
        | "deposited"
        | "converted_to_contract"
        | "cancelled"
      RevenueType: "deposit" | "session_completed" | "additional_service"
      Role: "admin" | "ktv_lead" | "ktv" | "admin_staff" | "accountant"
      SalaryStatus: "draft" | "pending_approval" | "approved" | "paid"
      SessionStatus: "scheduled" | "completed" | "cancelled"
      ShiftStatus: "scheduled" | "completed" | "cancelled"
      TenantStatus: "active" | "suspended" | "terminated"
      ThreadType: "booking" | "general" | "team"
      Tier: "silver" | "gold" | "diamond"
      UserStatus: "active" | "inactive" | "terminated"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      AttendanceStatus: ["present", "late", "absent", "half_day"],
      auto_business_transaction_status: [
        "pending",
        "committed",
        "rolled_back",
        "failed",
      ],
      auto_business_transaction_type: [
        "vehicle_delivery",
        "service_complete",
        "trade_in_approval",
        "loan_disbursement",
        "deposit_payment",
        "quotation_approval",
        "test_drive_complete",
        "warranty_claim_approval",
      ],
      auto_transaction_step_status: [
        "pending",
        "executed",
        "rolled_back",
        "failed",
      ],
      auto_vehicle_status: [
        "in_transit",
        "warehouse",
        "showroom",
        "allocated",
        "delivered",
        "returned",
        "scrapped",
      ],
      booking_state: ["DRAFT", "PENDING_APPROVAL", "CONFIRMED", "CANCELLED"],
      BookingStatus: [
        "inquiry",
        "deposit_pending",
        "booked",
        "in_progress",
        "completed",
        "cancelled",
      ],
      contract_state: ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "TERMINATED"],
      CustomerStatus: ["prospect", "active", "completed", "inactive"],
      ExpenseStatus: ["submitted", "approved", "rejected"],
      lead_state: [
        "NEW",
        "ASSIGNED",
        "CONTACTED",
        "QUALIFIED",
        "VISIT_SCHEDULED",
        "NEGOTIATING",
        "CONVERTED",
        "LOST",
      ],
      MessageType: ["text", "system", "file"],
      partner_applicant_type: ["individual", "company"],
      partner_application_log_action: [
        "created",
        "submitted",
        "email_verified",
        "document_uploaded",
        "info_requested",
        "resubmitted",
        "approved",
        "rejected",
        "provisioned",
        "activated",
        "status_changed",
        "comment_added",
      ],
      partner_application_status: [
        "draft",
        "pending_verification",
        "pending_review",
        "need_more_info",
        "approved",
        "rejected",
        "provisioned",
        "activated",
      ],
      PaymentMethod: ["cash", "bank_transfer", "zalo_pay", "momo"],
      product_type: ["apartment", "townhouse", "shophouse", "villa"],
      re_commission_status: ["pending", "approved", "paid", "cancelled"],
      re_document_type: [
        "brochure",
        "price_list",
        "legal_docs",
        "bank_policy",
        "faq",
        "training",
        "contract_template",
        "other",
      ],
      re_product_status: [
        "available",
        "booked",
        "deposited",
        "contracted",
        "paid",
        "handed_over",
        "cancelled",
      ],
      re_product_type: [
        "apartment",
        "townhouse",
        "shophouse",
        "villa",
        "land_plot",
        "office",
      ],
      re_reservation_status: ["active", "released", "expired", "converted"],
      re_transaction_type: [
        "booking",
        "deposit",
        "contract",
        "payment_milestone",
        "adjustment",
      ],
      reservation_status: [
        "pending_deposit",
        "deposited",
        "converted_to_contract",
        "cancelled",
      ],
      RevenueType: ["deposit", "session_completed", "additional_service"],
      Role: ["admin", "ktv_lead", "ktv", "admin_staff", "accountant"],
      SalaryStatus: ["draft", "pending_approval", "approved", "paid"],
      SessionStatus: ["scheduled", "completed", "cancelled"],
      ShiftStatus: ["scheduled", "completed", "cancelled"],
      TenantStatus: ["active", "suspended", "terminated"],
      ThreadType: ["booking", "general", "team"],
      Tier: ["silver", "gold", "diamond"],
      UserStatus: ["active", "inactive", "terminated"],
    },
  },
} as const
