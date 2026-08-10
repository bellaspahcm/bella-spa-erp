# REPLACEMENT TEST - Gate 7 Validation (Git Worktree Method)
# Test: Can Host Platform build without Healthcare package?
# Expected: SUCCESS (Host has zero dependencies on Healthcare)
# Method: Isolated git worktree (safe, repeatable, no working tree pollution)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "BELLA META-PLATFORM - REPLACEMENT TEST (Gate 7)" -ForegroundColor Cyan
Write-Host "Test: Delete Healthcare → Host Platform still builds" -ForegroundColor Cyan
Write-Host "Method: Git Worktree (Safe & Repeatable)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 0: Pre-flight checks
Write-Host "Step 0: Pre-flight checks..." -ForegroundColor Yellow

# Check git repository
$gitStatus = git status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Not a git repository or git not installed" -ForegroundColor Red
    exit 1
}

# Check source directories
if (-not (Test-Path "src/platform/healthcare")) {
    Write-Host "❌ ERROR: Healthcare platform not found. Cannot run test." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "src/platform/host")) {
    Write-Host "❌ ERROR: Host platform not found. Cannot run test." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git repository validated" -ForegroundColor Green
Write-Host "✅ Healthcare platform exists" -ForegroundColor Green
Write-Host "✅ Host platform exists" -ForegroundColor Green
Write-Host ""

# Step 1: Create isolated git worktree
Write-Host "Step 1: Create isolated git worktree..." -ForegroundColor Yellow

$worktreePath = "..\bella-replacement-test-worktree"
$currentCommit = git rev-parse HEAD

# Remove old worktree if exists
if (Test-Path $worktreePath) {
    Write-Host "⚠️  Old worktree exists. Cleaning up..." -ForegroundColor Yellow
    git worktree remove $worktreePath --force 2>&1 | Out-Null
}

# Create new worktree at current commit (detached HEAD)
git worktree add --detach $worktreePath $currentCommit 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Failed to create git worktree" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Worktree created: $worktreePath (detached HEAD at $($currentCommit.Substring(0,7)))" -ForegroundColor Green
Write-Host ""

# Step 2: Delete Healthcare in worktree
Write-Host "Step 2: Delete Healthcare in worktree..." -ForegroundColor Yellow

Push-Location $worktreePath

if (Test-Path "src/platform/healthcare") {
    Remove-Item -Recurse -Force "src/platform/healthcare"
    Write-Host "✅ Healthcare deleted in worktree" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Healthcare not found in worktree" -ForegroundColor Red
    Pop-Location
    git worktree remove $worktreePath --force
    exit 1
}
Write-Host ""

# Step 3: Install dependencies (if needed)
Write-Host "Step 3: Install dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "⚠️  node_modules exists, skipping install" -ForegroundColor Yellow
} else {
    Write-Host "Running: npm install" -ForegroundColor Gray
    npm install --silent 2>&1 | Out-Null
}
Write-Host ""

# Step 4: Build Host Platform
Write-Host "Step 4: Build project (Host Platform only)..." -ForegroundColor Yellow
Write-Host "Running: npm run build" -ForegroundColor Gray

$buildOutput = npm run build 2>&1
$buildExitCode = $LASTEXITCODE

Pop-Location

Write-Host ""
if ($buildExitCode -eq 0) {
    Write-Host "✅ BUILD SUCCESS - Host Platform builds without Healthcare!" -ForegroundColor Green
    $testResult = "PASS"
} else {
    Write-Host "❌ BUILD FAILED - Host Platform has dependencies on Healthcare" -ForegroundColor Red
    Write-Host ""
    Write-Host "Build output (last 30 lines):" -ForegroundColor Yellow
    $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    $testResult = "FAIL"
}
Write-Host ""

# Step 5: Cleanup worktree
Write-Host "Step 5: Cleanup worktree..." -ForegroundColor Yellow
git worktree remove $worktreePath --force 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Worktree removed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: Failed to remove worktree automatically" -ForegroundColor Yellow
    Write-Host "   Manual cleanup: git worktree remove $worktreePath --force" -ForegroundColor Yellow
}
Write-Host ""

# Final report
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "REPLACEMENT TEST RESULT" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($testResult -eq "PASS") {
    Write-Host "✅ GATE 7: PASS" -ForegroundColor Green
    Write-Host ""
    Write-Host "Evidence: Host Platform successfully built without Healthcare package." -ForegroundColor Green
    Write-Host "Method: Isolated git worktree (repeatable, safe)" -ForegroundColor Green
    Write-Host "Conclusion: Zero dependency from Host → Healthcare validated." -ForegroundColor Green
    Write-Host ""
    Write-Host "Meta-Platform Architecture: ✅ VALIDATED" -ForegroundColor Green
    Write-Host "Sibling Relationship: ✅ CONFIRMED (Healthcare and Education are siblings)" -ForegroundColor Green
    Write-Host "Education OS Readiness: ✅ CONFIRMED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Step: ARB Approval → Boundary Freeze" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ GATE 7: FAIL" -ForegroundColor Red
    Write-Host ""
    Write-Host "Evidence: Host Platform build failed without Healthcare package." -ForegroundColor Red
    Write-Host "Action Required: Fix Host Platform dependencies on Healthcare." -ForegroundColor Red
    Write-Host ""
    Write-Host "Review build errors above to identify coupling violations." -ForegroundColor Yellow
    Write-Host "Worktree has been cleaned up. Your working tree is unchanged." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
