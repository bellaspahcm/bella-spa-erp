# ADR-015: AI-Native Review System

**Status:** APPROVED  
**Date:** 2026-08-02  
**Decision Makers:** Chief Architect, AI/ML Lead, Product Lead  
**Consulted:** Security Team, Legal, Ethics Committee  
**Informed:** All Engineering Teams

---

## Context

Bella AI Platform processes hundreds of critical business decisions daily:
- **Partner Registration:** Approve or reject partner applications
- **Expense Approval:** Validate expense claims
- **Salary Audit:** Detect discrepancies in salary calculations
- **Booking Validation:** Prevent duplicate or fraudulent bookings
- **Document Verification:** Check identity documents for authenticity

**Current State:**
- ✅ Some AI features exist (salary reconciliation, fraud detection)
- ❌ AI is bolted on, not built in
- ❌ No unified AI decision support layer
- ❌ No explainability or audit trail
- ❌ Human-in-the-loop inconsistent

**Question:** How do we make AI a first-class citizen in Bella AI Platform?

---

## Decision

We will adopt an **AI-Native Architecture** where AI is a **decision support layer** (not a feature) with mandatory:
1. **Human-in-the-Loop** - AI recommends, humans decide
2. **Explainability** - Every AI recommendation must be explained
3. **Auditability** - All AI decisions logged
4. **Feedback Loop** - AI learns from human corrections

---

## Architecture

### AI Decision Flow

```
Business Event (e.g., Registration Submitted)
        ↓
┌─────────────────────────────────────┐
│   AI Review Engine                  │
├─────────────────────────────────────┤
│  1. Feature Extraction              │
│  2. Model Inference                 │
│  3. Risk Scoring                    │
│  4. Recommendation Generation       │
│  5. Explainability (Why?)           │
└─────────────────────────────────────┘
        ↓
AI Recommendation
  - Fraud Score: 0.15 (low)
  - Risk Score: 0.73 (medium)
  - Recommendation: REQUEST_MORE_INFO
  - Reasoning: [...]
        ↓
Human Review
  - Admin sees AI recommendation
  - Admin makes final decision
  - Admin provides justification (if override)
        ↓
Human Decision
  - Approved / Rejected / Request Info
        ↓
Feedback Loop
  - Log: AI recommended X, Human decided Y
  - Retrain model with new data
```

---

## AI Review Types

### 1. Registration Review

**Purpose:** Validate partner/employee/customer registrations

**Input Features:**
- Email domain reputation
- Phone number country code
- IP address geolocation
- Document quality score
- Application completeness
- Submission time (business hours vs midnight)
- Previous rejection count

**Output:**
```typescript
{
  fraudScore: 0.15,        // 0-1 (higher = more fraudulent)
  riskScore: 0.73,         // 0-1 (higher = more risky)
  documentQuality: 0.92,   // 0-1 (higher = better quality)
  recommendation: 'REQUEST_MORE_INFO', // AUTO_APPROVE, REQUEST_MORE_INFO, MANUAL_REVIEW, AUTO_REJECT
  reasoning: [
    'Email domain has low reputation score (0.3)',
    'Phone number associated with 3 other accounts',
    'Document quality is excellent (0.92)',
    'Submitted during business hours (trusted)'
  ],
  confidence: 0.85         // How confident is the AI? (0-1)
}
```

---

### 2. Expense Validation

**Purpose:** Detect invalid or fraudulent expense claims

**Input Features:**
- Expense amount
- Expense category
- Receipt authenticity score
- Historical average for category
- Submission frequency
- Approver relationship (manager vs peer)

**Output:**
```typescript
{
  validationScore: 0.88,   // Likely valid
  anomalyScore: 0.12,      // Low anomaly
  recommendation: 'AUTO_APPROVE',
  reasoning: [
    'Amount within normal range for category',
    'Receipt appears authentic (OCR verified)',
    'Submitted by trusted employee (5 years tenure)',
    'No duplicate submissions detected'
  ]
}
```

---

### 3. Salary Reconciliation

**Purpose:** Detect discrepancies between AI-calculated and manually-entered salaries

**Input Features:**
- Actual working days
- Session count
- Commission structure
- KPI bonuses
- Violations
- Historical patterns

**Output:**
```typescript
{
  aiCalculated: 15_500_000,
  manualEntered: 16_000_000,
  discrepancy: 500_000,
  discrepancyReason: [
    'Manual entry includes VND 500K overtime bonus',
    'Overtime not tracked in AI system',
    'This is expected for this employee'
  ],
  recommendation: 'APPROVE_MANUAL',
  flagForReview: false
}
```

---

### 4. Document Authenticity

**Purpose:** Verify identity documents (CCCD, passport, business license)

**Input Features:**
- Image quality
- OCR text extraction
- Face matching (if photo ID)
- Security features (watermarks, holograms)
- Known fraud patterns

**Output:**
```typescript
{
  authenticityScore: 0.95,  // Highly authentic
  ocrConfidence: 0.98,      // OCR extraction quality
  faceMatchScore: 0.87,     // Face matches photo (if applicable)
  recommendation: 'AUTO_APPROVE',
  reasoning: [
    'Document has high resolution (2400x3200)',
    'OCR extracted all fields successfully',
    'No tampering detected',
    'Security features verified'
  ],
  extractedData: {
    idNumber: '001234567890',
    fullName: 'Nguyễn Văn A',
    dateOfBirth: '1990-01-01',
    address: '123 Đường ABC, Quận 1, TP.HCM'
  }
}
```

---

## Database Schema

### ai_reviews Table

```sql
CREATE TABLE ai_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- What was reviewed
  review_type TEXT NOT NULL, -- 'registration', 'expense', 'salary', 'document'
  subject_id UUID NOT NULL, -- ID of entity being reviewed
  subject_type TEXT NOT NULL, -- 'registration', 'expense', 'salary_record', 'document'
  
  -- AI Analysis
  model_version TEXT NOT NULL, -- 'fraud-detection-v2.1', 'document-ocr-v3.0'
  input_features JSONB NOT NULL, -- Features fed to model
  fraud_score NUMERIC(3,2), -- 0.00-1.00
  risk_score NUMERIC(3,2),
  quality_score NUMERIC(3,2),
  confidence NUMERIC(3,2), -- How confident is AI?
  
  -- Recommendation
  recommendation TEXT NOT NULL, -- 'AUTO_APPROVE', 'REQUEST_MORE_INFO', 'MANUAL_REVIEW', 'AUTO_REJECT'
  reasoning JSONB NOT NULL, -- Array of explanation strings
  
  -- Human Decision
  human_decision TEXT, -- 'approved', 'rejected', 'request_info'
  human_decision_by UUID REFERENCES identities(id),
  human_decision_at TIMESTAMPTZ,
  human_justification TEXT, -- Why did human override AI?
  
  -- Feedback
  ai_correct BOOLEAN, -- Did AI recommendation match human decision?
  feedback_notes TEXT, -- Human feedback for model improvement
  
  -- Metadata
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_reviews_subject ON ai_reviews(subject_type, subject_id);
CREATE INDEX idx_ai_reviews_type ON ai_reviews(review_type);
CREATE INDEX idx_ai_reviews_tenant ON ai_reviews(tenant_id);
CREATE INDEX idx_ai_reviews_created ON ai_reviews(created_at);
```

---

## Implementation

### AI Review Service

```typescript
export class AIReviewService {
  async reviewRegistration(registrationId: string): Promise<AIReviewResult> {
    // 1. Load registration
    const registration = await loadRegistration(registrationId);
    
    // 2. Extract features
    const features = await this.extractFeatures(registration);
    
    // 3. Call ML model
    const prediction = await this.callModel('fraud-detection-v2.1', features);
    
    // 4. Generate recommendation
    const recommendation = this.generateRecommendation(prediction);
    
    // 5. Generate explanation
    const reasoning = this.explainDecision(features, prediction);
    
    // 6. Store AI review
    const aiReview = await db.insert('ai_reviews').values({
      review_type: 'registration',
      subject_id: registrationId,
      subject_type: 'registration',
      model_version: 'fraud-detection-v2.1',
      input_features: features,
      fraud_score: prediction.fraudScore,
      risk_score: prediction.riskScore,
      confidence: prediction.confidence,
      recommendation,
      reasoning,
      tenant_id: registration.tenant_id
    }).returning();
    
    // 7. Publish event
    await eventBus.publish({
      eventType: 'AIReviewCompleted',
      aggregateId: registrationId,
      payload: {
        reviewId: aiReview.id,
        recommendation,
        fraudScore: prediction.fraudScore,
        riskScore: prediction.riskScore
      }
    });
    
    return {
      reviewId: aiReview.id,
      fraudScore: prediction.fraudScore,
      riskScore: prediction.riskScore,
      recommendation,
      reasoning,
      confidence: prediction.confidence
    };
  }
  
  private async extractFeatures(registration: Registration): Promise<Features> {
    return {
      emailDomainReputation: await getEmailReputation(registration.email),
      phoneNumberRiskScore: await getPhoneRiskScore(registration.phone),
      ipGeolocation: await getIPGeolocation(registration.ip_address),
      documentQuality: await assessDocumentQuality(registration.documents),
      applicationCompleteness: this.calculateCompleteness(registration),
      submissionTime: registration.submitted_at,
      previousRejectionCount: await countPreviousRejections(registration.email)
    };
  }
  
  private async callModel(modelVersion: string, features: Features): Promise<Prediction> {
    // Call OpenAI, Hugging Face, or custom model
    const response = await fetch(process.env.AI_MODEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: modelVersion,
        features
      })
    });
    
    return response.json();
  }
  
  private generateRecommendation(prediction: Prediction): Recommendation {
    const { fraudScore, riskScore, confidence } = prediction;
    
    // Auto-approve if low risk and high confidence
    if (fraudScore < 0.2 && riskScore < 0.3 && confidence > 0.9) {
      return 'AUTO_APPROVE';
    }
    
    // Auto-reject if high fraud and high confidence
    if (fraudScore > 0.8 && confidence > 0.9) {
      return 'AUTO_REJECT';
    }
    
    // Request more info if medium risk
    if (riskScore > 0.5 && riskScore < 0.8) {
      return 'REQUEST_MORE_INFO';
    }
    
    // Manual review for everything else
    return 'MANUAL_REVIEW';
  }
  
  private explainDecision(features: Features, prediction: Prediction): string[] {
    const reasons: string[] = [];
    
    if (features.emailDomainReputation < 0.5) {
      reasons.push(`Email domain has low reputation score (${features.emailDomainReputation.toFixed(2)})`);
    }
    
    if (features.previousRejectionCount > 0) {
      reasons.push(`Email associated with ${features.previousRejectionCount} previous rejected applications`);
    }
    
    if (features.documentQuality > 0.9) {
      reasons.push(`Document quality is excellent (${features.documentQuality.toFixed(2)})`);
    }
    
    if (features.applicationCompleteness === 1.0) {
      reasons.push('All required fields completed');
    }
    
    const hour = new Date(features.submissionTime).getHours();
    if (hour >= 9 && hour <= 17) {
      reasons.push('Submitted during business hours (trusted)');
    } else {
      reasons.push('Submitted outside business hours (flag for review)');
    }
    
    return reasons;
  }
}
```

---

### Human Override & Feedback Loop

```typescript
export async function submitHumanDecision(
  reviewId: string,
  decision: 'approved' | 'rejected' | 'request_info',
  justification: string,
  decidedBy: string
) {
  // 1. Load AI review
  const aiReview = await db.select('*').from('ai_reviews').where('id', reviewId).first();
  
  // 2. Update with human decision
  await db.update('ai_reviews').set({
    human_decision: decision,
    human_decision_by: decidedBy,
    human_decision_at: new Date(),
    human_justification: justification,
    ai_correct: aiReview.recommendation.toLowerCase() === decision
  }).where('id', reviewId);
  
  // 3. If AI was wrong, log for retraining
  if (aiReview.recommendation.toLowerCase() !== decision) {
    await logFeedback({
      reviewId,
      aiRecommendation: aiReview.recommendation,
      humanDecision: decision,
      justification,
      features: aiReview.input_features,
      shouldRetrain: true
    });
  }
  
  // 4. Publish event
  await eventBus.publish({
    eventType: 'HumanDecisionRecorded',
    aggregateId: aiReview.subject_id,
    payload: {
      reviewId,
      decision,
      aiWasCorrect: aiReview.recommendation.toLowerCase() === decision
    }
  });
}
```

---

## Model Training Pipeline

### 1. Data Collection

Collect human decisions and feedback:

```sql
SELECT
  ai_reviews.input_features,
  ai_reviews.recommendation AS ai_recommendation,
  ai_reviews.human_decision AS ground_truth,
  ai_reviews.human_justification,
  ai_reviews.ai_correct
FROM ai_reviews
WHERE human_decision IS NOT NULL
  AND created_at > NOW() - INTERVAL '90 days'
ORDER BY created_at DESC;
```

### 2. Model Retraining

Retrain model monthly with new human-labeled data:

```python
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

# Load training data
df = pd.read_sql("SELECT * FROM ai_reviews WHERE human_decision IS NOT NULL", conn)

# Prepare features
X = pd.json_normalize(df['input_features'])
y = df['human_decision'].map({'approved': 1, 'rejected': 0})

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Evaluate
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

y_pred = model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
print(f"Precision: {precision_score(y_test, y_pred)}")
print(f"Recall: {recall_score(y_test, y_pred)}")
print(f"F1 Score: {f1_score(y_test, y_pred)}")

# Deploy new model version
model.save('fraud-detection-v2.2.pkl')
```

### 3. A/B Testing

Test new model versions before full rollout:

```typescript
const modelVersion = await getModelVersion({
  tenantId,
  experimentGroup: 'control' // or 'treatment'
});

// control group: use v2.1
// treatment group: use v2.2

if (modelVersion === 'v2.2') {
  // Use new model
} else {
  // Use old model
}
```

---

## Explainability Techniques

### 1. SHAP (SHapley Additive exPlanations)

Show feature importance:

```python
import shap

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)

# Top 3 features contributing to fraud prediction
feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': abs(shap_values).mean(axis=0)
}).sort_values('importance', ascending=False).head(3)

# Output:
# 1. email_domain_reputation: -0.45 (low reputation increases fraud)
# 2. previous_rejection_count: +0.32 (more rejections increases fraud)
# 3. document_quality: -0.18 (high quality decreases fraud)
```

### 2. LIME (Local Interpretable Model-agnostic Explanations)

Explain individual predictions:

```python
from lime.lime_tabular import LimeTabularExplainer

explainer = LimeTabularExplainer(X_train, feature_names=X.columns, class_names=['legitimate', 'fraud'])

# Explain a single prediction
exp = explainer.explain_instance(X_test[0], model.predict_proba)

# Output:
# email_domain_reputation <= 0.5: +0.35 (fraud)
# previous_rejection_count > 0: +0.28 (fraud)
# document_quality >= 0.9: -0.22 (legitimate)
```

---

## Ethical & Legal Considerations

### 1. Bias Detection

Monitor AI decisions for demographic bias:

```sql
SELECT
  ai_reviews.recommendation,
  COUNT(*) AS total,
  AVG(CASE WHEN human_decision = 'approved' THEN 1.0 ELSE 0.0 END) AS approval_rate
FROM ai_reviews
JOIN identity_registrations ON ai_reviews.subject_id = identity_registrations.id
GROUP BY ai_reviews.recommendation, identity_registrations.metadata->>'gender'
ORDER BY approval_rate DESC;
```

**Alert if approval rate differs by >10% across protected attributes.**

---

### 2. Right to Explanation

Users can request explanation of AI decision:

```typescript
export async function explainAIDecision(reviewId: string) {
  const review = await db.select('*').from('ai_reviews').where('id', reviewId).first();
  
  return {
    decision: review.recommendation,
    confidence: review.confidence,
    reasoning: review.reasoning,
    features: review.input_features,
    modelVersion: review.model_version,
    appeal: 'You can appeal this decision by contacting support@bella.com'
  };
}
```

---

### 3. Human Appeal Process

Users can appeal AI decisions:

```typescript
export async function submitAppeal(reviewId: string, reason: string) {
  await db.insert('ai_appeals').values({
    review_id: reviewId,
    reason,
    status: 'pending',
    submitted_at: new Date()
  });
  
  // Notify admin team
  await sendNotification({
    to: 'admin-team',
    subject: 'New AI Decision Appeal',
    body: `User appealed AI decision ${reviewId}. Reason: ${reason}`
  });
}
```

---

## Monitoring & Observability

### Metrics

- **AI Accuracy:** % of AI recommendations that match human decisions
- **Override Rate:** % of times humans override AI
- **Fraud Detection Rate:** True positives / Total fraud cases
- **False Positive Rate:** False alarms / Total legitimate cases
- **Review Latency:** Time from event → AI review complete

### Dashboards

```
AI Review Performance (30 days)
├── Total Reviews: 1,500
├── AI Accuracy: 92%
├── Override Rate: 8%
│
├── Fraud Detection Rate: 95% ✅
├── False Positive Rate: 3% ✅
│
└── Breakdown by Type
    ├── Registration: 1,200 reviews (90% accuracy)
    ├── Expense: 200 reviews (95% accuracy)
    └── Salary: 100 reviews (98% accuracy)
```

### Alerts

- ⚠️ **AI Accuracy < 85%** (last 7 days)
- ⚠️ **Override Rate > 15%** (model may be underperforming)
- ⚠️ **False Positive Rate > 5%** (too many false alarms)
- ⚠️ **Bias detected** (approval rate differs by >10% across demographics)

---

## Benefits

✅ **Scalability** - AI handles routine cases, humans focus on edge cases  
✅ **Consistency** - AI applies same criteria to all cases  
✅ **Speed** - AI reviews in seconds vs minutes/hours for humans  
✅ **Learning** - AI improves over time with human feedback  
✅ **Auditability** - Every decision logged with explanation  
✅ **Transparency** - Explainable AI (not black box)  

---

## Trade-offs

⚠️ **Accuracy Not 100%** - AI will make mistakes (target 90%+ accuracy)  
⚠️ **Bias Risk** - AI can inherit biases from training data  
⚠️ **Cold Start** - New industries have no training data  
⚠️ **Maintenance** - Models need retraining and monitoring  

**Mitigation:**
- Human-in-the-loop always (AI recommends, human decides)
- Bias monitoring and mitigation
- Transfer learning from similar industries
- Dedicated ML engineer for model maintenance

---

## Related ADRs

- [ADR-001: Identity Platform](./ADR-001-identity-platform.md)
- [ADR-004: Event-Driven Architecture](./ADR-004-event-driven-architecture.md)
- [ADR-010: Domain Model](./ADR-010-domain-model.md)

---

## Approval

- [x] **Chief Architect:** Approved - 2026-08-02
- [x] **AI/ML Lead:** Approved - 2026-08-02
- [x] **Ethics Committee:** Approved - 2026-08-02

---

**Decision:** APPROVED  
**Effective Date:** 2026-08-02  
**Review Date:** 2026-11-02

---

**"AI is not a feature. AI is a layer. Humans always decide."**
