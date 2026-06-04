'use server';

import { createClient } from '@/lib/supabase-server';
import { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ChatCustomerRpcRow =
  Database['public']['Functions']['get_chat_customers']['Returns'][number];
type ChatAuthContext = {
  tenantId: string;
  userId: string;
};

export type ChatCustomerSummary = ChatCustomerRpcRow & {
  last_message: string | null;
  last_message_at: string | null;
};

export type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

async function getChatAuthContext(supabase: SupabaseServerClient): Promise<ChatAuthContext> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Error loading dashboard chat auth user:', authError);
    throw authError;
  }

  if (!user?.id) {
    throw new Error('Can dang nhap de su dung trung tam tin nhan.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error loading dashboard chat user tenant:', profileError);
    throw profileError;
  }

  if (!profile?.tenant_id) {
    throw new Error('Tai khoan hien tai chua gan voi chi nhanh hop le.');
  }

  return {
    tenantId: profile.tenant_id,
    userId: user.id
  };
}

async function getVerifiedCustomerTenantId(
  supabase: SupabaseServerClient,
  customerId: string,
  context: ChatAuthContext
): Promise<string> {
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('tenant_id')
    .eq('id', customerId)
    .eq('tenant_id', context.tenantId)
    .single();

  if (customerError) {
    console.error('Error loading customer tenant for dashboard chat:', customerError);
    throw customerError;
  }

  if (!customerData?.tenant_id) {
    throw new Error('Khong tim thay khach hang hop le trong chi nhanh hien tai.');
  }

  return customerData.tenant_id;
}

function normalizeMessageText(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    throw new Error('Noi dung tin nhan khong duoc de trong.');
  }
  return normalized;
}

async function getLatestMessagesByCustomer(
  supabase: SupabaseServerClient,
  customerIds: string[],
  tenantId: string
) {
  if (customerIds.length === 0) return new Map<string, ChatMessageRow>();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching latest chat previews:', error);
    throw error;
  }

  const latestByCustomer = new Map<string, ChatMessageRow>();
  for (const message of data ?? []) {
    if (message.customer_id && !latestByCustomer.has(message.customer_id)) {
      latestByCustomer.set(message.customer_id, message);
    }
  }

  return latestByCustomer;
}

export async function getChatCustomers(): Promise<ChatCustomerSummary[]> {
  const supabase = await createClient();
  const context = await getChatAuthContext(supabase);

  // The parameterless RPC uses auth.uid() internally on Postgres.
  const { data, error } = await supabase.rpc('get_chat_customers');

  if (error) {
    console.error('Error fetching chat customers:', error);
    throw error;
  }

  const customers: ChatCustomerRpcRow[] = data ?? [];
  const latestByCustomer = await getLatestMessagesByCustomer(
    supabase,
    customers.map((customer) => customer.id),
    context.tenantId
  );

  return customers.map((customer) => {
    const latestMessage = latestByCustomer.get(customer.id);

    return {
      ...customer,
      last_message: latestMessage?.message ?? null,
      last_message_at: latestMessage?.created_at ?? null
    };
  });
}

export async function getChatMessages(customerId: string): Promise<ChatMessageRow[]> {
  const supabase = await createClient();
  const context = await getChatAuthContext(supabase);
  const tenantId = await getVerifiedCustomerTenantId(supabase, customerId, context);

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }

  return data ?? [];
}

export async function sendChatMessage(
  customerId: string,
  message: string
): Promise<ChatMessageRow> {
  const normalizedMessage = normalizeMessageText(message);
  const supabase = await createClient();
  const context = await getChatAuthContext(supabase);
  const tenantId = await getVerifiedCustomerTenantId(supabase, customerId, context);

  const insertPayload: Database['public']['Tables']['chat_messages']['Insert'] = {
    customer_id: customerId,
    message: normalizedMessage,
    sender_type: 'staff',
    sender_id: context.userId,
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
  const context = await getChatAuthContext(supabase);
  const tenantId = await getVerifiedCustomerTenantId(supabase, customerId, context);

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
