#!/bin/bash

#############################################
# Rule Management API Test Suite
# 
# Tests all 6 Rule Management API endpoints
# with real requests and validates responses
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Global variables for IDs
WORKFLOW_ID=""
RULE_ID=""
SIMULATION_ID=""

#############################################
# Helper Functions
#############################################

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
    ((TOTAL_TESTS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it: sudo apt-get install jq"
        exit 1
    fi
    print_success "jq is installed"
    
    # Check if AUTH_TOKEN is set
    if [ -z "$AUTH_TOKEN" ]; then
        print_error "AUTH_TOKEN is not set. Please export AUTH_TOKEN=<your-token>"
        print_info "You can get a token from Supabase dashboard or by logging in"
        exit 1
    fi
    print_success "AUTH_TOKEN is set"
    
    # Check if API is reachable
    if curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/api/health" | grep -q "200"; then
        print_success "API is reachable at $API_BASE_URL"
    else
        print_error "API is not reachable at $API_BASE_URL"
        exit 1
    fi
}

make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE_URL$endpoint"
    fi
}

validate_response() {
    local response=$1
    local expected_success=$2
    
    local success=$(echo "$response" | jq -r '.success')
    
    if [ "$success" = "$expected_success" ]; then
        return 0
    else
        return 1
    fi
}

#############################################
# Test Suite: Workflows API
#############################################

test_create_workflow() {
    print_header "Test 1: Create Workflow"
    
    local data='{
        "name": "Test Booking Approval Workflow",
        "description": "Automated test workflow for booking approvals",
        "category": "booking",
        "config": {
            "version": "1.0",
            "description": "Auto-approve bookings based on criteria",
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
            "author": "Test Suite",
            "environment": "staging"
        }
    }'
    
    print_info "Creating workflow..."
    local response=$(make_request "POST" "/api/rule-management/workflows" "$data")
    
    if validate_response "$response" "true"; then
        WORKFLOW_ID=$(echo "$response" | jq -r '.data.id')
        print_success "Created workflow with ID: $WORKFLOW_ID"
        echo "$response" | jq '.'
    else
        print_error "Failed to create workflow"
        echo "$response" | jq '.'
        return 1
    fi
}

test_list_workflows() {
    print_header "Test 2: List Workflows"
    
    print_info "Listing workflows with filters..."
    local response=$(make_request "GET" "/api/rule-management/workflows?status=draft&limit=10")
    
    if validate_response "$response" "true"; then
        local count=$(echo "$response" | jq '.data | length')
        print_success "Listed $count workflows"
        echo "$response" | jq '.data[0] | {id, name, status, category}'
    else
        print_error "Failed to list workflows"
        echo "$response" | jq '.'
        return 1
    fi
}

test_get_workflow() {
    print_header "Test 3: Get Workflow"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Getting workflow $WORKFLOW_ID..."
    local response=$(make_request "GET" "/api/rule-management/workflows/$WORKFLOW_ID")
    
    if validate_response "$response" "true"; then
        print_success "Retrieved workflow successfully"
        echo "$response" | jq '.data | {id, name, status, config}'
    else
        print_error "Failed to get workflow"
        echo "$response" | jq '.'
        return 1
    fi
}

test_update_workflow() {
    print_header "Test 4: Update Workflow"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    local data='{
        "name": "Test Booking Approval Workflow (Updated)",
        "status": "active",
        "config": {
            "version": "1.1",
            "description": "Updated workflow configuration",
            "steps": [
                {
                    "type": "decision",
                    "name": "check-booking-value",
                    "config": {
                        "field": "totalAmount",
                        "operator": "greaterThanOrEqual",
                        "value": 2000000
                    }
                }
            ]
        },
        "changeSummary": "Updated threshold to 2M VND"
    }'
    
    print_info "Updating workflow $WORKFLOW_ID..."
    local response=$(make_request "PATCH" "/api/rule-management/workflows/$WORKFLOW_ID" "$data")
    
    if validate_response "$response" "true"; then
        print_success "Updated workflow successfully"
        echo "$response" | jq '.data | {id, name, status}'
    else
        print_error "Failed to update workflow"
        echo "$response" | jq '.'
        return 1
    fi
}

#############################################
# Test Suite: Rules API
#############################################

test_create_rule() {
    print_header "Test 5: Create Rule"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    local data="{
        \"workflowId\": \"$WORKFLOW_ID\",
        \"name\": \"High Value Booking Check\",
        \"description\": \"Require approval for bookings > 1M VND\",
        \"ruleType\": \"condition\",
        \"priority\": 10,
        \"config\": {
            \"field\": \"totalAmount\",
            \"operator\": \"greaterThan\",
            \"value\": 1000000
        },
        \"metadata\": {
            \"category\": \"financial\",
            \"severity\": \"high\"
        }
    }"
    
    print_info "Creating rule..."
    local response=$(make_request "POST" "/api/rule-management/rules" "$data")
    
    if validate_response "$response" "true"; then
        RULE_ID=$(echo "$response" | jq -r '.data.id')
        print_success "Created rule with ID: $RULE_ID"
        echo "$response" | jq '.data | {id, name, rule_type, priority}'
    else
        print_error "Failed to create rule"
        echo "$response" | jq '.'
        return 1
    fi
}

test_list_rules() {
    print_header "Test 6: List Rules"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Listing rules for workflow $WORKFLOW_ID..."
    local response=$(make_request "GET" "/api/rule-management/rules?workflowId=$WORKFLOW_ID&limit=10")
    
    if validate_response "$response" "true"; then
        local count=$(echo "$response" | jq '.data | length')
        print_success "Listed $count rules"
        echo "$response" | jq '.data[0] | {id, name, rule_type, is_active}'
    else
        print_error "Failed to list rules"
        echo "$response" | jq '.'
        return 1
    fi
}

test_get_rule() {
    print_header "Test 7: Get Rule"
    
    if [ -z "$RULE_ID" ]; then
        print_error "RULE_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Getting rule $RULE_ID..."
    local response=$(make_request "GET" "/api/rule-management/rules/$RULE_ID")
    
    if validate_response "$response" "true"; then
        print_success "Retrieved rule successfully"
        echo "$response" | jq '.data | {id, name, config}'
    else
        print_error "Failed to get rule"
        echo "$response" | jq '.'
        return 1
    fi
}

test_update_rule() {
    print_header "Test 8: Update Rule"
    
    if [ -z "$RULE_ID" ]; then
        print_error "RULE_ID is not set. Skipping test."
        return 1
    fi
    
    local data='{
        "name": "High Value Booking Check (Updated)",
        "priority": 20,
        "config": {
            "field": "totalAmount",
            "operator": "greaterThanOrEqual",
            "value": 2000000
        },
        "isActive": true
    }'
    
    print_info "Updating rule $RULE_ID..."
    local response=$(make_request "PATCH" "/api/rule-management/rules/$RULE_ID" "$data")
    
    if validate_response "$response" "true"; then
        print_success "Updated rule successfully"
        echo "$response" | jq '.data | {id, name, priority}'
    else
        print_error "Failed to update rule"
        echo "$response" | jq '.'
        return 1
    fi
}

#############################################
# Test Suite: Simulation API
#############################################

test_simulate_rules() {
    print_header "Test 9: Simulate Rules"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    local data="{
        \"workflowId\": \"$WORKFLOW_ID\",
        \"testData\": {
            \"bookingId\": \"test-booking-123\",
            \"totalAmount\": 1500000,
            \"customerType\": \"VIP\",
            \"paymentMethod\": \"cash\"
        },
        \"saveResult\": true
    }"
    
    print_info "Simulating rules..."
    local response=$(make_request "POST" "/api/rule-management/simulate" "$data")
    
    if validate_response "$response" "true"; then
        local total_rules=$(echo "$response" | jq '.data.summary.totalRules')
        local passed=$(echo "$response" | jq '.data.summary.passed')
        local failed=$(echo "$response" | jq '.data.summary.failed')
        local exec_time=$(echo "$response" | jq '.data.summary.executionTime')
        
        print_success "Simulation completed: $passed/$total_rules passed, ${exec_time}ms"
        echo "$response" | jq '.data.summary'
        echo "$response" | jq '.data.results[]'
    else
        print_error "Failed to simulate rules"
        echo "$response" | jq '.'
        return 1
    fi
}

test_list_simulations() {
    print_header "Test 10: List Simulation History"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Listing simulation history..."
    local response=$(make_request "GET" "/api/rule-management/simulations?workflowId=$WORKFLOW_ID&limit=5")
    
    if validate_response "$response" "true"; then
        local count=$(echo "$response" | jq '.data | length')
        print_success "Listed $count simulation results"
        if [ "$count" -gt 0 ]; then
            echo "$response" | jq '.data[0] | {id, created_at, summary}'
        fi
    else
        print_error "Failed to list simulations"
        echo "$response" | jq '.'
        return 1
    fi
}

#############################################
# Cleanup Tests
#############################################

test_delete_rule() {
    print_header "Test 11: Delete Rule"
    
    if [ -z "$RULE_ID" ]; then
        print_error "RULE_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Deleting rule $RULE_ID..."
    local response=$(make_request "DELETE" "/api/rule-management/rules/$RULE_ID")
    
    if validate_response "$response" "true"; then
        print_success "Deleted rule successfully"
        echo "$response" | jq '.data'
    else
        print_error "Failed to delete rule"
        echo "$response" | jq '.'
        return 1
    fi
}

test_delete_workflow() {
    print_header "Test 12: Delete Workflow (Archive)"
    
    if [ -z "$WORKFLOW_ID" ]; then
        print_error "WORKFLOW_ID is not set. Skipping test."
        return 1
    fi
    
    print_info "Deleting (archiving) workflow $WORKFLOW_ID..."
    local response=$(make_request "DELETE" "/api/rule-management/workflows/$WORKFLOW_ID")
    
    if validate_response "$response" "true"; then
        print_success "Archived workflow successfully"
        echo "$response" | jq '.data'
    else
        print_error "Failed to delete workflow"
        echo "$response" | jq '.'
        return 1
    fi
}

#############################################
# Main Execution
#############################################

main() {
    print_header "Rule Management API Test Suite"
    print_info "Testing against: $API_BASE_URL"
    print_info "Using auth token: ${AUTH_TOKEN:0:20}..."
    
    check_prerequisites
    
    # Workflow tests
    test_create_workflow
    test_list_workflows
    test_get_workflow
    test_update_workflow
    
    # Rule tests
    test_create_rule
    test_list_rules
    test_get_rule
    test_update_rule
    
    # Simulation tests
    test_simulate_rules
    test_list_simulations
    
    # Cleanup tests
    test_delete_rule
    test_delete_workflow
    
    # Summary
    print_header "Test Summary"
    echo -e "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}✗ Failed: $TESTS_FAILED${NC}"
    echo -e "${BLUE}Total: $TOTAL_TESTS${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo ""
        print_success "All tests passed! 🎉"
        exit 0
    else
        echo ""
        print_error "Some tests failed. Please review the output above."
        exit 1
    fi
}

# Run main function
main
