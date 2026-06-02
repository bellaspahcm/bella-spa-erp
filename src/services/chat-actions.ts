'use server';

import { createClient } from '@/lib/supabase-server';
import { Database } from '@/types/database.types';

export type ChatCustomerSummary = {
  created_at: string;
  customer_level: string;
  full_name: string;
  id: string;
  last_package_name: string;
  phone: string;
  total_spent: number;
  unread_count: number;
};

export type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

export async function getChatCustomers(): Promise<ChatCustomerSummary[]> {
  const supabase = await createClient();

  // The parameterless RPC uses auth.uid() internally on Postgres.
  const { data, error } = await supabase.rpc('get_chat_customers');

  if (error) {
    console.error('Error fetching chat customers:', error);
    throw error;
  }

  return data ?? [];
}

export async function getChatMessages(customerId: string): Promise<ChatMessageRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }

  return data ?? [];
}

export async function sendChatMessage(
  customerId: string,
  message: string,
  senderType: 'customer' | 'staff'
): Promise<ChatMessageRow> {
  const supabase = await createClient();

  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('tenant_id')
    .eq('id', customerId)
    .single();

  if (customerError) {
    console.error('Error loading customer tenant for chat message:', customerError);
    throw customerError;
  }

  const tenantId = customerData?.tenant_id;
  if (!tenantId) {
    throw new Error('Không tìm thấy chi nhánh hợp lệ cho khách hàng này.');
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Error loading chat sender auth user:', authError);
    throw authError;
  }

  const insertPayload: Database['public']['Tables']['chat_messages']['Insert'] = {
    customer_id: customerId,
    message,
    sender_type: senderType,
    sender_id: senderType === 'staff' ? (authUser?.id || null) : null,
    tenant_id: tenantId,
    is_read: false
  };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }

  return data;
}

export async function markMessagesAsRead(customerId: string): Promise<void> {
  const supabase = await createClient();

  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('tenant_id')
    .eq('id', customerId)
    .single();

  if (customerError) {
    console.error('Error loading customer tenant before marking messages read:', customerError);
    throw customerError;
  }

  const tenantId = customerData?.tenant_id;
  if (!tenantId) {
    throw new Error('Không tìm thấy chi nhánh hợp lệ cho khách hàng này.');
  }

  const updatePayload: Database['public']['Tables']['chat_messages']['Update'] = {
    is_read: true
  };

  const { error } = await supabase
    .from('chat_messages')
    .update(updatePayload)
    .eq('customer_id', customerId)
    .eq('sender_type', 'customer')
    .eq('is_read', false)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
}
