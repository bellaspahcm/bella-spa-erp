import type { Database } from '@/types/database.types';

export type PortalChatMessage = Database['public']['Tables']['chat_messages']['Row'] & {
  isOptimistic?: boolean;
};

function getMessageTimestamp(message: PortalChatMessage) {
  return new Date(message.created_at ?? '1970-01-01T00:00:00.000Z').getTime();
}

export function sortPortalMessages(messages: PortalChatMessage[]) {
  return [...messages].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
}

export function countUnreadStaffMessages(messages: PortalChatMessage[]) {
  return messages.filter((message) => message.sender_type === 'staff' && !message.is_read).length;
}

export function mergePortalMessage(
  messages: PortalChatMessage[],
  incomingMessage: PortalChatMessage
) {
  const incomingCustomerId = incomingMessage.customer_id;
  const incomingMessageText = incomingMessage.message.trim();

  const replacedOptimistic = messages.map((message) => {
    const isMatchingOptimisticCustomerMessage =
      message.isOptimistic &&
      incomingMessage.sender_type === 'customer' &&
      message.sender_type === 'customer' &&
      message.message.trim() === incomingMessageText &&
      (!incomingCustomerId || !message.customer_id || message.customer_id === incomingCustomerId);

    return isMatchingOptimisticCustomerMessage ? incomingMessage : message;
  });

  if (replacedOptimistic.some((message) => message.id === incomingMessage.id)) {
    return sortPortalMessages(
      replacedOptimistic.map((message) =>
        message.id === incomingMessage.id ? { ...message, ...incomingMessage } : message
      )
    );
  }

  return sortPortalMessages([...replacedOptimistic, incomingMessage]);
}

export function replacePortalMessage(
  messages: PortalChatMessage[],
  temporaryId: string,
  savedMessage: PortalChatMessage
) {
  return sortPortalMessages(
    messages.map((message) => (message.id === temporaryId ? savedMessage : message))
  );
}

export function removePortalMessage(messages: PortalChatMessage[], messageId: string) {
  return messages.filter((message) => message.id !== messageId);
}

export function markStaffMessagesReadLocally(messages: PortalChatMessage[]) {
  return messages.map((message) =>
    message.sender_type === 'staff' ? { ...message, is_read: true } : message
  );
}
