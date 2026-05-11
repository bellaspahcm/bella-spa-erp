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
      tenants: {
        Row: {
          id: string
          name: string
          parent_tenant_id: string | null
          franchise_agreement_date: string | null
          royalty_rate: number | null
          contact_name: string | null
          contact_phone: string | null
          address: string | null
          status: 'active' | 'suspended' | 'terminated'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_tenant_id?: string | null
          franchise_agreement_date?: string | null
          royalty_rate?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          address?: string | null
          status?: 'active' | 'suspended' | 'terminated'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_tenant_id?: string | null
          franchise_agreement_date?: string | null
          royalty_rate?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          address?: string | null
          status?: 'active' | 'suspended' | 'terminated'
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          password_hash: string | null
          full_name: string
          phone: string | null
          role: 'admin' | 'ktv_lead' | 'ktv' | 'admin_staff' | 'accountant'
          avatar_url: string | null
          status: string | null
          tenant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash?: string | null
          full_name: string
          phone?: string | null
          role: 'admin' | 'ktv_lead' | 'ktv' | 'admin_staff' | 'accountant'
          avatar_url?: string | null
          status?: string | null
          tenant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string | null
          full_name?: string
          phone?: string | null
          role?: 'admin' | 'ktv_lead' | 'ktv' | 'admin_staff' | 'accountant'
          avatar_url?: string | null
          status?: string | null
          tenant_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          phone: string
          name_mother: string
          name_baby: string | null
          dob_baby: string | null
          dob_expected: string | null
          address: string | null
          referrer_id: string | null
          zalo_oa_id: string | null
          status: string | null
          notes: string | null
          tenant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          name_mother: string
          name_baby?: string | null
          dob_baby?: string | null
          dob_expected?: string | null
          address?: string | null
          referrer_id?: string | null
          zalo_oa_id?: string | null
          status?: string | null
          notes?: string | null
          tenant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          name_mother?: string
          name_baby?: string | null
          dob_baby?: string | null
          dob_expected?: string | null
          address?: string | null
          referrer_id?: string | null
          zalo_oa_id?: string | null
          status?: string | null
          notes?: string | null
          tenant_id?: string | null
          created_at?: string | null
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          booking_number: string
          customer_id: string
          package_id: string | null
          status: 'inquiry' | 'deposit_pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled'
          deposit_amount: number | null
          full_price: number | null
          start_date: string | null
          end_date: string | null
          expected_birth_date: string | null
          total_sessions: number | null
          completed_sessions: number | null
          contract_signed: boolean | null
          contract_url: string | null
          assigned_ktv_id: string | null
          tenant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_number: string
          customer_id: string
          package_id?: string | null
          status?: 'inquiry' | 'deposit_pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled'
          deposit_amount?: number | null
          full_price?: number | null
          start_date?: string | null
          end_date?: string | null
          expected_birth_date?: string | null
          total_sessions?: number | null
          completed_sessions?: number | null
          contract_signed?: boolean | null
          contract_url?: string | null
          assigned_ktv_id?: string | null
          tenant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_number?: string
          customer_id?: string
          package_id?: string | null
          status?: 'inquiry' | 'deposit_pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled'
          deposit_amount?: number | null
          full_price?: number | null
          start_date?: string | null
          end_date?: string | null
          expected_birth_date?: string | null
          total_sessions?: number | null
          completed_sessions?: number | null
          contract_signed?: boolean | null
          contract_url?: string | null
          assigned_ktv_id?: string | null
          tenant_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      session_logs: {
        Row: {
          id: string
          booking_id: string
          session_number: number
          assigned_date: string | null
          completed_date: string | null
          completed_by_ktv_id: string | null
          address: string | null
          status: 'scheduled' | 'completed' | 'cancelled'
          tenant_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          session_number: number
          assigned_date?: string | null
          completed_date?: string | null
          completed_by_ktv_id?: string | null
          address?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled'
          tenant_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          session_number?: number
          assigned_date?: string | null
          completed_date?: string | null
          completed_by_ktv_id?: string | null
          address?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled'
          tenant_id?: string | null
          created_at?: string
        }
      }
      session_reviews: {
        Row: {
          id: string
          session_log_id: string
          reviewer_id: string | null
          ktv_id: string | null
          rating: number
          note: string | null
          note_encrypted: boolean | null
          is_hidden_from_ktv: boolean | null
          status: 'pending_review' | 'approved' | 'published'
          tenant_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_log_id: string
          reviewer_id?: string | null
          ktv_id?: string | null
          rating: number
          note?: string | null
          note_encrypted?: boolean | null
          is_hidden_from_ktv?: boolean | null
          status?: 'pending_review' | 'approved' | 'published'
          tenant_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_log_id?: string
          reviewer_id?: string | null
          ktv_id?: string | null
          rating?: number
          note?: string | null
          note_encrypted?: boolean | null
          is_hidden_from_ktv?: boolean | null
          status?: 'pending_review' | 'approved' | 'published'
          tenant_id?: string | null
          created_at?: string
        }
      }
      revenue: {
        Row: {
          id: string
          booking_id: string | null
          amount: number
          revenue_type: 'deposit' | 'session_completed' | 'additional'
          payment_method: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo'
          received_date: string
          recorded_by_id: string | null
          status: 'pending' | 'confirmed'
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          booking_id?: string | null
          amount: number
          revenue_type?: 'deposit' | 'session_completed' | 'additional'
          payment_method?: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo'
          received_date: string
          recorded_by_id?: string | null
          status?: 'pending' | 'confirmed'
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          booking_id?: string | null
          amount?: number
          revenue_type?: 'deposit' | 'session_completed' | 'additional'
          payment_method?: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo'
          received_date?: string
          recorded_by_id?: string | null
          status?: 'pending' | 'confirmed'
          notes?: string | null
          tenant_id?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          category: string
          amount: number
          description: string | null
          receipt_url: string | null
          expense_date: string
          approved_by_id: string | null
          status: 'submitted' | 'approved' | 'rejected'
          submitted_by_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          category: string
          amount: number
          description?: string | null
          receipt_url?: string | null
          expense_date: string
          approved_by_id?: string | null
          status?: 'submitted' | 'approved' | 'rejected'
          submitted_by_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          category?: string
          amount?: number
          description?: string | null
          receipt_url?: string | null
          expense_date?: string
          approved_by_id?: string | null
          status?: 'submitted' | 'approved' | 'rejected'
          submitted_by_id?: string | null
          tenant_id?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
