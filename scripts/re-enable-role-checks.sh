#!/bin/bash
# Re-enable role checks in Admin API routes after user_roles table exists

echo "🔧 Re-enabling role checks..."

# Uncomment role checks in approve route
sed -i 's|// \(.*user_roles.*\)|    \1|g' src/app/api/admin/partner-applications/[id]/approve/route.ts

# Uncomment role checks in reject route
sed -i 's|// \(.*user_roles.*\)|    \1|g' src/app/api/admin/partner-applications/[id]/reject/route.ts

# Uncomment role checks in request-info route
sed -i 's|// \(.*user_roles.*\)|    \1|g' src/app/api/admin/partner-applications/[id]/request-info/route.ts

echo "✅ Role checks re-enabled"
echo "   Run: npm run build"
