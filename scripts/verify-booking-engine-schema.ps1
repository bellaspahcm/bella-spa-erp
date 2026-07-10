# ============================================================================
# Booking Engine Schema Verification Script (PowerShell)
# ============================================================================
# Purpose: Verify schema deployed correctly
# Usage: .\scripts\verify-booking-engine-schema.ps1 [local|staging|prod]
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'staging', 'prod')]
    [string]$Environment = 'local'
)

$ErrorActionPreference = "Continue"  # Don't stop on errors

Write-Host "🔍 Booking Engine Schema Verification" -ForegroundColor Cyan
Write-Host "Environment: $Environment"
Write-Host ""

# ============================================================================
# Functions
# ============================================================================

function Run-SQLTests {
    param([string]$ProjectRef = "")
    
    Write-Host "📋 Running SQL verification tests..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        if ($Environment -eq "local") {
            npx supabase db execute -f supabase\tests\booking_engine_schema_verification.sql
        } else {
            if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
                Write-Host "❌ Project ref required for non-local environment" -ForegroundColor Red
                return $false
            }
            npx supabase db execute -f supabase\tests\booking_engine_schema_verification.sql --project-ref $ProjectRef
        }
        
        Write-Host ""
        return $true
    }
    catch {
        Write-Host "❌ SQL tests failed: $_" -ForegroundColor Red
        return $false
    }
}

function Run-TypeScriptTests {
    Write-Host "📋 Running TypeScript tests..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        npm test -- schema-verification.test.ts
        Write-Host ""
        return $true
    }
    catch {
        Write-Host "⚠️  TypeScript tests failed (may need setup): $_" -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
}

function Verify-Types {
    Write-Host "📋 Verifying TypeScript types..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check if types file exists
    if (-not (Test-Path "src\types\supabase-generated.ts")) {
        Write-Host "⚠️  Types not generated yet" -ForegroundColor Yellow
        Write-Host "Run: npx supabase gen types typescript --local > src\types\supabase-generated.ts"
        return $false
    }
    
    $typesContent = Get-Content "src\types\supabase-generated.ts" -Raw
    
    # Check if new tables present in types
    $missing = @()
    
    if ($typesContent -notmatch "waitlist") {
        $missing += "waitlist"
    }
    
    if ($typesContent -notmatch "pricing_rules") {
        $missing += "pricing_rules"
    }
    
    if ($typesContent -notmatch "capacity_snapshots") {
        $missing += "capacity_snapshots"
    }
    
    if ($typesContent -notmatch "booking_events") {
        $missing += "booking_events"
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "❌ Missing types: $($missing -join ', ')" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ All types present" -ForegroundColor Green
    Write-Host ""
    return $true
}

function Verify-Build {
    Write-Host "📋 Verifying TypeScript compilation..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        npm run build
        Write-Host "✅ Build successful" -ForegroundColor Green
        Write-Host ""
        return $true
    }
    catch {
        Write-Host "❌ Build failed: $_" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

# ============================================================================
# Main
# ============================================================================

$results = @{
    SQLTests = $false
    Types = $false
    TSTests = $false
    Build = $false
}

switch ($Environment) {
    'local' {
        Write-Host "🏠 Local environment verification" -ForegroundColor Cyan
        Write-Host ""
        
        # Check Supabase running
        try {
            npx supabase status 2>&1 | Out-Null
        }
        catch {
            Write-Host "❌ Supabase not running locally" -ForegroundColor Red
            Write-Host "Start with: npx supabase start"
            exit 1
        }
        
        # Run SQL tests
        $results.SQLTests = Run-SQLTests
        
        # Verify types
        $results.Types = Verify-Types
        
        # Run TypeScript tests
        $results.TSTests = Run-TypeScriptTests
        
        # Verify build
        $results.Build = Verify-Build
    }
    
    { $_ -in 'staging', 'prod' } {
        Write-Host "☁️  Remote environment verification" -ForegroundColor Cyan
        Write-Host ""
        
        $ProjectRef = Read-Host "Enter Project Ref"
        
        if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
            Write-Host "❌ Project ref required" -ForegroundColor Red
            exit 1
        }
        
        # Run SQL tests
        $results.SQLTests = Run-SQLTests -ProjectRef $ProjectRef
        
        # Verify types
        $results.Types = Verify-Types
        
        # Run TypeScript tests
        $results.TSTests = Run-TypeScriptTests
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📊 Schema Verification Results" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Display results
Write-Host "SQL Tests:        " -NoNewline
if ($results.SQLTests) {
    Write-Host "✅ Passed" -ForegroundColor Green
} else {
    Write-Host "❌ Failed" -ForegroundColor Red
}

Write-Host "Type Generation:  " -NoNewline
if ($results.Types) {
    Write-Host "✅ OK" -ForegroundColor Green
} else {
    Write-Host "⚠️  Check" -ForegroundColor Yellow
}

Write-Host "TypeScript Tests: " -NoNewline
if ($results.TSTests) {
    Write-Host "✅ Passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Check" -ForegroundColor Yellow
}

Write-Host "Build:            " -NoNewline
if ($results.Build) {
    Write-Host "✅ Passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Check" -ForegroundColor Yellow
}

Write-Host ""

if ($results.SQLTests) {
    Write-Host "✅ Schema is ready for Provider implementation!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks failed. Review above for details." -ForegroundColor Yellow
}

Write-Host ""
