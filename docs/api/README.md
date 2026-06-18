# 📚 Bella API Gateway - Documentation

**Welcome to the Bella API Gateway documentation!**

This directory contains all the essential documentation you need to integrate with Bella's API.

---

## 🚀 Quick Start

### New to Bella API? Start here:

1. **📖 Read the Master Guide** (10-15 minutes)  
   → [`BELLA_API_GATEWAY_MASTER_GUIDE.md`](./BELLA_API_GATEWAY_MASTER_GUIDE.md)  
   **Complete overview** of the entire API Gateway system

2. **⚡ Make Your First API Call** (5 minutes)  
   → [`GETTING_STARTED.md`](./GETTING_STARTED.md)  
   Quick start guide with code examples (cURL, JavaScript, Python)

3. **📑 Explore API Endpoints** (Reference)  
   → [`API_REFERENCE.md`](./API_REFERENCE.md)  
   Complete endpoint documentation with examples

---

## 📂 Essential Documentation (Production-Ready)

### For Partners & External Developers

| File | Purpose | When to Read |
|------|---------|--------------|
| **[BELLA_API_GATEWAY_MASTER_GUIDE.md](./BELLA_API_GATEWAY_MASTER_GUIDE.md)** ⭐ | Complete API Gateway guide (8 sections) | **Start here** - Overview & architecture |
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Quick start guide | First API integration |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | Complete endpoint reference | Daily development reference |
| **[WEBHOOKS.md](./WEBHOOKS.md)** | Webhook setup & verification | Implementing real-time events |
| **[ERROR_HANDLING.md](./ERROR_HANDLING.md)** | Error codes & retry logic | Handling API errors |
| **[SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md)** | Security guidelines | Before production deployment |

### For Internal Team

| File | Purpose | Audience |
|------|---------|----------|
| **[ADMIN_UI_GUIDE.md](./ADMIN_UI_GUIDE.md)** | Admin panel documentation | Admins managing partners |
| **[bella-erp-phase3.postman_collection.json](./bella-erp-phase3.postman_collection.json)** | Postman test collection | Developers testing APIs |

---

## 🎯 Documentation by Use Case

### "I want to integrate my POS system"
1. Read: [BELLA_API_GATEWAY_MASTER_GUIDE.md](./BELLA_API_GATEWAY_MASTER_GUIDE.md) - Section 1.3 (Partner Types)
2. Read: [GETTING_STARTED.md](./GETTING_STARTED.md) - Section 4.1 (Registration)
3. Reference: [API_REFERENCE.md](./API_REFERENCE.md) - Orders & Products API

### "I want to process payments"
1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md)
2. Reference: [API_REFERENCE.md](./API_REFERENCE.md) - Payments API
3. Setup: [WEBHOOKS.md](./WEBHOOKS.md) - Payment events

### "I need to handle webhooks"
1. Read: [WEBHOOKS.md](./WEBHOOKS.md) - Complete webhook guide
2. Implement: Signature verification code examples
3. Test: Using [Postman collection](./bella-erp-phase3.postman_collection.json)

### "I'm getting API errors"
1. Check: [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error code reference
2. Implement: Retry logic examples
3. Contact: api-support@bellaspa.vn if issue persists

### "I'm deploying to production"
1. Review: [SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md)
2. Check: Rate limits in [MASTER_GUIDE](./BELLA_API_GATEWAY_MASTER_GUIDE.md) Section 2.4
3. Test: Full flow using [Postman collection](./bella-erp-phase3.postman_collection.json)

---

## 📊 Documentation Structure

```
docs/api/
├── 📄 BELLA_API_GATEWAY_MASTER_GUIDE.md    ⭐ START HERE (Complete Guide)
├── 📄 API_REFERENCE.md                     (Endpoint Details)
├── 📄 GETTING_STARTED.md                   (Quick Start)
├── 📄 WEBHOOKS.md                          (Webhook Setup)
├── 📄 ERROR_HANDLING.md                    (Error Codes)
├── 📄 SECURITY_BEST_PRACTICES.md           (Security)
├── 📄 ADMIN_UI_GUIDE.md                    (Admin Panel)
├── 📄 bella-erp-phase3.postman_collection.json (API Tests)
└── 📄 API_DOCUMENTATION_AUDIT.md           (Documentation audit report)
```

**Clean & focused documentation = Faster integration**

---

## 🔗 Additional Resources

### Web Resources
- **API Status**: https://status.bellaspa.vn
- **Changelog**: Check MASTER_GUIDE Section "Document History"
- **Community Forum**: https://forum.bellaspa.vn/api

### Support Channels
- **Technical Support**: api-support@bellaspa.vn (24h response)
- **Partnership Inquiries**: api-partners@bellaspa.vn
- **Security Issues**: security@bellaspa.vn (urgent)

### Testing & Development
- **Sandbox Environment**: Available with test API key
- **Postman Collection**: Import `bella-erp-phase3.postman_collection.json`
- **Sample Code**: See GETTING_STARTED.md

---

## 📝 Documentation Updates

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-06-18 | Consolidated from 20 files to 8 essential files |
| 1.0.0 | 2025-06-01 | Initial API documentation |

---

## ⚠️ Important Notes

1. **Always use HTTPS** in production
2. **Never commit API keys** to version control
3. **Rotate keys regularly** (30-90 days recommended)
4. **Monitor rate limits** to avoid service disruption
5. **Verify webhook signatures** for security

---

## 🗂️ Archived Documentation

Old/legacy documentation has been moved to:
- `docs/archive/api-docs-legacy/` - Phase 3 specific docs, test reports, pilot programs

These are kept for historical reference but are no longer maintained.

---

**Last Updated**: 2026-06-18  
**Maintained By**: Bella API Team  
**Questions?** → api-support@bellaspa.vn

---

**© 2026 Bella Spa ERP. All rights reserved.**

