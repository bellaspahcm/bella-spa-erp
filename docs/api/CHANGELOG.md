# API Changelog

All notable changes to the Bella ERP Partner API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned Features
- Batch operations API (create multiple orders in one request)
- GraphQL API endpoint
- Real-time order status via WebSockets
- Advanced filtering with full-text search
- Customer loyalty points API
- Staff scheduling API

---

## [1.0.0] - 2026-06-18

### Added - Initial Release

#### Core Features
- ✅ Partner management system with API key authentication
- ✅ Rate limiting with tiered plans (free, basic, pro, enterprise)
- ✅ Sandbox environment for testing
- ✅ Request logging and usage analytics
- ✅ Webhook subscriptions with signature verification

#### Endpoints

**Orders API:**
- `POST /v1/orders` - Create order
- `GET /v1/orders` - List orders (pagination, filtering, sorting)
- `GET /v1/orders/{id}` - Get order by ID
- `PATCH /v1/orders/{id}` - Update order
- `POST /v1/orders/{id}/complete` - Mark order as completed
- `POST /v1/orders/{id}/cancel` - Cancel order

**Payments API:**
- `POST /v1/payments` - Create payment
- `GET /v1/payments` - List payments
- `GET /v1/payments/{id}` - Get payment by ID

**Customers API:**
- `POST /v1/customers` - Create customer
- `GET /v1/customers` - List customers
- `GET /v1/customers/{id}` - Get customer by ID
- `PATCH /v1/customers/{id}` - Update customer

**Products API:**
- `GET /v1/products` - List products
- `GET /v1/products/{id}` - Get product by ID

**Webhooks API:**
- `POST /v1/webhooks/subscribe` - Subscribe to events
- `GET /v1/webhooks/subscriptions` - List subscriptions

#### Webhook Events
- `order.created`
- `order.updated`
- `order.completed`
- `order.cancelled`
- `payment.received`
- `payment.refunded`
- `invoice.created`
- `invoice.cancelled`
- `customer.created`
- `customer.updated`

#### Security Features
- HMAC-SHA256 webhook signature verification
- Timestamp validation (5-minute window)
- API key format: `pk_live_` (production) and `pk_test_` (sandbox)
- Scope-based access control
- Tenant isolation

#### Rate Limits
- **Free Tier**: 60 requests/minute, 1,000 requests/day
- **Basic Tier**: 300 requests/minute, 10,000 requests/day
- **Pro Tier**: 600 requests/minute, 50,000 requests/day
- **Enterprise Tier**: 1,200 requests/minute, 200,000 requests/day
- **Unlimited Tier**: No limits (enterprise custom)

#### Documentation
- Getting Started Guide
- API Reference
- Integration Guide
- Security Best Practices
- Webhooks Guide
- Error Handling Guide
- Sandbox Environment Guide
- Rate Limiting Guide

---

## Migration Guides

### Migrating to v1.0.0

This is the initial release. No migration needed.

### Future Versions

Migration guides will be provided here when breaking changes are introduced.

---

## Versioning Policy

### API Versions

Bella ERP API uses URL-based versioning:
- Current: `https://api.bellaspa.com/v1/`
- Future: `https://api.bellaspa.com/v2/`

### Version Support

- **Current Version (v1)**: Full support, active development
- **Previous Version**: Supported for 12 months after new version release
- **Deprecated Version**: 6 months notice before sunset

### Breaking Changes

We consider the following changes as breaking:

- Removing an endpoint
- Removing a required field
- Changing response structure
- Changing authentication method
- Removing a webhook event

### Non-Breaking Changes

These changes are considered non-breaking:

- Adding new endpoints
- Adding optional fields to requests
- Adding new fields to responses
- Adding new webhook events
- Adding new error codes
- Performance improvements
- Bug fixes

---

## Deprecation Policy

### Deprecation Timeline

1. **Announcement**: Deprecated feature announced via email and docs
2. **Deprecation Period**: Feature continues to work for 12 months
3. **Sunset Date**: Feature removed after deprecation period

### Deprecation Notices

Deprecated features include a `deprecation` field in responses:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "deprecation": {
      "message": "This endpoint is deprecated and will be removed on 2027-06-18",
      "sunset_date": "2027-06-18",
      "replacement_endpoint": "/v2/orders"
    }
  }
}
```

### Deprecation Response Header

```
Deprecation: true
Sunset: Fri, 18 Jun 2027 00:00:00 GMT
Link: <https://api.bellaspa.com/v2/orders>; rel="alternate"
```

---

## Release Schedule

### Regular Releases

- **Major Versions**: Annually (June)
- **Minor Versions**: Quarterly (March, June, September, December)
- **Patch Versions**: As needed (bug fixes, security patches)

### Release Types

#### Major Releases (v1.0.0 → v2.0.0)

- Breaking changes
- New core features
- Architecture changes
- 12-month deprecation period for old version

#### Minor Releases (v1.0.0 → v1.1.0)

- New features (backward compatible)
- New endpoints
- Enhanced functionality
- No breaking changes

#### Patch Releases (v1.0.0 → v1.0.1)

- Bug fixes
- Security patches
- Performance improvements
- Documentation updates

---

## Upgrade Recommendations

### Before Upgrading

1. **Review Changelog**: Understand what's changed
2. **Check Deprecations**: Update deprecated features
3. **Test in Sandbox**: Test new version thoroughly
4. **Update Client Libraries**: Use latest SDK versions
5. **Review Error Handling**: Check for new error codes
6. **Update Documentation**: Sync internal docs

### Upgrade Checklist

- [ ] Review breaking changes (if any)
- [ ] Update API client library
- [ ] Update base URL (if version changed)
- [ ] Test critical flows in sandbox
- [ ] Update error handling for new codes
- [ ] Update webhook event handlers (if new events)
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Monitor error rates after deployment
- [ ] Update internal documentation

---

## Backward Compatibility

### Guaranteed Compatibility

Within a major version (e.g., v1.x.x), we guarantee:

- Existing endpoints continue to work
- Required fields remain required
- Response structures remain consistent
- Authentication methods remain valid
- Webhook signatures remain valid

### Optional Field Evolution

We may add optional fields without version change:

```json
// v1.0.0
{
  "customer_id": "cus_001",
  "customer_name": "Nguyễn Văn A"
}

// v1.1.0 (backward compatible)
{
  "customer_id": "cus_001",
  "customer_name": "Nguyễn Văn A",
  "customer_email": "nguyenvana@example.com",  // New optional field
  "customer_phone": "0901234567"               // New optional field
}
```

**Your code should ignore unknown fields** to remain compatible with future versions.

---

## Feature Flags

Some features are released behind feature flags and can be enabled per partner:

### Available Feature Flags

Currently, no feature flags are active. Future flags will be documented here.

### Enabling Feature Flags

Contact support to enable beta features:
- Email: api-support@bellaspa.com
- Subject: "Enable Feature Flag: [feature_name]"

---

## Beta Features

Beta features are production-ready but may change based on feedback:

### Currently in Beta

None at this time.

### Beta Program

Interested in trying beta features?
1. Email api-support@bellaspa.com
2. Specify which beta feature
3. Describe your use case
4. We'll enable it for your sandbox environment

---

## Security Updates

### Security Patch Policy

- **Critical**: Released immediately, all versions patched
- **High**: Released within 7 days
- **Medium**: Released within 30 days
- **Low**: Included in next minor release

### Security Advisories

Security advisories are published at:
- Security page: https://security.bellaspa.com
- Email: api-security@bellaspa.com
- Status page: https://status.bellaspa.com

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email security@bellaspa.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information

We'll respond within 24 hours.

---

## Staying Informed

### Notification Channels

Stay updated on API changes:

1. **Email Notifications** (recommended)
   - Critical updates
   - Breaking changes
   - Security advisories
   - Subscribe: api-updates@bellaspa.com

2. **Changelog RSS Feed**
   - https://api.bellaspa.com/changelog.rss

3. **Status Page**
   - https://status.bellaspa.com
   - Subscribe to incident notifications

4. **Developer Blog**
   - https://blog.bellaspa.com/developers
   - Monthly API updates

5. **GitHub Discussions**
   - https://github.com/bellaspa/api-discussions
   - Community discussions
   - Feature requests

### Release Notifications

Major releases announced:
- 3 months in advance (announcement)
- 1 month before release (final reminder)
- On release day (release notes)
- 1 month after release (adoption stats)

---

## Feedback

We value your feedback! Help us improve the API:

### Feature Requests

Submit feature requests via:
- Email: api-feedback@bellaspa.com
- GitHub: https://github.com/bellaspa/api-discussions
- Admin UI: Settings → API Feedback

### Bug Reports

Report bugs via:
- Email: api-support@bellaspa.com
- Include `request_id` from error response
- Describe expected vs actual behavior
- Provide code samples if possible

### Documentation Improvements

Found a typo or unclear explanation?
- Email: docs@bellaspa.com
- GitHub: https://github.com/bellaspa/api-docs

---

## Archived Versions

### End-of-Life (EOL) Versions

No versions have reached EOL yet.

When a version reaches EOL:
- It will be listed here with sunset date
- Final migration guide will be provided
- Support will be discontinued

---

## Related Documentation

- [Getting Started](./GETTING_STARTED.md)
- [API Reference](./API_REFERENCE.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Webhooks](./WEBHOOKS.md)
- [Error Handling](./ERROR_HANDLING.md)

---

**Last Updated**: 2026-06-18  
**Current Version**: v1.0.0  
**Next Scheduled Release**: v1.1.0 (September 2026)
