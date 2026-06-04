const NEXT_SERVER_ERROR_MARKERS = [
  'server components render',
  'specific message is omitted in production builds',
  'avoid leaking sensitive details',
];

function extractMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

export function isMaskedNextServerError(message: string) {
  const normalized = message.toLowerCase();
  return NEXT_SERVER_ERROR_MARKERS.some((marker) => normalized.includes(marker));
}

export function getAccountingErrorMessage(error: unknown, fallback: string) {
  const message = extractMessage(error).trim();
  if (!message || isMaskedNextServerError(message)) return fallback;
  return message;
}
