# Rule Management API Reference

**Version**: 1.0.0  
**Base URL**: `/api/rule-management`  
**Authentication**: Required (Bearer token via Supabase Auth)

---

## Overview

The Rule Management API provides endpoints for creating, managing, testing, and simulating workflow rules in the Bella ERP Decision Engine Platform. This API supports the Rule Management UI and enables business users to configure decision rules without code changes.

**Key Features:**
- ✅ CRUD operations for workflows and rules
- ✅ Rule simulation with test data
- ✅ Simulation history tracking
- ✅ Multi-tenant isolation
- ✅ Version control for workflow definitions
- ✅ Role-based access control

---

## Table of Contents

1. [Workflow Definitions API](#workflow-definitions-api)
2. [Rules API](#rules-api)
3. [Simulation API](#simulation-api)
4. [Simulation History API](#simulation-history-api)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## Workflow Definitions API

### List Workflows

**Endpoint**: `GET /api/rule-management/workflows`

List all workflow definitions for the current tenant.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status: `draft`, `active`, `archived` |
| `category` | string | No | - | Filter by category |
| `limit` | number | No | 50 | Max results (1-100) |
| `offset` | number | No | 0 | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "name": "Booking Approval Workflow",
      "description": "Auto-approve bookings based on criteria",
      "category": "booking",
      "status": "active",
      "config": {
        "version": "1.0",
        "steps": [...]
      },
      "metadata": {},
      "created_at": "2026-07-09T12:00:00Z",
      "updated_at": "2026-07-09T12:00:00Z",
      "created_by": "uuid"
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

---

### Create Workflow

**Endpoint**: `POST /api/rule-management/workflows`

Create a new workflow definition.

**Request Body:**
```json
{
  "name": "Booking Approval Workflow",
  "description": "Auto-approve bookings based on criteria",
  "category": "booking",
  "config": {
    "version": "1.0",
    "steps": [
      {
        "type": "decision",
        "name": "check-booking-value",
        "config": {
          "field": "totalAmount",
          "operator": "greaterThan",
          "value": 1000000
        }
      }
    ]
  },
  "metadata": {
    "author": "John Doe",
    "department": "Operations"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "Booking Approval Workflow",
    "status": "draft",
    "created_at": "2026-07-09T12:00:00Z",
    ...
  }
}
```

**Status Code**: `201 Created`

---

### Get Workflow

**Endpoint**: `GET /api/rule-management/workflows/[workflowId]`

Get a specific workflow definition by ID.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string (UUID) | Yes | Workflow ID |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "Booking Approval Workflow",
    "description": "Auto-approve bookings based on criteria",
    "category": "booking",
    "status": "active",
    "config": {...},
    "metadata": {},
    "created_at": "2026-07-09T12:00:00Z",
    "updated_at": "2026-07-09T12:00:00Z",
    "created_by": "uuid"
  }
}
```

---

### Update Workflow

**Endpoint**: `PATCH /api/rule-management/workflows/[workflowId]`

Update a workflow definition. Creates a new version if config changed.

**Request Body (all fields optional):**
```json
{
  "name": "Updated Booking Approval",
  "description": "Updated description",
  "category": "booking",
  "status": "active",
  "config": {
    "version": "1.1",
    "steps": [...]
  },
  "metadata": {},
  "changeSummary": "Added new approval step" // Required if config changed
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Booking Approval",
    "status": "active",
    "updated_at": "2026-07-09T13:00:00Z",
    ...
  }
}
```

---

### Delete Workflow

**Endpoint**: `DELETE /api/rule-management/workflows/[workflowId]`

Delete a workflow (soft delete by archiving).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "archived"
  }
}
```

---

## Rules API

### List Rules

**Endpoint**: `GET /api/rule-management/rules`

List all rules for the current tenant.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workflowId` | string (UUID) | No | - | Filter by workflow |
| `ruleType` | string | No | - | Filter by type: `condition`, `action`, `decision` |
| `status` | string | No | - | Filter by status: `active`, `inactive` |
| `limit` | number | No | 100 | Max results (1-500) |
| `offset` | number | No | 0 | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workflow_id": "uuid",
      "tenant_id": "uuid",
      "name": "Check High Value Booking",
      "description": "Require approval for bookings > 1M VND",
      "rule_type": "condition",
      "priority": 10,
      "config": {
        "field": "totalAmount",
        "operator": "greaterThan",
        "value": 1000000
      },
      "metadata": {},
      "is_active": true,
      "created_at": "2026-07-09T12:00:00Z",
      "updated_at": "2026-07-09T12:00:00Z",
      "created_by": "uuid"
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "count": 1
  }
}
```

---

### Create Rule

**Endpoint**: `POST /api/rule-management/rules`

Create a new rule.

**Request Body:**
```json
{
  "workflowId": "uuid",
  "name": "Check High Value Booking",
  "description": "Require approval for bookings > 1M VND",
  "ruleType": "condition",
  "priority": 10,
  "config": {
    "field": "totalAmount",
    "operator": "greaterThan",
    "value": 1000000
  },
  "metadata": {
    "category": "financial"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workflow_id": "uuid",
    "name": "Check High Value Booking",
    "rule_type": "condition",
    "is_active": true,
    "created_at": "2026-07-09T12:00:00Z",
    ...
  }
}
```

**Status Code**: `201 Created`

---

### Get Rule

**Endpoint**: `GET /api/rule-management/rules/[ruleId]`

Get a specific rule by ID.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ruleId` | string (UUID) | Yes | Rule ID |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workflow_id": "uuid",
    "name": "Check High Value Booking",
    "rule_type": "condition",
    "config": {...},
    ...
  }
}
```

---

### Update Rule

**Endpoint**: `PATCH /api/rule-management/rules/[ruleId]`

Update a rule.

**Request Body (all fields optional):**
```json
{
  "name": "Updated Rule Name",
  "description": "Updated description",
  "ruleType": "condition",
  "priority": 20,
  "config": {
    "field": "totalAmount",
    "operator": "greaterThanOrEqual",
    "value": 2000000
  },
  "metadata": {},
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Rule Name",
    "priority": 20,
    "updated_at": "2026-07-09T13:00:00Z",
    ...
  }
}
```

---

### Delete Rule

**Endpoint**: `DELETE /api/rule-management/rules/[ruleId]`

Delete a rule (hard delete).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deleted": true
  }
}
```

---

## Simulation API

### Simulate Rules

**Endpoint**: `POST /api/rule-management/simulate`

Test rules with sample data without affecting production.

**Request Body:**
```json
{
  "workflowId": "uuid",
  "ruleIds": ["uuid1", "uuid2"], // Optional: test specific rules
  "testData": {
    "bookingId": "uuid",
    "totalAmount": 1500000,
    "customerType": "VIP",
    "paymentMethod": "cash"
  },
  "saveResult": true // Optional: save to history
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflowId": "uuid",
    "workflowName": "Booking Approval Workflow",
    "testData": {...},
    "results": [
      {
        "ruleId": "uuid",
        "ruleName": "Check High Value Booking",
        "ruleType": "condition",
        "passed": true,
        "result": true,
        "error": null,
        "executionTime": 2
      }
    ],
    "summary": {
      "totalRules": 1,
      "passed": 1,
      "failed": 0,
      "executionTime": 5
    }
  }
}
```

---

## Simulation History API

### List Simulations

**Endpoint**: `GET /api/rule-management/simulations`

List saved simulation results.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workflowId` | string (UUID) | No | - | Filter by workflow |
| `limit` | number | No | 20 | Max results (1-100) |
| `offset` | number | No | 0 | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workflow_id": "uuid",
      "tenant_id": "uuid",
      "test_data": {...},
      "results": [...],
      "summary": {
        "totalRules": 5,
        "passed": 4,
        "failed": 1,
        "executionTime": 12
      },
      "created_at": "2026-07-09T12:00:00Z",
      "created_by": "uuid",
      "workflow_definitions": {
        "id": "uuid",
        "name": "Booking Approval Workflow",
        "category": "booking"
      }
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "count": 1
  }
}
```

---

## Error Handling

All endpoints return consistent error responses:

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**HTTP Status Codes:**
| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | Success | Request completed successfully |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Missing/invalid parameters |
| `401` | Unauthorized | Missing/invalid authentication token |
| `404` | Not Found | Resource not found or access denied |
| `500` | Internal Server Error | Server-side error |
| `503` | Service Unavailable | Feature disabled via feature flag |

---

## Examples

### Example 1: Create and Test a Discount Rule

**Step 1: Create Workflow**
```bash
curl -X POST https://your-domain/api/rule-management/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discount Eligibility",
    "category": "discount",
    "config": {
      "version": "1.0",
      "description": "Check if customer eligible for discount"
    }
  }'
```

**Step 2: Create Rule**
```bash
curl -X POST https://your-domain/api/rule-management/rules \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "WORKFLOW_UUID",
    "name": "VIP Discount",
    "ruleType": "condition",
    "priority": 10,
    "config": {
      "field": "customerType",
      "operator": "equals",
      "value": "VIP"
    }
  }'
```

**Step 3: Simulate**
```bash
curl -X POST https://your-domain/api/rule-management/simulate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "WORKFLOW_UUID",
    "testData": {
      "customerType": "VIP",
      "totalPurchase": 5000000
    },
    "saveResult": true
  }'
```

---

### Example 2: Update Rule and Check History

**Step 1: Update Rule**
```bash
curl -X PATCH https://your-domain/api/rule-management/rules/RULE_UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": 20,
    "config": {
      "field": "totalPurchase",
      "operator": "greaterThan",
      "value": 3000000
    }
  }'
```

**Step 2: Get Simulation History**
```bash
curl -X GET "https://your-domain/api/rule-management/simulations?workflowId=WORKFLOW_UUID&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database Schema References

**Tables Used:**
- `workflow_definitions` - Workflow metadata and configuration
- `workflow_rules` - Individual rules within workflows
- `workflow_versions` - Version history of workflow configs
- `rule_simulations` - Saved simulation results

**RPC Functions Used:**
- `get_workflow_definitions()` - List workflows with filters
- `get_workflow_rules()` - List rules with filters

**See Also:**
- [Database Schema Migration](../supabase/migrations/20260709130000_rule_management_ui_foundation.sql)
- [TypeScript Types](../src/types/rule-management.types.ts)
- [Rule Management UI Architecture](./RULE_MANAGEMENT_UI_ARCHITECTURE.md)

---

## Next Steps

**Week 1 Day 3-5**: Visual Rule Builder UI  
**Week 2**: Workflow Designer + Simulator + Dashboard  
**Week 3**: Testing + Polish + Production Deployment

---

**Last Updated**: 2026-07-09  
**Status**: Week 1 Day 2 Complete ✅
