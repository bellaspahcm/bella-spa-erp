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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      bookings: {
        Row: {
          assigned_ktv_id: string | null
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
          package_id: string | null
          package_name: string | null
          preferred_time: string | null
          share_token: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_ktv_id?: string | null
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
          package_id?: string | null
          package_name?: string | null
          preferred_time?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_ktv_id?: string | null
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
          package_id?: string | null
          package_name?: string | null
          preferred_time?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_ktv_id_fkey"
            columns: ["assigned_ktv_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          dob_baby: string | null
          dob_expected: string | null
          gender_baby: string | null
          id: string
          loyalty_points: number | null
          name_baby: string | null
          name_mother: string
          notes: string | null
          phone: string
          referrer_id: string | null
          status: string | null
          tenant_id: string | null
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
          loyalty_points?: number | null
          name_baby?: string | null
          name_mother: string
          notes?: string | null
          phone: string
          referrer_id?: string | null
          status?: string | null
          tenant_id?: string | null
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
          loyalty_points?: number | null
          name_baby?: string | null
          name_mother?: string
          notes?: string | null
          phone?: string
          referrer_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          zalo_oa_id?: string | null
        }
        Relationships: [
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_by_id: string | null
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
          amount: number
          approved_by_id?: string | null
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
          amount?: number
          approved_by_id?: string | null
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
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
            referencedRelation: "tenants"
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          allowed_franchise_override: boolean | null
          created_at: string | null
          description: string | null
          details: string[] | null
          duration: string | null
          full_price: number
          id: string
          is_hq_template: boolean | null
          ktv_commission: number | null
          name: string
          offer: string | null
          price: number | null
          price_cap: number | null
          price_floor: number | null
          status: string | null
          template_id: string | null
          tenant_id: string | null
          total_sessions: number
          updated_at: string | null
        }
        Insert: {
          allowed_franchise_override?: boolean | null
          created_at?: string | null
          description?: string | null
          details?: string[] | null
          duration?: string | null
          full_price?: number
          id?: string
          is_hq_template?: boolean | null
          ktv_commission?: number | null
          name: string
          offer?: string | null
          price?: number | null
          price_cap?: number | null
          price_floor?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          total_sessions?: number
          updated_at?: string | null
        }
        Update: {
          allowed_franchise_override?: boolean | null
          created_at?: string | null
          description?: string | null
          details?: string[] | null
          duration?: string | null
          full_price?: number
          id?: string
          is_hq_template?: boolean | null
          ktv_commission?: number | null
          name?: string
          offer?: string | null
          price?: number | null
          price_cap?: number | null
          price_floor?: number | null
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
      revenue: {
        Row: {
          amount: number
          booking_id: string | null
          id: string
          is_locked: boolean | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          received_date: string
          recorded_by_id: string | null
          revenue_type: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          received_date: string
          recorded_by_id?: string | null
          revenue_type?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          received_date?: string
          recorded_by_id?: string | null
          revenue_type?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          base_salary: number | null
          confirmed_by_admin: boolean | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          finalized_at: string | null
          id: string
          is_locked: boolean | null
          kpi_bonus: number | null
          ktv_confirmed_at: string | null
          ktv_id: string
          month_year: string
          notes: string | null
          paid_date: string | null
          paid_method: string | null
          published_at: string | null
          rating_bonus: number | null
          service_percentage_bonus: number | null
          session_bonus: number | null
          status: string | null
          tenant_id: string | null
          total_salary: number | null
          total_sessions: number | null
          violations_deduction: number | null
        }
        Insert: {
          base_salary?: number | null
          confirmed_by_admin?: boolean | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          finalized_at?: string | null
          id?: string
          is_locked?: boolean | null
          kpi_bonus?: number | null
          ktv_confirmed_at?: string | null
          ktv_id: string
          month_year: string
          notes?: string | null
          paid_date?: string | null
          paid_method?: string | null
          published_at?: string | null
          rating_bonus?: number | null
          service_percentage_bonus?: number | null
          session_bonus?: number | null
          status?: string | null
          tenant_id?: string | null
          total_salary?: number | null
          total_sessions?: number | null
          violations_deduction?: number | null
        }
        Update: {
          base_salary?: number | null
          confirmed_by_admin?: boolean | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          finalized_at?: string | null
          id?: string
          is_locked?: boolean | null
          kpi_bonus?: number | null
          ktv_confirmed_at?: string | null
          ktv_id?: string
          month_year?: string
          notes?: string | null
          paid_date?: string | null
          paid_method?: string | null
          published_at?: string | null
          rating_bonus?: number | null
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          actual_duration: number | null
          address: string | null
          assigned_date: string | null
          assigned_time: string | null
          booking_id: string
          checkin_lat: number | null
          checkin_lon: number | null
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
          tenant_id: string | null
          time_deviation: number | null
          zalo_reminder_sent: boolean | null
          zalo_reminder_time: string | null
        }
        Insert: {
          actual_duration?: number | null
          address?: string | null
          assigned_date?: string | null
          assigned_time?: string | null
          booking_id: string
          checkin_lat?: number | null
          checkin_lon?: number | null
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
          tenant_id?: string | null
          time_deviation?: number | null
          zalo_reminder_sent?: boolean | null
          zalo_reminder_time?: string | null
        }
        Update: {
          actual_duration?: number | null
          address?: string | null
          assigned_date?: string | null
          assigned_time?: string | null
          booking_id?: string
          checkin_lat?: number | null
          checkin_lon?: number | null
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
          tenant_id?: string | null
          time_deviation?: number | null
          zalo_reminder_sent?: boolean | null
          zalo_reminder_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          email: string | null
          franchise_agreement_date: string | null
          id: string
          internal_clearing_rate: number | null
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
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          franchise_agreement_date?: string | null
          id?: string
          internal_clearing_rate?: number | null
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
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          franchise_agreement_date?: string | null
          id?: string
          internal_clearing_rate?: number | null
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          phone: string | null
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
          phone?: string | null
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
          phone?: string | null
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_rating_bonus: { Args: { p_session_id: string }; Returns: undefined }
      auto_confirm_stale_salary_records: {
        Args: { p_tenant_id: string }
        Returns: number
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
      close_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      create_onboarding_user: {
        Args: { p_email: string; p_full_name: string; p_password: string }
        Returns: string
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
      get_auth_tenant_id: { Args: never; Returns: string }
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
      get_dashboard_summary: { Args: { p_tenant_id: string }; Returns: Json }
      get_financial_anomalies: { Args: { p_tenant_id: string }; Returns: Json }
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
      get_ktv_leaderboard: {
        Args: { p_month: string; p_tenant_id: string }
        Returns: {
          average_rating: number
          commissions: number
          full_name: string
          ktv_id: string
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
      increment_loyalty_points: {
        Args: { p_customer_id: string; p_points: number }
        Returns: undefined
      }
      increment_tenant_sms: { Args: { p_tenant_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_hq_admin: { Args: never; Returns: boolean }
      is_hq_super_admin: { Args: never; Returns: boolean }
      is_valid_tenant: { Args: { t_id: string }; Returns: boolean }
      lock_monthly_records: {
        Args: { p_month: string; p_tenant_id: string }
        Returns: undefined
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
      renew_tenant_subscription: {
        Args: { p_invoice_number: string; p_payment_method: string }
        Returns: boolean
      }
      reopen_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      seed_default_coa: { Args: { p_tenant_id: string }; Returns: number }
      preview_closing_entries: {
        Args: { p_period_id: string }
        Returns: {
          step: number
          step_name: string
          description: string
          debit_account_code: string
          credit_account_code: string
          amount: number
        }[]
      }
      generate_closing_entries: {
        Args: { p_period_id: string }
        Returns: {
          entry_id: string | null
          step: string
          total_amount: number
        }[]
      }
    }
    Enums: {
      AttendanceStatus: "present" | "late" | "absent" | "half_day"
      BookingStatus:
        | "inquiry"
        | "deposit_pending"
        | "booked"
        | "in_progress"
        | "completed"
        | "cancelled"
      CustomerStatus: "prospect" | "active" | "completed" | "inactive"
      ExpenseStatus: "submitted" | "approved" | "rejected"
      MessageType: "text" | "system" | "file"
      PaymentMethod: "cash" | "bank_transfer" | "zalo_pay" | "momo"
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
  public: {
    Enums: {
      AttendanceStatus: ["present", "late", "absent", "half_day"],
      BookingStatus: [
        "inquiry",
        "deposit_pending",
        "booked",
        "in_progress",
        "completed",
        "cancelled",
      ],
      CustomerStatus: ["prospect", "active", "completed", "inactive"],
      ExpenseStatus: ["submitted", "approved", "rejected"],
      MessageType: ["text", "system", "file"],
      PaymentMethod: ["cash", "bank_transfer", "zalo_pay", "momo"],
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
