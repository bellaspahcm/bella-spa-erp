import { findMissingRequiredFields, inferBusinessEventType } from '@/services/accounting/template-rules';

export function resolveReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
}
