#############################################
# Rule Management API Test Suite (PowerShell)
# 
# Tests all 6 Rule Management API endpoints
# with real requests and validates responses
#############################################

param(
    [string]$ApiBaseUrl = $env:API_BASE_URL ?? "http://localhost:3000",
    [string]$AuthToken = $env:AUTH_TOKEN
)

# Test results tracking
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TotalTests = 0

# Global variables for IDs
$script:WorkflowId = ""
$script:RuleId = ""

#############################################
# Helper Functions
#############################################

function Print-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
    $script:TestsPassed++
    $script:TotalTests++
}

function Print-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    $script:TestsFailed++
    $script:TotalTests++
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Yellow
}

function Check-Prerequisites {
    Print-Header "Checking Prerequisites"
    
    # Check if AUTH_TOKEN is set
    if ([string]::IsNullOrEmpty($AuthToken)) {
        Print-Error "AUTH_TOKEN is not set. Please pass -AuthToken parameter or set AUTH_TOKEN environment variable"
        Print-Info "You can get a token from Supabase dashboard or by logging in"
        exit 1
    }
    Print-Success "AUTH_TOKEN is set"
    
    # Check if API is reachable
    try {
        $response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method Get -ErrorAction Stop
        Print-Success "API is reachable at $ApiBaseUrl"
    } catch {
        Print-Error "API is not reachable at $ApiBaseUrl"
        exit 1
    }
}

function Make-Request {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Data = $null
    )
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type" = "application/json"
    }
    
    $params = @{
        Uri = "$ApiBaseUrl$Endpoint"
        Method = $Method
        Headers = $headers
    }
    
    if ($null -ne $Data) {
        $params.Body = ($Data | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params -ErrorAction Stop
        return $response
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        return @{
            success = $false
            error = $errorBody.error
            statusCode = $statusCode
        }
    }
}

#############################################
# Test Suite: Workflows API
#############################################

function Test-CreateWorkflow {
    Print-Header "Test 1: Create Workflow"
    
    $data = @{
        name = "Test Booking Approval Workflow"
        description = "Automated test workflow for booking approvals"
        category = "booking"
        config = @{
            version = "1.0"
            description = "Auto-approve bookings based on criteria"
            steps = @(
                @{
                    type = "decision"
                    name = "check-booking-value"
                    config = @{
                        field = "totalAmount"
                        operator = "greaterThan"
                        value = 1000000
                    }
                }
            )
        }
        metadata = @{
            author = "Test Suite"
            environment = "staging"
        }
    }
    
    Print-Info "Creating workflow..."
    $response = Make-Request -Method "POST" -Endpoint "/api/rule-management/workflows" -Data $data
    
    if ($response.success -eq $true) {
        $script:WorkflowId = $response.data.id
        Print-Success "Created workflow with ID: $($script:WorkflowId)"
        $response.data | ConvertTo-Json -Depth 3
    } else {
        Print-Error "Failed to create workflow: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-ListWorkflows {
    Print-Header "Test 2: List Workflows"
    
    Print-Info "Listing workflows with filters..."
    $response = Make-Request -Method "GET" -Endpoint "/api/rule-management/workflows?status=draft&limit=10"
    
    if ($response.success -eq $true) {
        $count = $response.data.Count
        Print-Success "Listed $count workflows"
        $response.data[0] | Select-Object id, name, status, category | ConvertTo-Json
    } else {
        Print-Error "Failed to list workflows: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-GetWorkflow {
    Print-Header "Test 3: Get Workflow"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Getting workflow $($script:WorkflowId)..."
    $response = Make-Request -Method "GET" -Endpoint "/api/rule-management/workflows/$($script:WorkflowId)"
    
    if ($response.success -eq $true) {
        Print-Success "Retrieved workflow successfully"
        $response.data | Select-Object id, name, status, config | ConvertTo-Json -Depth 3
    } else {
        Print-Error "Failed to get workflow: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-UpdateWorkflow {
    Print-Header "Test 4: Update Workflow"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    $data = @{
        name = "Test Booking Approval Workflow (Updated)"
        status = "active"
        config = @{
            version = "1.1"
            description = "Updated workflow configuration"
            steps = @(
                @{
                    type = "decision"
                    name = "check-booking-value"
                    config = @{
                        field = "totalAmount"
                        operator = "greaterThanOrEqual"
                        value = 2000000
                    }
                }
            )
        }
        changeSummary = "Updated threshold to 2M VND"
    }
    
    Print-Info "Updating workflow $($script:WorkflowId)..."
    $response = Make-Request -Method "PATCH" -Endpoint "/api/rule-management/workflows/$($script:WorkflowId)" -Data $data
    
    if ($response.success -eq $true) {
        Print-Success "Updated workflow successfully"
        $response.data | Select-Object id, name, status | ConvertTo-Json
    } else {
        Print-Error "Failed to update workflow: $($response.error)"
        $response | ConvertTo-Json
    }
}

#############################################
# Test Suite: Rules API
#############################################

function Test-CreateRule {
    Print-Header "Test 5: Create Rule"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    $data = @{
        workflowId = $script:WorkflowId
        name = "High Value Booking Check"
        description = "Require approval for bookings > 1M VND"
        ruleType = "condition"
        priority = 10
        config = @{
            field = "totalAmount"
            operator = "greaterThan"
            value = 1000000
        }
        metadata = @{
            category = "financial"
            severity = "high"
        }
    }
    
    Print-Info "Creating rule..."
    $response = Make-Request -Method "POST" -Endpoint "/api/rule-management/rules" -Data $data
    
    if ($response.success -eq $true) {
        $script:RuleId = $response.data.id
        Print-Success "Created rule with ID: $($script:RuleId)"
        $response.data | Select-Object id, name, rule_type, priority | ConvertTo-Json
    } else {
        Print-Error "Failed to create rule: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-ListRules {
    Print-Header "Test 6: List Rules"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Listing rules for workflow $($script:WorkflowId)..."
    $response = Make-Request -Method "GET" -Endpoint "/api/rule-management/rules?workflowId=$($script:WorkflowId)&limit=10"
    
    if ($response.success -eq $true) {
        $count = $response.data.Count
        Print-Success "Listed $count rules"
        if ($count -gt 0) {
            $response.data[0] | Select-Object id, name, rule_type, is_active | ConvertTo-Json
        }
    } else {
        Print-Error "Failed to list rules: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-GetRule {
    Print-Header "Test 7: Get Rule"
    
    if ([string]::IsNullOrEmpty($script:RuleId)) {
        Print-Error "RULE_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Getting rule $($script:RuleId)..."
    $response = Make-Request -Method "GET" -Endpoint "/api/rule-management/rules/$($script:RuleId)"
    
    if ($response.success -eq $true) {
        Print-Success "Retrieved rule successfully"
        $response.data | Select-Object id, name, config | ConvertTo-Json -Depth 3
    } else {
        Print-Error "Failed to get rule: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-UpdateRule {
    Print-Header "Test 8: Update Rule"
    
    if ([string]::IsNullOrEmpty($script:RuleId)) {
        Print-Error "RULE_ID is not set. Skipping test."
        return
    }
    
    $data = @{
        name = "High Value Booking Check (Updated)"
        priority = 20
        config = @{
            field = "totalAmount"
            operator = "greaterThanOrEqual"
            value = 2000000
        }
        isActive = $true
    }
    
    Print-Info "Updating rule $($script:RuleId)..."
    $response = Make-Request -Method "PATCH" -Endpoint "/api/rule-management/rules/$($script:RuleId)" -Data $data
    
    if ($response.success -eq $true) {
        Print-Success "Updated rule successfully"
        $response.data | Select-Object id, name, priority | ConvertTo-Json
    } else {
        Print-Error "Failed to update rule: $($response.error)"
        $response | ConvertTo-Json
    }
}

#############################################
# Test Suite: Simulation API
#############################################

function Test-SimulateRules {
    Print-Header "Test 9: Simulate Rules"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    $data = @{
        workflowId = $script:WorkflowId
        testData = @{
            bookingId = "test-booking-123"
            totalAmount = 1500000
            customerType = "VIP"
            paymentMethod = "cash"
        }
        saveResult = $true
    }
    
    Print-Info "Simulating rules..."
    $response = Make-Request -Method "POST" -Endpoint "/api/rule-management/simulate" -Data $data
    
    if ($response.success -eq $true) {
        $summary = $response.data.summary
        Print-Success "Simulation completed: $($summary.passed)/$($summary.totalRules) passed, $($summary.executionTime)ms"
        $response.data.summary | ConvertTo-Json
        $response.data.results | ConvertTo-Json -Depth 3
    } else {
        Print-Error "Failed to simulate rules: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-ListSimulations {
    Print-Header "Test 10: List Simulation History"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Listing simulation history..."
    $response = Make-Request -Method "GET" -Endpoint "/api/rule-management/simulations?workflowId=$($script:WorkflowId)&limit=5"
    
    if ($response.success -eq $true) {
        $count = $response.data.Count
        Print-Success "Listed $count simulation results"
        if ($count -gt 0) {
            $response.data[0] | Select-Object id, created_at, summary | ConvertTo-Json -Depth 3
        }
    } else {
        Print-Error "Failed to list simulations: $($response.error)"
        $response | ConvertTo-Json
    }
}

#############################################
# Cleanup Tests
#############################################

function Test-DeleteRule {
    Print-Header "Test 11: Delete Rule"
    
    if ([string]::IsNullOrEmpty($script:RuleId)) {
        Print-Error "RULE_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Deleting rule $($script:RuleId)..."
    $response = Make-Request -Method "DELETE" -Endpoint "/api/rule-management/rules/$($script:RuleId)"
    
    if ($response.success -eq $true) {
        Print-Success "Deleted rule successfully"
        $response.data | ConvertTo-Json
    } else {
        Print-Error "Failed to delete rule: $($response.error)"
        $response | ConvertTo-Json
    }
}

function Test-DeleteWorkflow {
    Print-Header "Test 12: Delete Workflow (Archive)"
    
    if ([string]::IsNullOrEmpty($script:WorkflowId)) {
        Print-Error "WORKFLOW_ID is not set. Skipping test."
        return
    }
    
    Print-Info "Deleting (archiving) workflow $($script:WorkflowId)..."
    $response = Make-Request -Method "DELETE" -Endpoint "/api/rule-management/workflows/$($script:WorkflowId)"
    
    if ($response.success -eq $true) {
        Print-Success "Archived workflow successfully"
        $response.data | ConvertTo-Json
    } else {
        Print-Error "Failed to delete workflow: $($response.error)"
        $response | ConvertTo-Json
    }
}

#############################################
# Main Execution
#############################################

function Main {
    Print-Header "Rule Management API Test Suite"
    Print-Info "Testing against: $ApiBaseUrl"
    Print-Info "Using auth token: $($AuthToken.Substring(0, [Math]::Min(20, $AuthToken.Length)))..."
    
    Check-Prerequisites
    
    # Workflow tests
    Test-CreateWorkflow
    Test-ListWorkflows
    Test-GetWorkflow
    Test-UpdateWorkflow
    
    # Rule tests
    Test-CreateRule
    Test-ListRules
    Test-GetRule
    Test-UpdateRule
    
    # Simulation tests
    Test-SimulateRules
    Test-ListSimulations
    
    # Cleanup tests
    Test-DeleteRule
    Test-DeleteWorkflow
    
    # Summary
    Print-Header "Test Summary"
    Write-Host "✓ Passed: $($script:TestsPassed)" -ForegroundColor Green
    Write-Host "✗ Failed: $($script:TestsFailed)" -ForegroundColor Red
    Write-Host "Total: $($script:TotalTests)" -ForegroundColor Blue
    
    if ($script:TestsFailed -eq 0) {
        Write-Host ""
        Print-Success "All tests passed! 🎉"
        exit 0
    } else {
        Write-Host ""
        Print-Error "Some tests failed. Please review the output above."
        exit 1
    }
}

# Run main function
Main
