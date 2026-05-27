/**
 * Shared SLO thresholds — apply across multiple scripts.
 *
 * Format theo k6 spec:
 *   { 'metric_name': ['expression', ...] }
 *
 * 'expression' ví dụ:
 *   - 'p(95)<500'      → 95th percentile dưới 500ms
 *   - 'avg<200'        → trung bình dưới 200ms
 *   - 'rate>0.99'      → success rate trên 99%
 *   - 'rate<0.01'      → failure rate dưới 1%
 *
 * Khi 1 threshold fail → k6 exit code != 0 → CI fail.
 */

/** Baseline: response time + error rate cho mọi script. */
export const BASE_THRESHOLDS = {
  // 99% requests phải dưới 1s; 95% phải dưới 500ms
  http_req_duration: ["p(95)<500", "p(99)<1000"],
  // Lỗi HTTP (4xx/5xx) dưới 1%
  http_req_failed: ["rate<0.01"],
  // Failed checks dưới 1%
  checks: ["rate>0.99"],
};

/** Strict: cho smoke + critical paths — yêu cầu cao hơn. */
export const STRICT_THRESHOLDS = {
  http_req_duration: ["p(95)<300", "p(99)<700"],
  http_req_failed: ["rate<0.001"],
  checks: ["rate>0.999"],
};

/** Relaxed: cho stress test khi cố ý đẩy đến giới hạn. */
export const RELAXED_THRESHOLDS = {
  http_req_duration: ["p(95)<2000"],
  http_req_failed: ["rate<0.05"], // 5% lỗi chấp nhận được dưới stress
  checks: ["rate>0.95"],
};
