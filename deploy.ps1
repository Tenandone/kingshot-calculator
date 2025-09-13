Write-Host "=== KingshotData 배포 시작 ==="

$env:NODE_ENV="production"

node bump-version.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "bump-version.js 실행 실패!"
    exit 1
}

git add .
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "deploy: $stamp (prod version update)"
git push origin main

Write-Host "=== 배포 완료 (버전 $stamp) ==="
