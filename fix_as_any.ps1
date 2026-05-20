$servicesPath = "src\services"
$files = Get-ChildItem -Path $servicesPath -Filter "*.ts"
$oldPattern = '(await createClient()) as any'
$newValue = 'await createClient()'

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match [regex]::Escape($oldPattern)) {
        $updated = $content.Replace($oldPattern, $newValue)
        Set-Content -Path $file.FullName -Value $updated -NoNewline
        Write-Host "Patched: $($file.Name)"
    }
}
Write-Host "Done."
