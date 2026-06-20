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

The script always validates that the target is Ready and belongs to the
configured Vercel project. Without --execute, production is not changed.
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
[ -n "${VERCEL_TOKEN:-}" ] || { echo "VERCEL_TOKEN is required." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required." >&2; exit 1; }

if [ -z "$TARGET" ]; then
  deployments="$(npx --yes vercel ls "$PROJECT_NAME" --scope "$VERCEL_SCOPE" --token "$VERCEL_TOKEN" --json)"
  TARGET="$(printf '%s' "$deployments" | jq -r '
    (if type == "array" then . else (.deployments // []) end)
    | map(select(
        (((.state // .status // .readyState // "") | ascii_upcase) == "READY")
        and ((.target // .environment // "") == "production")
      ))
    | .[1].url // empty
  ')"
fi

[ -n "$TARGET" ] || { echo "No previous Ready production deployment was found." >&2; exit 1; }
case "$TARGET" in
  http://*.vercel.app|https://*.vercel.app) ;;
  *.vercel.app) TARGET="https://$TARGET" ;;
  *) echo "Rollback target must be a vercel.app deployment URL." >&2; exit 1 ;;
esac

inspection="$(npx --yes vercel inspect "$TARGET" --scope "$VERCEL_SCOPE" --token "$VERCEL_TOKEN" --json)"
ready_state="$(printf '%s' "$inspection" | jq -r '(.readyState // .state // .status // "") | ascii_upcase')"
target_project="$(printf '%s' "$inspection" | jq -r '.project.name // .projectName // .name // empty')"

[ "$ready_state" = "READY" ] || { echo "Rollback target is not Ready." >&2; exit 1; }
[ "$target_project" = "$PROJECT_NAME" ] || {
  echo "Rollback target belongs to project '$target_project', expected '$PROJECT_NAME'." >&2
  exit 1
}

echo "Reason: $REASON"
echo "Project: $PROJECT_NAME"
echo "Scope: $VERCEL_SCOPE"
echo "Verified target: $TARGET"

if [ "$EXECUTE" != true ]; then
  echo "DRY RUN: production was not changed."
  echo "Re-run with --execute after reviewing the verified target."
  exit 0
fi

echo "Type exactly: ROLLBACK $TARGET"
read -r confirmation
[ "$confirmation" = "ROLLBACK $TARGET" ] || { echo "Rollback cancelled." >&2; exit 1; }

npx --yes vercel promote "$TARGET" --scope "$VERCEL_SCOPE" --token "$VERCEL_TOKEN" --yes

for attempt in 1 2 3 4 5 6; do
  if ! status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$PRODUCTION_BASE_URL/api/health")"; then
    status="000"
  fi
  if [ "$status" = 200 ]; then
    echo "Rollback completed and production health is HTTP 200."
    if [ -n "${ROLLBACK_LOG_PATH:-}" ]; then
      printf '%s ROLLBACK reason=%s target=%s
' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$REASON" "$TARGET" >> "$ROLLBACK_LOG_PATH"
    fi
    exit 0
  fi
  echo "Health attempt $attempt returned HTTP $status"
  sleep 10
done

echo "Rollback promotion completed, but production health did not recover." >&2
exit 1
