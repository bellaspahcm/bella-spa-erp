# Bella ERP API Documentation

This directory contains the API reference documentation for Bella ERP Phase 3.

## Files

### phase-3-api-reference.md

Complete API documentation covering:
- **Authentication**: Session-based auth with automatic tenant extraction
- **TenantContext Integration**: How tenant context is injected into all requests
- **Core Contract Types**: Standard types (CoreBookingOrder, PaymentIntent, etc.)
- **Error Handling**: Standard error codes and responses
- **API Endpoints**:
  - Order Management (create, read, update, complete, cancel)
  - Payments (process, refund, query)
  - Notifications (send, query, mark as read)
  - Analytics & Dashboard (metrics, reports, exports)
  - Audit Logs (compliance tracking)
  - Tenant Configuration (feature flags, settings)
- **Postman Collection**: Ready-to-use API testing collection
- **Migration Notes**: Changes from pre-Phase 3 APIs

### bella-erp-phase3.postman_collection.json

Postman collection with all API endpoints pre-configured:
- Authentication flows
- CRUD operations for orders
- Payment processing
- Notification management
- Analytics queries
- Audit log access

**Setup**:
1. Import into Postman
2. Set environment variables:
   - `base_url`: Your API base URL
   - `session_token`: Login token (auto-populated after login)

## Quick Start

1. **Read the API Reference**: Start with `phase-3-api-reference.md`
2. **Import Postman Collection**: Load `bella-erp-phase3.postman_collection.json` into Postman
3. **Login**: Run the login request to get your session token
4. **Test Endpoints**: Try creating an order, processing a payment, etc.

## Key Phase 3 Changes

### 1. TenantContext Auto-Injection
All endpoints automatically extract tenant configuration from the session token. No need to manually pass `tenantId`.

**Before Phase 3**:
```json
{
  "tenantId": "tenant_001",  // ❌ Had to include manually
  "customerId": "cust_123",
  ...
}
```

**After Phase 3**:
```json
{
  // tenantId auto-filled from session ✅
  "customerId": "cust_123",
  ...
}
```

### 2. Core Contract Types
Responses use standardized contract types for type safety and consistency.

### 3. Module Adapter Integration
APIs can invoke module-specific logic (e.g., spa KTV validation, cleaning team assignment).

### 4. Enhanced Error Handling
Standardized error codes and better error messages.

## Support

- **Documentation**: `docs/architecture/` and `docs/migration/`
- **API Issues**: Slack #api-support
- **Bug Reports**: GitHub Issues

---

**Last Updated**: 2025-06-01  
**Version**: 1.0
