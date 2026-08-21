# BDGF AWS Secrets Manager Setup Guide
**Date:** August 22, 2026 (Day 3)  
**Purpose:** Step-by-step guide for provisioning and configuring AWS Secrets Manager for BDGF production deployment  
**Status:** Ready for implementation

---

## Prerequisites

**Required Access:**
- [ ] AWS Account with Secrets Manager permissions
- [ ] IAM permissions to create policies and roles
- [ ] AWS CLI installed and configured
- [ ] Node.js environment for testing

**Required Information:**
- AWS Region (recommend: `us-east-1` - same as Supabase)
- AWS Account ID
- Application service account/role name

---

## Step 1: Generate Production Signing Key

**DO NOT use development key in production!**

### Generate Cryptographically Secure Key

```bash
# Generate 256-bit (32 bytes) random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output:
# 8f7d9e2a1b4c6f3d8a5e9c7b2f1a4d6e9c8b5a2f7d4e1c9b6a3f8d5e2c7b4a1f
```

**Save this key securely! You'll need it for the next step.**

**Security Requirements:**
- ✅ 256-bit minimum (32 bytes = 64 hex characters)
- ✅ Cryptographically random (use `crypto.randomBytes`)
- ❌ Never commit to git
- ❌ Never send via unsecured channels (email, Slack)
- ❌ Never reuse development keys

---

## Step 2: Create Secret in AWS Secrets Manager

### Option A: Using AWS Console (Recommended for First Time)

1. **Navigate to AWS Secrets Manager**
   - Open AWS Console
   - Go to: Services → Security, Identity, & Compliance → Secrets Manager
   - Select region: `us-east-1` (or your Supabase region)

2. **Create New Secret**
   - Click: "Store a new secret"
   - Secret type: "Other type of secret"
   - Key/value pairs:
     ```
     Key: key
     Value: [paste your generated key from Step 1]
     ```
   - Encryption key: Default AWS managed key (`aws/secretsmanager`)
   - Click: "Next"

3. **Configure Secret**
   - Secret name: `bdgf/gate-signing-key`
   - Description: "BDGF Gate Token signing key for production environment"
   - Tags (optional):
     ```
     Environment: production
     Application: bella-erp
     Component: bdgf
     ManagedBy: platform-team
     ```
   - Click: "Next"

4. **Configure Rotation (Optional for MVP)**
   - For MVP: "Disable automatic rotation" (we'll use manual rotation script)
   - For Production: Configure automatic rotation (30-90 days)
   - Click: "Next"

5. **Review and Store**
   - Review all settings
   - Click: "Store"
   - **Copy the ARN** (you'll need it for IAM policy)
   - Example ARN: `arn:aws:secretsmanager:us-east-1:123456789012:secret:bdgf/gate-signing-key-AbCdEf`

### Option B: Using AWS CLI

```bash
# Set variables
AWS_REGION="us-east-1"
SECRET_NAME="bdgf/gate-signing-key"
SECRET_VALUE="<your-generated-key-from-step-1>"

# Create secret
aws secretsmanager create-secret \
  --name "$SECRET_NAME" \
  --description "BDGF Gate Token signing key for production" \
  --secret-string "$SECRET_VALUE" \
  --region "$AWS_REGION" \
  --tags Key=Environment,Value=production Key=Application,Value=bella-erp Key=Component,Value=bdgf

# Verify creation
aws secretsmanager describe-secret \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION"
```

**Output:**
```json
{
  "ARN": "arn:aws:secretsmanager:us-east-1:123456789012:secret:bdgf/gate-signing-key-AbCdEf",
  "Name": "bdgf/gate-signing-key",
  "Description": "BDGF Gate Token signing key for production",
  "LastChangedDate": "2026-08-22T10:30:00.000Z",
  "VersionIdsToStages": {
    "abc123": ["AWSCURRENT"]
  }
}
```

**Save the ARN for Step 3!**

---

## Step 3: Create IAM Policy for Application Access

### Create IAM Policy

**Policy Name:** `BellaERPBDGFSecretsReadOnly`

**Policy JSON:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBDGFSecretRead",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:bdgf/*"
    },
    {
      "Sid": "AllowListSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:ResourceTag/Component": "bdgf"
        }
      }
    }
  ]
}
```

**Replace:** `123456789012` with your AWS Account ID

### Using AWS Console:

1. Go to: IAM → Policies → Create policy
2. Select: JSON tab
3. Paste policy JSON above
4. Click: Next
5. Policy name: `BellaERPBDGFSecretsReadOnly`
6. Description: "Read-only access to BDGF secrets in Secrets Manager"
7. Click: Create policy

### Using AWS CLI:

```bash
# Save policy to file
cat > bdgf-secrets-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBDGFSecretRead",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:bdgf/*"
    },
    {
      "Sid": "AllowListSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:ResourceTag/Component": "bdgf"
        }
      }
    }
  ]
}
EOF

# Create policy
aws iam create-policy \
  --policy-name BellaERPBDGFSecretsReadOnly \
  --policy-document file://bdgf-secrets-policy.json \
  --description "Read-only access to BDGF secrets"
```

---

## Step 4: Attach Policy to Application Role/User

### Option A: EC2 Instance Role (Recommended for EC2/ECS)

```bash
# Attach policy to existing role
aws iam attach-role-policy \
  --role-name BellaERPApplicationRole \
  --policy-arn arn:aws:iam::123456789012:policy/BellaERPBDGFSecretsReadOnly
```

### Option B: IAM User (For development/testing)

```bash
# Attach policy to user
aws iam attach-user-policy \
  --user-name bella-erp-app-user \
  --policy-arn arn:aws:iam::123456789012:policy/BellaERPBDGFSecretsReadOnly

# Create access key
aws iam create-access-key --user-name bella-erp-app-user
```

**Output:**
```json
{
  "AccessKey": {
    "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "Status": "Active"
  }
}
```

**Save credentials securely!**

---

## Step 5: Install AWS SDK in Application

```bash
cd /path/to/bella-erp
npm install @aws-sdk/client-secrets-manager
```

**Verify installation:**
```bash
npm list @aws-sdk/client-secrets-manager
```

---

## Step 6: Configure Application Environment

### Set Environment Variables

**For EC2/ECS (using instance role):**
```bash
# .env.production (or environment config)
BDGF_USE_SECRETS_MANAGER=true
AWS_REGION=us-east-1
AWS_SECRET_ID=bdgf/gate-signing-key
SECRETS_CACHE_ENABLED=true
SECRETS_CACHE_TTL=300
```

**For local development with IAM user:**
```bash
# .env.production
BDGF_USE_SECRETS_MANAGER=true
AWS_REGION=us-east-1
AWS_SECRET_ID=bdgf/gate-signing-key
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Security Note:** Never commit `.env.production` to git!

---

## Step 7: Test Secret Retrieval

### Test Script

Create `scripts/bdgf/test-secrets-manager.mjs`:

```javascript
#!/usr/bin/env node
import { getSigningKey, healthCheck } from './get-signing-key.mjs';

async function testSecretsManager() {
  console.log('🔐 Testing AWS Secrets Manager Integration...\n');
  
  try {
    // Health check
    console.log('1. Running health check...');
    const health = await healthCheck();
    console.log('   Backend:', health.backend);
    console.log('   Healthy:', health.healthy);
    console.log('   Checks:', JSON.stringify(health.checks, null, 2));
    
    if (!health.healthy) {
      console.error('\n❌ Health check failed!');
      process.exit(1);
    }
    
    console.log('\n2. Retrieving signing key...');
    const key = await getSigningKey();
    console.log('   Key retrieved:', key ? `${key.substring(0, 16)}...` : 'null');
    console.log('   Key length:', key?.length || 0, 'characters');
    
    if (!key || key.length < 32) {
      console.error('\n❌ Invalid key format!');
      process.exit(1);
    }
    
    console.log('\n3. Testing cache...');
    const key2 = await getSigningKey();
    console.log('   Cached key:', key2 ? `${key2.substring(0, 16)}...` : 'null');
    console.log('   Keys match:', key === key2);
    
    console.log('\n✅ AWS Secrets Manager integration test PASSED!');
    console.log('\nNext steps:');
    console.log('  1. Run BDGF test suite: npm run test:bdgf');
    console.log('  2. Deploy to staging environment');
    console.log('  3. Verify production deployment');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testSecretsManager();
```

### Run Test

```bash
# Set environment for test
export BDGF_USE_SECRETS_MANAGER=true
export AWS_REGION=us-east-1
export AWS_SECRET_ID=bdgf/gate-signing-key

# Run test
node scripts/bdgf/test-secrets-manager.mjs
```

**Expected Output:**
```
🔐 Testing AWS Secrets Manager Integration...

1. Running health check...
   Backend: aws
   Healthy: true
   Checks: {
     "backend_configured": true,
     "key_retrievable": true,
     "key_valid_format": true,
     "key_sufficient_length": true,
     "secrets_manager_reachable": true
   }

2. Retrieving signing key...
   Key retrieved: 8f7d9e2a1b4c6f3d...
   Key length: 64 characters

3. Testing cache...
   Cached key: 8f7d9e2a1b4c6f3d...
   Keys match: true

✅ AWS Secrets Manager integration test PASSED!

Next steps:
  1. Run BDGF test suite: npm run test:bdgf
  2. Deploy to staging environment
  3. Verify production deployment
```

---

## Step 8: Run BDGF Test Suite with Secrets Manager

```bash
# Ensure environment configured
export BDGF_USE_SECRETS_MANAGER=true
export AWS_REGION=us-east-1
export AWS_SECRET_ID=bdgf/gate-signing-key

# Run full BDGF test suite
node scripts/bdgf/r4-3-2-gate-token-test.mjs
node scripts/bdgf/r4-3-3-positive-e2e-test.mjs
node scripts/bdgf/r4-3-3-bypass-test.mjs
node scripts/bdgf/r4-4-4-adversarial-test.mjs
node scripts/bdgf/r4-4-2-e2e-recovery-test.mjs
```

**Target:** All 45+ tests PASS with secrets manager

---

## Step 9: Deploy to Production

### Pre-Deployment Checklist

- [ ] Secret created in AWS Secrets Manager
- [ ] IAM policy created and attached
- [ ] Application environment configured
- [ ] Test script passed
- [ ] BDGF test suite passed (45+ tests)
- [ ] Secrets manager health check passed
- [ ] Cache working (5-minute TTL)
- [ ] Monitoring configured (CloudWatch)
- [ ] Backup of old .env key (for rollback)

### Deployment Steps

1. **Update application configuration:**
   ```bash
   # Production environment config
   BDGF_USE_SECRETS_MANAGER=true
   AWS_REGION=us-east-1
   AWS_SECRET_ID=bdgf/gate-signing-key
   SECRETS_CACHE_ENABLED=true
   SECRETS_CACHE_TTL=300
   ```

2. **Remove `.env` key (or comment out):**
   ```bash
   # .env (keep for emergency fallback)
   # GATE_SIGNING_KEY=dev_signing_key_DO_NOT_USE_IN_PRODUCTION_CHANGE_THIS_VALUE
   ```

3. **Deploy application:**
   ```bash
   # Your deployment process
   npm run build
   npm run deploy:production
   ```

4. **Verify deployment:**
   ```bash
   # Check application logs
   # Verify signing key retrieved from Secrets Manager
   # Run smoke tests
   ```

---

## Step 10: Verify Production Deployment

### Health Check

```bash
curl https://api.bella-erp.com/health/bdgf
```

**Expected Response:**
```json
{
  "status": "healthy",
  "secrets_manager": {
    "backend": "aws",
    "healthy": true,
    "cache_enabled": true
  },
  "bdgf": {
    "gate_token": "operational",
    "signing_key": "configured"
  }
}
```

### Test Gate Token Issuance

```bash
# Issue test token (requires authorization)
curl -X POST https://api.bella-erp.com/api/bdgf/token \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "approval_id": "test-approval-123",
    "migration_id": "test-migration",
    "migration_hash": "abc123...",
    "target_environment": "staging"
  }'
```

**Expected:** Token issued successfully with signature from AWS Secrets Manager key

---

## Troubleshooting

### Issue: "Secret not found"

**Symptoms:**
```
Error: Secrets manager retrieval failed: ResourceNotFoundException
```

**Solutions:**
1. Verify secret name: `bdgf/gate-signing-key`
2. Verify AWS region matches Secrets Manager region
3. Check IAM permissions

### Issue: "Access Denied"

**Symptoms:**
```
Error: AccessDeniedException: User is not authorized to perform: secretsmanager:GetSecretValue
```

**Solutions:**
1. Verify IAM policy attached to role/user
2. Check policy ARN matches secret ARN
3. Verify AWS credentials configured

### Issue: "Invalid credentials"

**Symptoms:**
```
Error: Missing credentials in config
```

**Solutions:**
1. For EC2: Verify instance role attached
2. For IAM user: Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY set
3. Check AWS CLI configuration: `aws configure list`

### Issue: "Key too short"

**Symptoms:**
```
Error: Invalid signing key: must be at least 32 characters
```

**Solutions:**
1. Regenerate key with `crypto.randomBytes(32)`
2. Update secret in Secrets Manager
3. Clear application cache

---

## Security Best Practices

### DO ✅

- ✅ Use cryptographically random keys (256-bit minimum)
- ✅ Rotate keys quarterly (or when compromised)
- ✅ Use IAM roles (not IAM users) in production
- ✅ Enable CloudTrail for secret access auditing
- ✅ Use principle of least privilege (read-only access)
- ✅ Enable caching (reduce Secrets Manager API calls)
- ✅ Monitor secret access (CloudWatch alarms)
- ✅ Test secret retrieval before production deployment

### DON'T ❌

- ❌ Never commit secrets to git
- ❌ Never send secrets via unsecured channels
- ❌ Never reuse development keys in production
- ❌ Never grant `secretsmanager:*` permissions
- ❌ Never disable encryption
- ❌ Never share IAM credentials
- ❌ Never skip testing after key rotation

---

## Cost Estimation

**AWS Secrets Manager Pricing:**
- Secret storage: $0.40/secret/month
- API calls: $0.05 per 10,000 calls

**Estimated Monthly Cost:**
```
Secrets: 5 secrets × $0.40 = $2.00/month
API calls: ~50,000/month × $0.05/10k = $0.25/month
Total: $2.25/month
```

**With caching (5-minute TTL):**
- Reduces API calls by 90%+
- Estimated cost: **~$2/month**

---

## Next Steps

After successful setup:

1. ✅ **Document rotation procedures** (see Day 3 Task #2)
2. ✅ **Create emergency procedures** (see Day 3 Task #3)
3. ✅ **Set up monitoring** (CloudWatch alarms for secret access)
4. ✅ **Schedule first rotation** (30-90 days)
5. ✅ **Update runbooks** (include secrets manager procedures)

---

## References

- AWS Secrets Manager Documentation: https://docs.aws.amazon.com/secretsmanager/
- AWS SDK for JavaScript v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/
- BDGF Secrets Manager Decision: `docs/BDGF_SECRETS_MANAGER_DECISION.md`
- Get Signing Key Implementation: `scripts/bdgf/get-signing-key.mjs`

---

**Prepared By:** Stream A Team  
**Date:** August 22, 2026 — Day 3  
**Status:** Ready for Implementation  
**Next:** Key rotation procedures

---
