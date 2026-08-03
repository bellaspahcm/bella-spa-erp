#!/bin/bash
# Re-enable role checks in admin APIs after user_roles migration deployed

echo "🔧 Re-enabling role checks in admin APIs..."

FILES=(
  "src/app/api/admin/partner-applications/[id]/approve/route.ts"
  "src/app/api/admin/partner-applications/[id]/reject/route.ts"
  "src/app/api/admin/partner-applications/[id]/request-info/route.ts"
)

for file in "${FILES[@]}"; do
  echo "📝 Processing: $file"
  
  # Uncomment the role check section
  sed -i 's/\/\/ 2\. Verify admin role/2. Verify admin role/g' "$file"
  sed -i 's/\/\/ const { data: roleCheck/const { data: roleCheck/g' "$file"
  sed -i 's/\/\/ if (!roleCheck/if (!roleCheck/g' "$file"
  
  echo "✅ Done: $file"
done

echo ""
echo "📝 Also uncomment role assignment in:"
echo "   src/lib/provisioning/partner-provisioning-engine.ts (line ~113)"
echo ""
echo "✅ All role checks re-enabled!"
