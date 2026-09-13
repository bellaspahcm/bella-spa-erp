#!/usr/bin/env pwsh
#
# E1 V1 Semantic Verification Script
# Purpose: Verify API responses contain valid JSON with expected structure
# Usage: .\scripts\e1-v1-semantic-verify.ps1 "<preview-url>"
#
# Prerequisites:
# - Vercel SSO protection disabled OR bypass token set
# - Preview deployment ready
#
# Success Criteria:
# - Content-Type: application/json
# - Valid JSON body
# - Expected data structure
# - Proper error handling

param(
    [Parameter(Mandatory=$true)]
    [string]$BaseUrl
)

$ErrorActionPreference = "Continue"

# Remove trailing slash
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "`n=== E1 V1 SEMANTIC VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl`n"

# Test configuration
$TenantId = "test-tenant-1"
$Endpoints = @(
    @{
        Name = "List Branches"
        Path = "/api/english-center/branches"
        Query = "tenantId=$TenantId"
        ExpectedStatus = 200
        ExpectedType = "application/json"
        ExpectArray = $true
    },
    @{
        Name = "Branch Hierarchy"
        Path = "/api/english-center/branches/hierarchy"
        Query = "tenantId=$TenantId"
        ExpectedStatus = 200
        ExpectedType = "application/json"
        ExpectArray = $true
    },
    @{
        Name = "Invalid Branch ID (Error Case)"
        Path = "/api/english-center/branches/invalid-uuid-format"
        Query = "tenantId=$TenantId"
        ExpectedStatus = @(400, 404, 500)  # Accept any error status
        ExpectedType = "application/json"
        ExpectError = $true
    }
)

$Results = @()
$PassCount = 0
$FailCount = 0

foreach ($endpoint in $Endpoints) {
    $url = "$BaseUrl$($endpoint.Path)?$($endpoint.Query)"
    
    Write-Host "Testing: $($endpoint.Name)" -ForegroundColor Yellow
    Write-Host "  URL: $url"
    
    # Get response headers and body
    try {
        # Use curl to get full response
        $response = curl -s -i $url 2>&1 | Out-String
        
        # Parse status code
        if ($response -match "HTTP/[\d.]+ (\d+)") {
            $statusCode = [int]$Matches[1]
        } else {
            $statusCode = 0
        }
        
        # Parse Content-Type
        if ($response -match "(?i)Content-Type:\s*([^\r\n]+)") {
            $contentType = $Matches[1].Trim()
        } else {
            $contentType = "unknown"
        }
        
        # Extract body (after headers)
        $bodyStart = $response.IndexOf("`r`n`r`n")
        if ($bodyStart -gt 0) {
            $body = $response.Substring($bodyStart).Trim()
        } else {
            $body = ""
        }
        
        # Check for SSO redirect
        if ($statusCode -eq 302 -and $response -match "vercel.com/sso-api") {
            Write-Host "  ❌ BLOCKED: Vercel SSO redirect detected" -ForegroundColor Red
            Write-Host "  Action: Disable Vercel Protection or set bypass token`n"
            $Results += @{
                Name = $endpoint.Name
                Status = "BLOCKED"
                Reason = "Vercel SSO Protection"
            }
            $FailCount++
            continue
        }
        
        # Validate status code
        $statusOk = $false
        if ($endpoint.ExpectedStatus -is [array]) {
            $statusOk = $endpoint.ExpectedStatus -contains $statusCode
        } else {
            $statusOk = $statusCode -eq $endpoint.ExpectedStatus
        }
        
        if (-not $statusOk) {
            Write-Host "  ❌ Status: $statusCode (expected: $($endpoint.ExpectedStatus))" -ForegroundColor Red
            $Results += @{
                Name = $endpoint.Name
                Status = "FAIL"
                Reason = "Unexpected status code: $statusCode"
            }
            $FailCount++
            continue
        }
        
        Write-Host "  ✅ Status: $statusCode" -ForegroundColor Green
        
        # Validate Content-Type
        if ($contentType -notlike "*$($endpoint.ExpectedType)*") {
            Write-Host "  ❌ Content-Type: $contentType (expected: $($endpoint.ExpectedType))" -ForegroundColor Red
            $Results += @{
                Name = $endpoint.Name
                Status = "FAIL"
                Reason = "Wrong Content-Type: $contentType"
            }
            $FailCount++
            continue
        }
        
        Write-Host "  ✅ Content-Type: $contentType" -ForegroundColor Green
        
        # Validate JSON
        try {
            $json = $body | ConvertFrom-Json
            Write-Host "  ✅ Valid JSON" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Invalid JSON: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  Body preview: $($body.Substring(0, [Math]::Min(200, $body.Length)))" -ForegroundColor Gray
            $Results += @{
                Name = $endpoint.Name
                Status = "FAIL"
                Reason = "Invalid JSON"
            }
            $FailCount++
            continue
        }
        
        # Validate structure
        if ($endpoint.ExpectArray) {
            if ($json.data -isnot [array]) {
                Write-Host "  ❌ Expected array in 'data' field" -ForegroundColor Red
                $Results += @{
                    Name = $endpoint.Name
                    Status = "FAIL"
                    Reason = "Expected array in data field"
                }
                $FailCount++
                continue
            }
            Write-Host "  ✅ Data is array with $($json.data.Count) items" -ForegroundColor Green
        }
        
        if ($endpoint.ExpectError) {
            if (-not $json.error -and -not $json.message) {
                Write-Host "  ⚠️  Warning: Error response missing 'error' or 'message' field" -ForegroundColor Yellow
            } else {
                Write-Host "  ✅ Error response has proper structure" -ForegroundColor Green
            }
        }
        
        Write-Host "  ✅ PASS`n" -ForegroundColor Green
        $Results += @{
            Name = $endpoint.Name
            Status = "PASS"
        }
        $PassCount++
        
    } catch {
        Write-Host "  ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $Results += @{
            Name = $endpoint.Name
            Status = "ERROR"
            Reason = $_.Exception.Message
        }
        $FailCount++
    }
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total Tests: $($PassCount + $FailCount)"
Write-Host "Passed: $PassCount" -ForegroundColor Green
Write-Host "Failed: $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Green" })

Write-Host "`nResults:"
foreach ($result in $Results) {
    $icon = switch ($result.Status) {
        "PASS" { "✅"; $color = "Green" }
        "FAIL" { "❌"; $color = "Red" }
        "BLOCKED" { "🚫"; $color = "Red" }
        "ERROR" { "⚠️ "; $color = "Yellow" }
    }
    Write-Host "  $icon $($result.Name): $($result.Status)" -ForegroundColor $color
    if ($result.Reason) {
        Write-Host "     Reason: $($result.Reason)" -ForegroundColor Gray
    }
}

# Exit code
if ($FailCount -eq 0) {
    Write-Host "`n✅ V1 SEMANTIC VERIFICATION: PASS" -ForegroundColor Green
    Write-Host "Next: Proceed to V6 UI manual test`n"
    exit 0
} else {
    Write-Host "`n❌ V1 SEMANTIC VERIFICATION: FAIL" -ForegroundColor Red
    Write-Host "Action: Review failures above and retry`n"
    exit 1
}
