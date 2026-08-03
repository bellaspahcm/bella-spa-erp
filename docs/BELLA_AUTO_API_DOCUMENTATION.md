# Bella Auto - API Documentation

**Version:** 1.0.0  
**Last Updated:** August 3, 2026  
**Base URL:** `/api/bella-auto/*`

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Service Classes](#service-classes)
4. [RPC Functions](#rpc-functions)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

---

## Overview

Bella Auto API provides comprehensive access to automotive ERP functionality including:
- Vehicle inventory management
- Customer journey tracking
- Sales & lead management
- Service center operations
- Trade-in appraisals
- Financial operations
- AI insights & analytics
- Mobile workforce management

**Architecture:** Service-oriented with RPC functions for complex queries  
**Database:** PostgreSQL with Row-Level Security (RLS)  
**Authentication:** Supabase Auth with tenant isolation

---

## Authentication

All API calls require authentication via Supabase session token.

```typescript
import { getPrimaryClient } from '@/lib/database/read-replica';

const supabase = getPrimaryClient();
// Automatically uses current session token
```

**Tenant Isolation:**
All queries automatically filtered by `tenant_id` via RLS policies.

---

## Service Classes

### Phase 1 - VIN Management

#### VehicleManagementService

**Create Vehicle**
```typescript
import { VehicleManagementService } from '@/modules/bella-auto/services/VehicleManagementService';

const vehicle = await VehicleManagementService.create({
  tenantId: 'bella_auto_demo',
  vin: '1HGCM82633A123456',
  make: 'Honda',
  model: 'Accord',
  year: 2023,
  color: 'Pearl White',
  purchasePrice: 800000000,
  createdBy: 'user-id'
});
```

**Get Vehicle by VIN**
```typescript
const vehicle = await VehicleManagementService.getByVIN(
  '1HGCM82633A123456',
  'bella_auto_demo'
);
```

**Update Vehicle Status**
```typescript
const updated = await VehicleManagementService.updateStatus(
  'vehicle-id',
  'bella_auto_demo',
  'showroom', // New status
  'user-id'
);
```

**Available Status Values:**
- `in_transit` - Vehicle en route to warehouse
- `warehouse` - In warehouse storage
- `showroom` - On showroom display
- `allocated` - Reserved for customer
- `sold` - Sale completed
- `delivered` - Delivered to customer
- `scrapped` - End of lifecycle

---

#### VehicleStatusMachineService

**Transition Status**
```typescript
import { VehicleStatusMachineService } from '@/modules/bella-auto/services/VehicleStatusMachineService';

const result = await VehicleStatusMachineService.transition(
  'vehicle-id',
  'bella_auto_demo',
  'warehouse',  // Current status
  'showroom',   // Target status
  'user-id',
  'Vehicle ready for display'
);
```

**Validate Transition**
```typescript
const isValid = VehicleStatusMachineService.canTransition(
  'warehouse',
  'showroom'
);
// Returns: true
```

---

### Phase 3 - Customer Journey

#### CustomerJourneyService

**Initialize Journey**
```typescript
import { CustomerJourneyService } from '@/modules/bella-auto/services/CustomerJourneyService';

const journey = await CustomerJourneyService.initializeJourney({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  leadSource: 'facebook_ads',
  initialStageCode: 'awareness',
  assignedTo: 'sales-user-id',
  createdBy: 'admin-id'
});
```

**Advance to Next Stage**
```typescript
const updated = await CustomerJourneyService.advanceStage(
  'journey-id',
  'bella_auto_demo',
  'test_drive',  // Target stage
  'sales-user-id',
  'Customer completed test drive',
  { vehicle_id: 'vehicle-id', feedback: 'positive' }
);
```

**Get Customer Journey**
```typescript
const journey = await CustomerJourneyService.getByCustomer(
  'customer-id',
  'bella_auto_demo'
);
```

**22 Journey Stages:**
1. `awareness` - Initial brand awareness
2. `consideration` - Researching options
3. `first_contact` - Initial inquiry
4. `lead_qualification` - Lead scoring
5. `showroom_visit` - First visit
6. `test_drive` - Test drive completed
7. `quotation` - Quote provided
8. `negotiation` - Price discussion
9. `deposit` - Deposit received
10. `financing` - Loan application
11. `insurance` - Insurance setup
12. `delivery_scheduled` - Delivery date set
13. `vehicle_delivered` - Vehicle handed over
14. `first_service` - First service visit
15. `regular_service` - Ongoing maintenance
16. `warranty_claim` - Warranty issues
17. `upsell_opportunity` - Accessory sales
18. `referral` - Customer referral made
19. `trade_in_inquiry` - Trade-in interest
20. `trade_in_completed` - Trade-in done
21. `repeat_purchase` - Second vehicle
22. `churned` - Customer lost

---

#### JourneySLAMonitorService

**Check SLA Status**
```typescript
import { JourneySLAMonitorService } from '@/modules/bella-auto/services/JourneySLAMonitorService';

const breached = await JourneySLAMonitorService.checkBreachedJourneys(
  'bella_auto_demo'
);
// Returns array of journeys exceeding SLA
```

**Auto-Escalate**
```typescript
const escalatedCount = await JourneySLAMonitorService.autoEscalate(
  'bella_auto_demo',
  'manager-user-id'
);
```

---

### Phase 4 - Sales & Lead

#### LeadRotationService

**Assign Lead**
```typescript
import { LeadRotationService } from '@/modules/bella-auto/services/LeadRotationService';

const assignment = await LeadRotationService.assignLead({
  tenantId: 'bella_auto_demo',
  leadId: 'lead-id',
  allocationMethod: 'smart', // or 'round_robin'
  assignedBy: 'admin-id'
});
```

**Get Next Available Sales**
```typescript
const nextSales = await LeadRotationService.getNextAvailableSales(
  'bella_auto_demo',
  'smart' // allocation method
);
```

---

#### AutoSalesProvider

**Create Booking**
```typescript
import { AutoSalesProvider } from '@/modules/bella-auto/providers/AutoSalesProvider';

const booking = await AutoSalesProvider.createBooking({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  vehicleId: 'vehicle-id',
  salePrice: 850000000,
  depositAmount: 100000000,
  salespersonId: 'sales-user-id',
  createdBy: 'admin-id'
});
```

**Record Deposit Payment**
```typescript
const deposit = await AutoSalesProvider.recordDepositPayment({
  tenantId: 'bella_auto_demo',
  bookingId: 'booking-id',
  amount: 100000000,
  paymentMethod: 'bank_transfer',
  paymentReference: 'TXN123456',
  receivedBy: 'cashier-id'
});
```

---

### Phase 5 - Customer Experience

#### NPSSurveyService

**Create Survey**
```typescript
import { NPSSurveyService } from '@/modules/bella-auto/services/NPSSurveyService';

const survey = await NPSSurveyService.createSurvey({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  triggerEvent: 'vehicle_delivered',
  entityId: 'sale-id',
  sentBy: 'system'
});
```

**Submit Response**
```typescript
const response = await NPSSurveyService.submitResponse({
  surveyId: 'survey-id',
  tenantId: 'bella_auto_demo',
  score: 9,
  feedback: 'Excellent service!',
  submittedAt: new Date().toISOString()
});
```

---

#### CustomerHealthScoreService

**Calculate Health Score**
```typescript
import { CustomerHealthScoreService } from '@/modules/bella-auto/services/CustomerHealthScoreService';

const healthScore = await CustomerHealthScoreService.calculateHealthScore({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  calculatedBy: 'system'
});
// Returns score 0-100
```

**Get Health Score Breakdown**
```typescript
const breakdown = await CustomerHealthScoreService.getHealthScoreBreakdown(
  'customer-id',
  'bella_auto_demo'
);
// Returns: { total, engagement, satisfaction, loyalty, recency, frequency }
```

---

### Phase 6 - Service Center

#### ServiceAppointmentService

**Create Appointment**
```typescript
import { ServiceAppointmentService } from '@/modules/bella-auto/services/ServiceAppointmentService';

const appointment = await ServiceAppointmentService.create({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  vehicleId: 'vehicle-id',
  appointmentDate: '2026-08-10',
  appointmentTime: '09:00',
  serviceType: 'maintenance',
  notes: '10,000km service',
  createdBy: 'service-advisor-id'
});
```

**Check-In Customer**
```typescript
const checkedIn = await ServiceAppointmentService.checkIn(
  'appointment-id',
  'bella_auto_demo',
  'service-advisor-id',
  'Vehicle received in good condition'
);
```

---

#### RepairOrderService

**Create Repair Order**
```typescript
import { RepairOrderService } from '@/modules/bella-auto/services/RepairOrderService';

const repairOrder = await RepairOrderService.create({
  tenantId: 'bella_auto_demo',
  appointmentId: 'appointment-id',
  vehicleId: 'vehicle-id',
  customerId: 'customer-id',
  serviceType: 'repair',
  estimatedCompletionDate: '2026-08-12',
  createdBy: 'service-advisor-id'
});
```

**Add Line Item**
```typescript
const lineItem = await RepairOrderService.addLineItem(
  'repair-order-id',
  'bella_auto_demo',
  {
    itemType: 'labor',
    description: 'Engine diagnostic',
    quantity: 1,
    unitPrice: 500000,
    assignedTechnician: 'technician-id'
  },
  'service-advisor-id'
);
```

**Complete Repair Order**
```typescript
const completed = await RepairOrderService.complete(
  'repair-order-id',
  'bella_auto_demo',
  'technician-id',
  'All repairs completed successfully'
);
```

---

### Phase 7 - Trade-In Center

#### TradeInAppraisalService

**Create Appraisal**
```typescript
import { TradeInAppraisalService } from '@/modules/bella-auto/services/TradeInAppraisalService';

const appraisal = await TradeInAppraisalService.create({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  vehicleVin: 'OLD-VIN-123',
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  vehicleYear: 2018,
  mileage: 80000,
  createdBy: 'appraiser-id'
});
```

**Update Technical Checklist**
```typescript
const updated = await TradeInAppraisalService.updateTechnicalChecklist(
  'appraisal-id',
  'bella_auto_demo',
  {
    engine: { condition: 'good', notes: 'No issues' },
    transmission: { condition: 'fair', notes: 'Minor leak' },
    exterior: { condition: 'good', notes: 'Few scratches' }
  },
  'appraiser-id'
);
```

**Submit for Approval**
```typescript
const submitted = await TradeInAppraisalService.submitForApproval(
  'appraisal-id',
  'bella_auto_demo',
  450000000, // Proposed value
  'appraiser-id'
);
```

---

### Phase 8 - Finance Center

#### LoanApplicationService

**Create Loan Application**
```typescript
import { LoanApplicationService } from '@/modules/bella-auto/services/LoanApplicationService';

const loan = await LoanApplicationService.create({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  vehicleId: 'vehicle-id',
  loanAmount: 500000000,
  downPayment: 150000000,
  loanTermMonths: 48,
  interestRate: 8.5,
  bankName: 'Vietcombank',
  createdBy: 'sales-id'
});
```

**Calculate Monthly Payment**
```typescript
const monthlyPayment = LoanApplicationService.calculateMonthlyPayment(
  500000000, // Loan amount
  8.5,        // Interest rate
  48          // Term months
);
// Returns: 12,345,678 VND/month
```

**Approve Loan**
```typescript
const approved = await LoanApplicationService.approve(
  'loan-id',
  'bella_auto_demo',
  {
    approvedBy: 'manager-id',
    approvedAmount: 480000000,
    approvedTermMonths: 48,
    approvedInterestRate: 8.0,
    notes: 'Approved with standard terms'
  }
);
```

---

#### InsuranceService

**Create Insurance Policy**
```typescript
import { InsuranceService } from '@/modules/bella-auto/services/InsuranceService';

const policy = await InsuranceService.create({
  tenantId: 'bella_auto_demo',
  policyNumber: 'INS2026080001',
  customerId: 'customer-id',
  vehicleId: 'vehicle-id',
  insuranceCompany: 'Bảo Việt',
  policyType: 'comprehensive',
  coverageAmount: 800000000,
  premiumAmount: 15000000,
  effectiveDate: '2026-08-01',
  expiryDate: '2027-08-01',
  createdBy: 'sales-id'
});
```

**Get Expiring Policies**
```typescript
const expiring = await InsuranceService.getExpiringPolicies(
  'bella_auto_demo',
  30 // Days before expiry
);
```

---

### Phase 9 - AI Center

#### AIInsightsService

**Create AI Insight**
```typescript
import { AIInsightsService } from '@/modules/bella-auto/services/AIInsightsService';

const insight = await AIInsightsService.create({
  tenantId: 'bella_auto_demo',
  insightType: 'next_best_action',
  title: 'Follow up with customer',
  summary: 'Customer viewed quotation 5 days ago with no response',
  customerId: 'customer-id',
  suggestedActions: [
    { action: 'call', priority: 'high' },
    { action: 'send_email', priority: 'medium' }
  ],
  priority: 'high',
  confidenceScore: 0.85,
  createdBy: 'system'
});
```

**Get Active Insights**
```typescript
const insights = await AIInsightsService.getActiveInsights(
  'bella_auto_demo',
  10 // Limit
);
```

---

#### DemandForecastingService

**Create Forecast**
```typescript
import { DemandForecastingService } from '@/modules/bella-auto/services/DemandForecastingService';

const forecast = await DemandForecastingService.create({
  tenantId: 'bella_auto_demo',
  forecastDate: '2026-08-01',
  forecastPeriod: 'monthly',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  make: 'Honda',
  model: 'Accord',
  predictedDemand: 15,
  predictedDemandMin: 12,
  predictedDemandMax: 18,
  confidenceLevel: 85,
  currentStock: 8,
  recommendedOrderQuantity: 10,
  urgency: 'moderate',
  createdBy: 'system'
});
```

**Get Urgent Forecasts**
```typescript
const urgent = await DemandForecastingService.getUrgentForecasts(
  'bella_auto_demo'
);
```

---

#### ChurnPredictionService

**Create Churn Prediction**
```typescript
import { ChurnPredictionService } from '@/modules/bella-auto/services/ChurnPredictionService';

const prediction = await ChurnPredictionService.create({
  tenantId: 'bella_auto_demo',
  customerId: 'customer-id',
  vehicleId: 'vehicle-id',
  churnProbability: 0.75,
  churnRiskLevel: 'high',
  estimatedDaysToChurn: 30,
  factors: [
    { factor: 'service_overdue', weight: 0.4 },
    { factor: 'low_nps', weight: 0.35 }
  ],
  primaryReason: 'Service overdue by 60 days',
  daysSinceLastService: 180,
  totalServiceVisits: 2,
  recommendedActions: [
    { action: 'personal_call', priority: 'critical' },
    { action: 'discount_offer', priority: 'high' }
  ]
});
```

**Get High-Risk Customers**
```typescript
const highRisk = await ChurnPredictionService.getHighRiskCustomers(
  'bella_auto_demo'
);
```

---

### Phase 10 - Mobile Workforce

#### MobileSessionService

**Create Session**
```typescript
import { MobileSessionService } from '@/modules/bella-auto/services/mobile/MobileSessionService';

const session = await MobileSessionService.createSession({
  tenantId: 'bella_auto_demo',
  userId: 'user-id',
  userRole: 'sales',
  deviceId: 'device-uuid',
  deviceType: 'ios',
  deviceModel: 'iPhone 13',
  appVersion: '1.0.0',
  locationLat: 21.0285,
  locationLng: 105.8542,
  locationName: 'Showroom Hà Nội',
  networkType: 'wifi'
});
```

**Heartbeat**
```typescript
const updated = await MobileSessionService.heartbeat(
  'session-id',
  'bella_auto_demo',
  '4g' // Current network
);
```

---

#### OfflineSyncService

**Queue Offline Action**
```typescript
import { OfflineSyncService } from '@/modules/bella-auto/services/mobile/OfflineSyncService';

const action = await OfflineSyncService.queueAction({
  tenantId: 'bella_auto_demo',
  userId: 'user-id',
  sessionId: 'session-id',
  actionType: 'lead_capture',
  entityType: 'lead',
  actionData: {
    name: 'John Doe',
    phone: '0912345678',
    source: 'walk_in'
  },
  priority: 1 // Highest priority
});
```

**Get Pending Actions**
```typescript
const pending = await OfflineSyncService.getPendingActions(
  'bella_auto_demo',
  'user-id',
  50 // Limit
);
```

**Mark as Synced**
```typescript
const synced = await OfflineSyncService.markSynced(
  'action-id',
  'bella_auto_demo',
  'lead-id' // Created entity ID
);
```

---

#### MobileNotificationService

**Create Notification**
```typescript
import { MobileNotificationService } from '@/modules/bella-auto/services/mobile/MobileNotificationService';

const notification = await MobileNotificationService.create({
  tenantId: 'bella_auto_demo',
  userId: 'user-id',
  notificationType: 'lead_assigned',
  title: 'New Lead Assigned',
  message: 'You have been assigned a new lead: John Doe',
  actionType: 'open_lead',
  actionData: { leadId: 'lead-id' },
  priority: 'high'
});
```

**Get Unread Notifications**
```typescript
const unread = await MobileNotificationService.getUnread(
  'bella_auto_demo',
  'user-id'
);
```

---

## RPC Functions

### Journey Analytics

**get_journey_funnel_analytics**
```sql
SELECT * FROM get_journey_funnel_analytics('bella_auto_demo');
```

Returns conversion rates between journey stages.

---

**get_journey_heatmap**
```sql
SELECT * FROM get_journey_heatmap('bella_auto_demo');
```

Returns average time spent per stage.

---

### Loan Applications

**generate_loan_application_number**
```sql
SELECT generate_loan_application_number('bella_auto_demo');
-- Returns: 'LOAN20260803-0001'
```

---

### Insurance Policies

**check_expiring_insurance_policies**
```sql
SELECT * FROM check_expiring_insurance_policies(
  'bella_auto_demo',
  30 -- Days before expiry
);
```

Returns policies expiring within specified days.

---

### AI Insights

**get_active_ai_insights**
```sql
SELECT * FROM get_active_ai_insights(
  'bella_auto_demo',
  10 -- Limit
);
```

Returns active insights ordered by priority.

---

### Customer Lifetime

**get_customer_lifetime_summary**
```sql
SELECT * FROM get_customer_lifetime_summary(
  'bella_auto_demo',
  'customer-id'
);
```

Returns comprehensive customer statistics.

---

### Mobile

**get_pending_offline_actions**
```sql
SELECT * FROM get_pending_offline_actions(
  'bella_auto_demo',
  'user-id',
  50 -- Limit
);
```

Returns actions queued for sync.

---

**get_unread_notifications**
```sql
SELECT * FROM get_unread_notifications(
  'bella_auto_demo',
  'user-id'
);
```

Returns unread notifications for user.

---

## Data Models

### Vehicle
```typescript
interface Vehicle {
  id: string;
  tenant_id: string;
  vin: string;
  chassis_number?: string;
  engine_number?: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  color: string;
  status: VehicleStatus;
  purchase_price?: number;
  list_price?: number;
  location?: string;
  created_at: string;
  updated_at: string;
}
```

---

### Customer Journey
```typescript
interface CustomerJourney {
  id: string;
  tenant_id: string;
  customer_id: string;
  current_stage_code: string;
  current_stage_name: string;
  lead_source?: string;
  assigned_to?: string;
  started_at: string;
  sla_status: 'on_time' | 'at_risk' | 'breached';
  is_active: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
```

---

### Loan Application
```typescript
interface LoanApplication {
  id: string;
  tenant_id: string;
  application_number: string;
  customer_id: string;
  vehicle_id?: string;
  loan_amount: number;
  down_payment: number;
  loan_term_months: number;
  interest_rate: number;
  monthly_payment: number;
  bank_name: string;
  status: LoanStatus;
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Error Handling

All service methods throw typed errors:

```typescript
try {
  const vehicle = await VehicleManagementService.create(params);
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
    // Handle specific error
  }
}
```

**Common Error Patterns:**
- `Failed to create [entity]: [reason]`
- `Failed to fetch [entity]: [reason]`
- `Failed to update [entity]: [reason]`
- `[Entity] not found`

---

## Rate Limiting

**Supabase Limits:**
- API requests: 500/minute per IP
- Database connections: 60 concurrent
- Storage uploads: 100MB/minute

**Recommendations:**
- Implement client-side caching
- Use RPC functions for complex queries
- Batch operations when possible
- Implement exponential backoff

---

## Examples

### Complete Lead-to-Sale Flow

```typescript
// 1. Capture Lead
const lead = await LeadRotationService.assignLead({
  tenantId: 'bella_auto_demo',
  leadId: 'lead-id',
  allocationMethod: 'smart',
  assignedBy: 'admin-id'
});

// 2. Initialize Journey
const journey = await CustomerJourneyService.initializeJourney({
  tenantId: 'bella_auto_demo',
  customerId: lead.customer_id,
  leadSource: 'facebook_ads',
  initialStageCode: 'awareness',
  assignedTo: lead.assigned_sales_id
});

// 3. Schedule Test Drive
const appointment = await ServiceAppointmentService.create({
  tenantId: 'bella_auto_demo',
  customerId: lead.customer_id,
  appointmentDate: '2026-08-10',
  serviceType: 'test_drive'
});

// 4. Advance Journey
await CustomerJourneyService.advanceStage(
  journey.id,
  'bella_auto_demo',
  'test_drive',
  lead.assigned_sales_id
);

// 5. Create Booking
const booking = await AutoSalesProvider.createBooking({
  tenantId: 'bella_auto_demo',
  customerId: lead.customer_id,
  vehicleId: 'vehicle-id',
  salePrice: 850000000,
  depositAmount: 100000000,
  salespersonId: lead.assigned_sales_id
});

// 6. Process Deposit
await AutoSalesProvider.recordDepositPayment({
  tenantId: 'bella_auto_demo',
  bookingId: booking.id,
  amount: 100000000,
  paymentMethod: 'bank_transfer'
});

// 7. Allocate Vehicle
await VehicleManagementService.updateStatus(
  'vehicle-id',
  'bella_auto_demo',
  'allocated'
);

// 8. Create Loan Application
const loan = await LoanApplicationService.create({
  tenantId: 'bella_auto_demo',
  customerId: lead.customer_id,
  vehicleId: 'vehicle-id',
  loanAmount: 750000000,
  downPayment: 100000000,
  loanTermMonths: 48,
  interestRate: 8.5,
  bankName: 'Vietcombank'
});

// 9. Create Insurance Policy
const insurance = await InsuranceService.create({
  tenantId: 'bella_auto_demo',
  policyNumber: 'INS2026080001',
  customerId: lead.customer_id,
  vehicleId: 'vehicle-id',
  insuranceCompany: 'Bảo Việt',
  policyType: 'comprehensive',
  premiumAmount: 15000000,
  effectiveDate: '2026-08-01',
  expiryDate: '2027-08-01'
});

// 10. Deliver Vehicle
await VehicleManagementService.updateStatus(
  'vehicle-id',
  'bella_auto_demo',
  'delivered'
);

// 11. Send NPS Survey
await NPSSurveyService.createSurvey({
  tenantId: 'bella_auto_demo',
  customerId: lead.customer_id,
  triggerEvent: 'vehicle_delivered',
  entityId: booking.id
});
```

---

## Support

**Documentation:** `docs/` folder  
**Issues:** GitHub Issues  
**Slack:** #bella-auto-dev  
**Email:** dev@bella-auto.com

---

**Version History:**
- v1.0.0 (2026-08-03): Initial release with Phases 0-10

**Last Updated:** August 3, 2026
