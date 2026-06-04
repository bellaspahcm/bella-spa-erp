import { getAccountingErrorMessage } from '../lib/accounting-error-message';

describe('getAccountingErrorMessage', () => {
  it('returns the fallback for masked Next.js Server Component production errors', () => {
    const message = [
      'An error occurred in the Server Components render.',
      'The specific message is omitted in production builds to avoid leaking sensitive details.',
      'A digest property is included on this error instance.',
    ].join(' ');

    expect(getAccountingErrorMessage(new Error(message), 'Không thể tải dữ liệu kế toán.')).toBe(
      'Không thể tải dữ liệu kế toán.'
    );
  });

  it('keeps explicit business error messages', () => {
    expect(
      getAccountingErrorMessage(
        new Error('Chưa thể bật Professional Core: còn 4 dòng chưa phân loại.'),
        'Không thể đồng bộ kế toán.'
      )
    ).toBe('Chưa thể bật Professional Core: còn 4 dòng chưa phân loại.');
  });
});
