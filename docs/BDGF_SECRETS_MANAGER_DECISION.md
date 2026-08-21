# BDGF SECRETS MANAGER DECISION
**Date:** August 20, 2026 (Day 1)  
**Stream:** A - BDGF Productionization  
**Status:** Decision Required

---

## CONTEXT

**Current State:**
- `GATE_SIGNING_KEY` stored in `.env` file (plaintext)
- Development-only key: `dev_signing_key_DO_NOT_USE_IN_PRODUCTION_CHANGE_THIS_VALUE`
- No rotation mechanism
- No audit trail
- Manual distribution
- High security risk

**Problem:**
- Production deployment requires secure key management
- BDGF governance layer depends on signing key integrity
- Current approach is NOT production-grade

**Decision Needed:** Which secrets manager to use for production?

---

## REQUIREMENTS

### Functional Requirements
1. **Secure Storage:** Encryption at rest and in transit
2. **Access Control:** IAM-based permissions
3. **Audit Trail:** All access logged
4. **Key Rotation:** Support for rotation with zero downtime
5. **High Availability:** 99.9%+ uptime SLA
6. **API Access:** Programmatic retrieval for Node.js applications

### Non-Functional Requirements
1. **Cost:** Within budget constraints
2. **Integration:** Easy integration with existing stack (Supabase on AWS)
3. **Maintenance:** Low operational overhead
4. **Documentation:** Good developer documentation
5. **Support:** Enterprise support available

---

## OPTIONS ANALYSIS

### Option 1: AWS Secrets Manager

**Pros:**
- ✅ Native integration with AWS (likely hosting environment for Supabase)
- ✅ Automatic rotation support
- ✅ Pay-per-use pricing ($0.40/secret/month + $0.05/10k API calls)
- ✅ High availability (99.99% SLA)
- ✅ Full audit via CloudTrail
- ✅ IAM integration
- ✅ Excellent Node.js SDK (`@aws-sdk/client-secrets-manager`)
- ✅ Cross-region replication
- ✅ Versioning support

**Cons:**
- ❌ AWS vendor lock-in
- ❌ Requires AWS account and credentials
- ❌ Cost increases with API calls

**Cost Estimate:**
```
Secrets: 5 secrets × $0.40 = $2/month
API calls: ~50k/month × $0.05/10k = $0.25/month
Total: ~$2.25/month
```

**Integration Complexity:** LOW
```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const command = new GetSecretValueCommand({ SecretId: 'bdgf/gate-signing-key' });
const response = await client.send(command);
return response.SecretString;
```

**Recommendation Score:** ⭐⭐⭐⭐⭐ (5/5)

---

### Option 2: HashiCorp Vault

**Pros:**
- ✅ Provider-agnostic (no vendor lock-in)
- ✅ Advanced features (dynamic secrets, secret leasing, revocation)
- ✅ Open-source option available
- ✅ Strong audit trail
- ✅ Multi-cloud support
- ✅ Active community

**Cons:**
- ❌ Self-hosted requires infrastructure management
- ❌ Cloud version (HCP Vault) adds cost
- ❌ More complex setup and operations
- ❌ Requires Vault cluster for HA
- ❌ Steeper learning curve

**Cost Estimate:**
```
HCP Vault (Cloud):
- Starter: $0.03/hour = ~$22/month
- Standard: $0.14/hour = ~$101/month

Self-Hosted:
- Infrastructure cost (EC2/Fargate)
- Operational overhead
```

**Integration Complexity:** MEDIUM-HIGH
```javascript
import vault from 'node-vault';

const client = vault({
  endpoint: 'https://vault.example.com',
  token: process.env.VAULT_TOKEN
});
const result = await client.read('secret/data/bdgf/gate-signing-key');
return result.data.data.value;
```

**Recommendation Score:** ⭐⭐⭐ (3/5)  
*Good if multi-cloud strategy or avoiding AWS lock-in is critical*

---

### Option 3: Azure Key Vault

**Pros:**
- ✅ Strong security features
- ✅ Good audit trail
- ✅ HSM-backed options
- ✅ Good Node.js SDK
- ✅ Competitive pricing

**Cons:**
- ❌ Requires Azure subscription
- ❌ Not aligned with current stack (Supabase likely on AWS)
- ❌ Cross-cloud complexity

**Cost Estimate:**
```
Standard: $0.03/10k operations
Secrets: 5 secrets (free tier covers this)
Total: ~$1/month
```

**Integration Complexity:** MEDIUM

**Recommendation Score:** ⭐⭐ (2/5)  
*Only if already on Azure*

---

### Option 4: Google Secret Manager

**Pros:**
- ✅ Good integration with GCP
- ✅ Simple API
- ✅ Competitive pricing

**Cons:**
- ❌ Requires GCP account
- ❌ Not aligned with current stack
- ❌ Cross-cloud complexity

**Cost Estimate:**
```
Active secrets: $0.06/secret/month
Access operations: $0.03/10k
Total: ~$1/month
```

**Integration Complexity:** MEDIUM

**Recommendation Score:** ⭐⭐ (2/5)  
*Only if already on GCP*

---

## DECISION MATRIX

| Criteria | AWS Secrets Manager | HashiCorp Vault | Azure Key Vault | Google Secret Manager |
|----------|-------------------|----------------|----------------|---------------------|
| **Cost** | ⭐⭐⭐⭐⭐ ($2/mo) | ⭐⭐⭐ ($22+/mo) | ⭐⭐⭐⭐⭐ ($1/mo) | ⭐⭐⭐⭐⭐ ($1/mo) |
| **Integration** | ⭐⭐⭐⭐⭐ (Native) | ⭐⭐⭐ (Extra setup) | ⭐⭐ (Cross-cloud) | ⭐⭐ (Cross-cloud) |
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Audit Trail** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Rotation** | ⭐⭐⭐⭐⭐ (Auto) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **HA/SLA** | ⭐⭐⭐⭐⭐ (99.99%) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Ops Overhead** | ⭐⭐⭐⭐⭐ (Managed) | ⭐⭐ (Self-host) / ⭐⭐⭐⭐ (HCP) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Documentation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Vendor Lock-in** | ⭐⭐ (AWS only) | ⭐⭐⭐⭐⭐ (Agnostic) | ⭐⭐ (Azure only) | ⭐⭐ (GCP only) |
| **TOTAL** | **44/45** | **36/45** | **36/45** | **36/45** |

---

## RECOMMENDATION

### 🎯 PRIMARY RECOMMENDATION: AWS Secrets Manager

**Rationale:**
1. **Stack Alignment:** Supabase runs on AWS infrastructure
2. **Lowest Friction:** Native integration, minimal setup
3. **Cost Effective:** $2-3/month for MVP scale
4. **Production Ready:** Managed service, 99.99% SLA
5. **Developer Experience:** Excellent SDK, documentation, examples
6. **Automatic Rotation:** Built-in support with Lambda

**Risk Mitigation for Vendor Lock-in:**
- Abstraction layer in code (interface, not direct SDK calls)
- Can migrate to Vault later if multi-cloud strategy emerges
- Lock-in risk is LOW given Bella is already on Supabase (AWS-hosted)

### 🔄 FALLBACK: HashiCorp Vault (HCP Cloud)

**If:**
- Multi-cloud strategy is confirmed
- AWS lock-in is unacceptable
- Advanced secret management features needed (dynamic secrets, secret leasing)

**Note:** Adds ~10x cost and 3x integration complexity

---

## IMPLEMENTATION PLAN (AWS Secrets Manager)

### Phase 1: Setup (Day 1-2)

**Tasks:**
1. Provision AWS Secrets Manager in appropriate region
2. Create IAM policy for application access:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": "arn:aws:secretsmanager:*:*:secret:bdgf/*"
  }]
}
```
3. Install SDK: `npm install @aws-sdk/client-secrets-manager`
4. Create secret: `bdgf/gate-signing-key`
5. Migrate current key value (or generate new production key)

### Phase 2: Code Integration (Day 2-3)

**Files to Create:**
- `scripts/bdgf/get-signing-key.mjs` — Secret retrieval wrapper
- `scripts/bdgf/rotate-signing-key.mjs` — Rotation script

**Files to Update:**
- `scripts/bdgf/gate-token.mjs` — Use `getSigningKey()` instead of `process.env.GATE_SIGNING_KEY`
- `scripts/bdgf/migration-executor.mjs` — Use `getSigningKey()` for validation

### Phase 3: Testing (Day 3-4)

**Test Suite:**
- R4.3.2 tests (17 tests) with secrets manager
- R4.3.3 tests (28 tests) with secrets manager
- R4.4.4 tests (9 tests) with secrets manager
- Target: 119+ tests PASS

### Phase 4: Dual-Key Rotation Design (Day 4-5)

**Concept:**
```
During rotation window:
- Issuer uses NEW key
- Validator accepts OLD + NEW keys (7-day window)
- After 7 days, OLD key removed
```

### Phase 5: Documentation (Day 5)

**Deliverables:**
- Secret management procedures
- Rotation procedures
- Emergency recovery procedures
- Rollback procedures

---

## SECURITY CONSIDERATIONS

### Access Control
- **Principle of Least Privilege:** Only application service account has access
- **No Human Access:** Developers do NOT have direct secret access in production
- **Audit:** All access logged to CloudTrail

### Key Lifecycle
- **Generation:** Cryptographically secure random generation
- **Storage:** AES-256 encryption at rest
- **Transit:** TLS 1.2+ for API calls
- **Rotation:** Quarterly rotation schedule
- **Revocation:** Immediate revocation capability

### Emergency Procedures
- **Key Compromise:** Emergency rotation procedure (< 1 hour)
- **Access Breach:** Revoke compromised credentials immediately
- **Disaster Recovery:** Cross-region secret replication

---

## COST-BENEFIT ANALYSIS

### Current State (Free but Risky)
- Cost: $0/month
- Risk: HIGH (plaintext in .env, no rotation, no audit)
- Compliance: FAIL (not production-grade)

### AWS Secrets Manager (Small Cost, High Security)
- Cost: $2-3/month
- Risk: LOW (encrypted, rotatable, auditable)
- Compliance: PASS (production-grade)

**ROI:** $2/month to eliminate HIGH security risk = obvious win

---

## DECISION

**Approved:** AWS Secrets Manager  
**Approved By:** [Pending]  
**Date:** August 20, 2026  
**Implementation Start:** Day 2 (August 21, 2026)

---

## NEXT STEPS

**Today (Day 1):**
- [ ] Get architect approval on this decision
- [ ] Confirm AWS account access
- [ ] Confirm IAM permissions available

**Tomorrow (Day 2):**
- [ ] Provision AWS Secrets Manager
- [ ] Create `bdgf/gate-signing-key` secret
- [ ] Implement `get-signing-key.mjs`
- [ ] Begin code integration

---

**Prepared By:** Stream A Team  
**Status:** Awaiting Approval  
**Priority:** 🔴 HIGHEST (blocks productionization)

---
