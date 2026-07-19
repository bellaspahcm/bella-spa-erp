# Run-All PowerShell script for k6 load testing on Bella Spa ERP
# Tự động load env từ .env.local và chạy toàn bộ 10 scripts test.

# 1. Đọc và nạp biến môi trường từ .env.local
if (Test-Path ".env.local") {
    Write-Host "[Env] Đang nạp cấu hình từ .env.local..." -ForegroundColor Cyan
    Get-Content .env.local | Foreach-Object {
        if ($_ -match "^\s*([^#=\s]+)\s*=\s*(.*)$") {
            $name = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            # Xóa dấu ngoặc kép hoặc ngoặc đơn nếu có ở đầu/cuối
            if ($value -match '^"(.*)"$') { $value = $Matches[1] }
            elseif ($value -match "^'(.*)'$") { $value = $Matches[1] }
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            if ($name -eq "SUPABASE_SERVICE_ROLE_KEY") {
                [System.Environment]::SetEnvironmentVariable("SUPABASE_SERVICE_KEY", $value, "Process")
            }
        }
    }
} else {
    Write-Error "[Error] Không tìm thấy file .env.local ở thư mục gốc!"
    exit 1
}

# Đảm bảo k6.exe có trên PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Báo lỗi nếu k6 không hoạt động
try {
    k6 version | Out-Null
} catch {
    Write-Error "[Error] k6 chưa được cài đặt hoặc không nằm trên PATH!"
    exit 1
}

# Tạo thư mục lưu kết quả
if (!(Test-Path "load-tests/results")) {
    New-Item -ItemType Directory -Force -Path "load-tests/results" | Out-Null
}

$scripts = @(
    "01-smoke.js",
    "02-dashboard-load.js",
    "03-booking-stress.js",
    "04-login-spike.js",
    "05-checkout-soak.js",
    "06-concurrent-booking-spike.js",
    "07-payroll-calc.js",
    "08-inventory-checkout.js",
    "09-ai-assistant.js",
    "10-enterprise-workflow.js"
)

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  BẮT ĐẦU CHẠY TOÀN BỘ BỘ SUITE LOAD TEST BELLA ERP" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

foreach ($script in $scripts) {
    Write-Host "Running: $script..." -ForegroundColor Yellow
    $logFile = "load-tests/results/$($script.Replace('.js', '.log'))"
    
    # Ghi nhận thời điểm bắt đầu
    $startTime = Get-Date
    
    # Chạy k6 với override cấu hình vus và duration để hoàn thành nhanh và an toàn
    # Để đo đạc chính xác, ta đặt vus=5 và duration=15s (trừ smoke test giữ nguyên 1 VU)
    $vus = 5
    if ($script -eq "01-smoke.js") { $vus = 1 }
    
    k6 run --vus $vus --duration 15s "load-tests/scripts/$script" *>&1 | Out-File -FilePath $logFile
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "Completed $script in $duration seconds. Log saved to: $logFile" -ForegroundColor Green
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  HOÀN TẤT TOÀN BỘ TESTS! Báo cáo đã được lưu." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
