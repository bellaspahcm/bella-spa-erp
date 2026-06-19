#!/usr/bin/env bash
# Safe Vercel rollback helper. Dry-run is the default.
# Usage: ./scripts/emergency-rollback.sh "<reason>" [--target URL] [--execute]

set -euo pipefail

PROJECT_NAME="${VERCEL_PROJECT_NAME:-bella-spa-erp}"
VERCEL_SCOPE="${VERCEL_SCOPE:-bella-spa-s-projects}"
PRODUCTION_BASE_URL="${PRODUCTION_BASE_URL:-https://bella-spa-erp.vercel.app}"
EXECUTE=false
TARGET=""
REASON=""

usage() {
  cat <<'USAGE'
Usage: ./scripts/emergency-rollback.sh "<reason>" [--target URL] [--execute]

Without --execute the script only prints the selected deployment.
Use --target to verify a known Ready deployment without querying Vercel.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      [ "$#" -ge 2 ] || { echo "--target requires a URL" >&2; exit 1; }
      TARGET="$2"
      shift 2
      ;;
    --execute)
      EXECUTE=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -n "$REASON" ]; then
        echo "Unexpected argument: $1" >&2
        usage
        exit 1
      fi
      REASON="$1"
      shift
      ;;
  esac
done

[ -n "$REASON" ] || { usage; exit 1; }

if [ -z "$TARGET" ]; then
  command -v jq >/dev/null 2>&1 || { echo "jq is required to select a deployment." >&2; exit 1; }
  deployments="$(npx --yes vercel ls "$PROJECT_NAME" --scope "$VERCEL_SCOPE" --json)"
  TARGET="$(printf '%s' "$deployments" | jq -r '
    (if type == "array" then . else (.deployments // []) end)
    | map(select(((.state // .status // .readyState // "") | ascii_upcase) == "READY"))
    | .[1].url // empty
  ')"
fi

[ -n "$TARGET" ] || { echo "No previous Ready deployment was found." >&2; exit 1; }
case "$TARGET" in
  http://*.vercel.app|https://*.vercel.app) ;;
  *.vercel.app) TARGET="https://$TARGET" ;;
  *) echo "Rollback target must be a vercel.app deployment URL." >&2; exit 1 ;;
esac

echo "Reason: $REASON"
echo "Project: $PROJECT_NAME"
echo "Scope: $VERCEL_SCOPE"
echo "Target: $TARGET"

if [ "$EXECUTE" != true ]; then
  echo "DRY RUN: production was not changed."
  echo "Re-run with --execute after reviewing the target."
  exit 0
fi

echo "Type exactly: ROLLBACK $TARGET"
read -r confirmation
[ "$confirmation" = "ROLLBACK $TARGET" ] || { echo "Rollback cancelled." >&2; exit 1; }

npx --yes vercel promote "$TARGET" --scope "$VERCEL_SCOPE" --yes

for attempt in 1 2 3 4 5 6; do
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$PRODUCTION_BASE_URL/api/health")"
  if [ "$status" = 200 ]; then
    echo "Rollback completed and production health is HTTP 200."
    if [ -n "${ROLLBACK_LOG_PATH:-}" ]; then
      printf '%s ROLLBACK reason=%s target=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$REASON" "$TARGET" >> "$ROLLBACK_LOG_PATH"
    fi
    exit 0
  fi
  echo "Health attempt $attempt returned HTTP $status"
  sleep 10
done

echo "Rollback promotion completed, but production health did not recover." >&2
exit 1
