# Rule Management UI Implementation Plan

**Status:** READY TO START (Backend 23/23 tests passing ✅)  
**Priority:** 🥇 HIGHEST (M&A exit value driver)  
**Duration:** 3-5 days  
**M&A Impact:** +50% valuation (self-service capability)

---

## 🎯 GOALS

### Business Goal
Enable business users to create, test, and manage decision rules **without developer intervention**.

### User Story
```
As a Business Manager
I want to create a new VIP priority rule
So that VIP customers get assigned to senior KTVs automatically
Without waiting for a developer to code it
```

### Success Metrics
- Business user can create new rule in <5 minutes
- Rule test pass rate >95% before deployment
- Zero developer involvement for rule changes
- Rule approval workflow <24 hours

---

## 📐 ARCHITECTURE

### Route Structure
```
/dashboard/rules
├── /                           # List all rules
├── /new                        # Create new rule
├── /[ruleId]                   # View rule detail
├── /[ruleId]/edit              # Edit rule
├── /[ruleId]/test              # Test simulator
├── /[ruleId]/versions          # Version history
└── /approvals                  # Approval queue
```

### Component Hierarchy
```
RulesPage (List)
├── RulesTable
│   ├── RuleRow
│   └── RuleActions (Edit, Test, Archive)
├── RulesFilters (Provider, Status, Search)
└── CreateRuleButton

RuleEditorPage (New/Edit)
├── RuleMetadataForm (Name, Description, Provider, Category)
├── ConditionsBuilder
│   ├── ConditionGroup (AND/OR)
│   │   └── ConditionItem (Field, Operator, Value)
│   └── AddConditionButton
├── ActionsBuilder
│   ├── ActionItem (Type, Field, Operation, Value)
│   └── AddActionButton
├── RulePrioritySlider
└── RuleStatusSelect

TestSimulatorPage
├── TestInputEditor (JSON)
├── ExecuteButton
├── TestResultsDisplay
│   ├── MatchedConditions
│   ├── ExecutedActions
│   ├── ExecutionTrace
│   └── PerformanceMetrics
└── SaveTestCaseButton

VersionHistoryPage
├── VersionTimeline
│   └── VersionCard (Version, Changes, Author, Date)
├── VersionDiffViewer (Side-by-side comparison)
└── RollbackButton

ApprovalsPage
├── PendingApprovalsList
│   └── ApprovalCard (Rule, Requester, Date, Actions)
├── ApprovalFilters (Provider, Date Range)
└── BulkApproveButton
```

---

## 🎨 UI/UX DESIGN PRINCIPLES

### Visual Design
- **Clean & Minimal**: Decision rules are complex - UI must be simple
- **Visual Hierarchy**: Conditions = Blue, Actions = Green, Metadata = Gray
- **Drag & Drop**: Reorder conditions/actions easily
- **Live Preview**: Show rule logic as plain English

### User Experience
- **Progressive Disclosure**: Start simple (metadata) → Add complexity (conditions/actions)
- **Inline Validation**: Real-time feedback on invalid rules
- **Undo/Redo**: Allow mistakes without fear
- **Guided Wizards**: First-time users get step-by-step guidance

### Accessibility
- Keyboard navigation (Tab, Enter, Arrow keys)
- Screen reader support (ARIA labels)
- Color-blind friendly (not relying on color alone)
- High contrast mode support

---

## 📋 IMPLEMENTATION PHASES

### Phase 1: Rule List & Navigation (Day 1) 🎯
**Goal:** User can browse existing rules

**Components:**
- `src/app/dashboard/rules/page.tsx` - Main list page
- `src/components/rules/RulesTable.tsx` - DataTable
- `src/components/rules/RulesFilters.tsx` - Filter controls
- `src/components/rules/RuleStatusBadge.tsx` - Status indicator

**Features:**
- List all rules (with pagination)
- Filter by provider (booking, discount, payroll, etc.)
- Filter by status (draft, active, disabled, pending_approval)
- Search by name/description
- Row actions: View, Edit, Test, Archive
- Create button → Navigate to `/rules/new`

**API Integration:**
- `GET /api/rules` - Fetch rules list
- Query params: `provider`, `status`, `search`, `page`, `limit`

**Success Criteria:**
- [ ] Can see all rules in table
- [ ] Filters work correctly
- [ ] Search returns relevant results
- [ ] Pagination handles 100+ rules
- [ ] Create button navigates to editor

---

### Phase 2: Rule Editor - Metadata & Basic Form (Day 2) 🎯
**Goal:** User can create basic rule structure

**Components:**
- `src/app/dashboard/rules/new/page.tsx` - Create page
- `src/app/dashboard/rules/[ruleId]/edit/page.tsx` - Edit page
- `src/components/rules/RuleEditor.tsx` - Main editor container
- `src/components/rules/RuleMetadataForm.tsx` - Name, description, provider, category
- `src/components/rules/RulePrioritySlider.tsx` - Priority control (0-1000)

**Features:**
- Form fields:
  - Name (required, 3-100 chars)
  - Description (optional, 0-500 chars)
  - Provider (dropdown: booking, discount, payroll, commission, inventory)
  - Category (dropdown: provider-specific categories)
  - Priority (slider: 0-1000, default 100)
  - Status (dropdown: draft, active, disabled)
- Form validation (client-side + server-side)
- Save as draft
- Auto-save every 30 seconds
- Breadcrumb navigation

**API Integration:**
- `POST /api/rules` - Create new rule
- `GET /api/rules/[ruleId]` - Fetch rule for editing
- `PATCH /api/rules/[ruleId]` - Update rule

**Success Criteria:**
- [ ] Can create rule with metadata
- [ ] Validation shows clear error messages
- [ ] Auto-save prevents data loss
- [ ] Cancel button warns about unsaved changes

---

### Phase 3: Visual Rule Builder - Conditions (Day 3) 🎯
**Goal:** User can build complex conditions without JSON

**Components:**
- `src/components/rules/ConditionsBuilder.tsx` - Main container
- `src/components/rules/ConditionGroup.tsx` - AND/OR group
- `src/components/rules/ConditionItem.tsx` - Single condition
- `src/components/rules/FieldSelector.tsx` - Dropdown for fields
- `src/components/rules/OperatorSelector.tsx` - Dropdown for operators
- `src/components/rules/ValueInput.tsx` - Dynamic input (string, number, date, boolean)

**Features:**
- **Condition Structure:**
  ```typescript
  {
    field: 'customer.tier',        // Dropdown
    operator: 'equals',             // Dropdown
    value: 'VIP',                   // Input (type-aware)
    logicalOperator: 'AND'          // Dropdown (AND/OR)
  }
  ```
- Add/Remove conditions
- Drag to reorder
- Nest conditions (groups)
- Live preview: "If customer tier equals VIP AND KTV years of service >= 3"

**Supported Operators:**
- Comparison: `equals`, `not_equals`, `gt`, `gte`, `lt`, `lte`
- String: `contains`, `starts_with`, `ends_with`, `matches` (regex)
- Array: `in`, `not_in`
- Boolean: `is_true`, `is_false`
- Null: `is_null`, `is_not_null`

**Field Schema (Provider-specific):**
```typescript
// Booking Provider Fields
{
  'customer.tier': { type: 'string', options: ['VIP', 'Regular', 'New'] },
  'customer.totalSpent': { type: 'number', unit: 'VND' },
  'ktv.yearsOfService': { type: 'number', unit: 'years' },
  'ktv.rating': { type: 'number', min: 1, max: 5 },
  'booking.serviceType': { type: 'string', options: ['massage', 'facial', 'combo'] },
  'booking.totalAmount': { type: 'number', unit: 'VND' },
  'session.date': { type: 'date' },
  'session.timeSlot': { type: 'string', options: ['morning', 'afternoon', 'evening'] }
}
```

**Success Criteria:**
- [ ] Can add multiple conditions
- [ ] Operators update based on field type
- [ ] Value input matches field type (number, date, dropdown)
- [ ] Live preview shows readable logic
- [ ] Drag-and-drop reordering works

---

### Phase 4: Visual Rule Builder - Actions (Day 3-4) 🎯
**Goal:** User can define actions to execute when conditions match

**Components:**
- `src/components/rules/ActionsBuilder.tsx` - Main container
- `src/components/rules/ActionItem.tsx` - Single action
- `src/components/rules/ActionTypeSelector.tsx` - Type dropdown
- `src/components/rules/ActionFieldSelector.tsx` - Field to modify

**Features:**
- **Action Types:**
  1. **Modify** - Change a value
     - Field: `priorityScore`
     - Operation: `add`, `subtract`, `multiply`, `divide`, `set`
     - Value: `50`
     - Reason: "VIP fast-track"
  
  2. **Assign** - Set assignment
     - Field: `assignedKtvId`
     - Value: `<ktv-id>`
     - Reason: "Senior KTV required"
  
  3. **Block** - Prevent action
     - Reason: "Service not available for this customer tier"
  
  4. **Require Approval** - Flag for manual review
     - Approver: `manager`
     - Reason: "High-value booking requires confirmation"
  
  5. **Notify** - Send notification
     - Channel: `zalo`, `sms`, `email`
     - Template: `vip_priority_notification`
     - Recipient: `customer`, `ktv`, `manager`

- Add/Remove actions
- Drag to reorder
- Live preview: "Add 50 to priority score (VIP fast-track)"

**Success Criteria:**
- [ ] Can add multiple actions
- [ ] Action fields update based on type
- [ ] Each action has reason/description
- [ ] Preview shows expected outcome

---

### Phase 5: Test Simulator (Day 4) 🎯
**Goal:** User can test rules before deploying

**Components:**
- `src/app/dashboard/rules/[ruleId]/test/page.tsx` - Test page
- `src/components/rules/TestInputEditor.tsx` - JSON editor for input
- `src/components/rules/TestResultsDisplay.tsx` - Results panel
- `src/components/rules/ExecutionTrace.tsx` - Step-by-step trace

**Features:**
- **Input Editor:**
  - JSON editor (Monaco Editor)
  - Syntax highlighting
  - Auto-complete for field names
  - Sample templates (by provider)

- **Execute Test:**
  - POST `/api/rules/[ruleId]/test`
  - Loading state
  - Error handling

- **Results Display:**
  - Matched conditions (✅/❌ for each)
  - Executed actions (before/after values)
  - Execution trace (step-by-step log)
  - Performance metrics (execution time)
  - Pass/Fail verdict

- **Save Test Case:**
  - Name test case
  - Save input + expected output
  - Reuse for regression testing

**Sample Test Input:**
```json
{
  "customer": {
    "id": "cust-123",
    "tier": "VIP",
    "totalSpent": 50000000
  },
  "ktv": {
    "id": "ktv-456",
    "yearsOfService": 5,
    "rating": 4.8
  },
  "booking": {
    "serviceType": "combo",
    "totalAmount": 2000000
  },
  "priorityScore": 50
}
```

**Success Criteria:**
- [ ] Can input test data
- [ ] Execute test returns results
- [ ] Trace shows step-by-step logic
- [ ] Can save test cases for reuse
- [ ] Error messages are actionable

---

### Phase 6: Version History & Rollback (Day 5) 🎯
**Goal:** User can view changes and rollback if needed

**Components:**
- `src/app/dashboard/rules/[ruleId]/versions/page.tsx` - Version history page
- `src/components/rules/VersionTimeline.tsx` - Timeline view
- `src/components/rules/VersionCard.tsx` - Single version
- `src/components/rules/VersionDiffViewer.tsx` - Side-by-side diff

**Features:**
- **Version Timeline:**
  - List all versions (descending by date)
  - Show: version number, change type, author, date
  - Change types: created, updated, conditions_changed, actions_changed, priority_changed

- **Diff Viewer:**
  - Side-by-side comparison
  - Highlight additions (green)
  - Highlight deletions (red)
  - Highlight modifications (yellow)

- **Rollback:**
  - Button: "Rollback to this version"
  - Confirmation dialog
  - POST `/api/rules/[ruleId]/rollback`
  - Success message

**Success Criteria:**
- [ ] Timeline shows all changes
- [ ] Diff viewer highlights changes clearly
- [ ] Rollback creates new version (not destructive)
- [ ] Audit trail is complete

---

### Phase 7: Approval Workflow (Day 5) 🎯
**Goal:** Manager can approve/reject rule changes

**Components:**
- `src/app/dashboard/rules/approvals/page.tsx` - Approvals queue
- `src/components/rules/ApprovalCard.tsx` - Single approval request
- `src/components/rules/ApprovalActions.tsx` - Approve/Reject buttons

**Features:**
- **Approvals List:**
  - Show pending approvals only
  - Filter by provider, date range
  - Sort by date (oldest first)

- **Approval Card:**
  - Rule name
  - Requester name
  - Request date
  - Changes summary
  - Comments from requester

- **Actions:**
  - Approve: POST `/api/rules/approvals` with status `approved`
  - Reject: POST `/api/rules/approvals` with status `rejected` + reason
  - Comment: Add internal note

**Success Criteria:**
- [ ] Pending approvals visible immediately
- [ ] Approve/Reject updates rule status
- [ ] Notifications sent to requester
- [ ] Audit trail records approver

---

## 🛠️ TECHNICAL STACK

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** shadcn/ui (based on Radix UI)
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form + Zod validation
- **Data Fetching:** TanStack Query (React Query)
- **State Management:** Zustand (for complex editor state)
- **Drag & Drop:** @dnd-kit
- **Code Editor:** Monaco Editor (for JSON test inputs)

### Backend (Already Complete ✅)
- **API Routes:** Next.js API routes
- **Database:** Supabase Postgres
- **ORM:** Supabase Client
- **Tests:** Jest (23/23 passing)

---

## 📊 DATA FLOW

### Create Rule Flow
```
User fills form
    ↓
Client validation (Zod)
    ↓
POST /api/rules
    ↓
Server validation
    ↓
Insert into DB
    ↓
Trigger creates version
    ↓
Return rule ID
    ↓
Navigate to /rules/[ruleId]
```

### Test Rule Flow
```
User inputs test data
    ↓
POST /api/rules/[ruleId]/test
    ↓
Engine evaluates conditions
    ↓
Engine executes actions
    ↓
Log trace
    ↓
Insert test result
    ↓
Return result + trace
    ↓
Display in UI
```

### Approval Flow
```
User submits rule
    ↓
Status → pending_approval
    ↓
Insert approval request
    ↓
Notify manager
    ↓
Manager reviews
    ↓
Approve/Reject
    ↓
Update rule status
    ↓
Notify requester
```

---

## 🎯 SUCCESS CRITERIA (Acceptance Tests)

### End-to-End User Journey
1. ✅ User can create VIP priority rule in <5 minutes
2. ✅ Rule passes test with sample input
3. ✅ User submits for approval
4. ✅ Manager approves rule
5. ✅ Rule goes live (status: active)
6. ✅ Rule processes 100+ decisions successfully
7. ✅ User can view rule analytics (matched, executed, performance)

### Business Metrics
- Time to create rule: <5 min (target: 3 min)
- Test pass rate: >95% before deployment
- Approval time: <24 hours
- Developer involvement: 0% (self-service goal)

### Technical Metrics
- Page load time: <2 seconds
- Rule execution time: <2ms (backend already achieves 0.6ms avg)
- UI responsiveness: 60 FPS
- Accessibility score: >90 (Lighthouse)

---

## 🚀 DEPLOYMENT STRATEGY

### Phase 1: Internal Beta
- Deploy to staging
- Test with internal team (1 week)
- Collect feedback
- Fix critical bugs

### Phase 2: Pilot Users
- Deploy to production (limited access)
- Train 2-3 business users
- Monitor usage patterns
- Iterate based on feedback

### Phase 3: General Availability
- Open to all users
- Announcement + training materials
- Support channel (Slack/email)
- Monitor adoption metrics

---

## 📚 DOCUMENTATION DELIVERABLES

1. **User Guide** - How to create rules (with screenshots)
2. **Field Reference** - All available fields by provider
3. **Operator Reference** - Explanation of each operator
4. **Example Rules** - 10+ real-world rule examples
5. **Troubleshooting** - Common issues and solutions
6. **Video Tutorial** - 5-minute walkthrough

---

## 🔄 MAINTENANCE & ITERATION

### Post-Launch Improvements (Future)
- AI-powered rule suggestions
- Rule templates library
- Bulk import/export rules (JSON/CSV)
- Rule versioning with branching (like Git)
- A/B testing for rules
- Rule performance analytics dashboard

### Technical Debt Prevention
- Keep tests green (100% pass rate)
- Monitor bundle size (<300KB for rules pages)
- Track performance regressions (Lighthouse CI)
- Regular accessibility audits

---

## 📞 STAKEHOLDERS

- **Development:** Build UI components
- **Design:** UI/UX review (optional, using existing design system)
- **Business:** User acceptance testing
- **QA:** Test scenarios + edge cases
- **Product:** Success metrics tracking

---

**Ready to implement Phase 1 (Rule List Page)?** 🚀
