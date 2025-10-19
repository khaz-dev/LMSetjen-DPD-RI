# Deploy Fix to Production Server
# This script connects to your server and applies the fixes

$sshKey = "D:\Project\lms-server-key.pem"
$server = "ubuntu@16.79.83.21"

Write-Host "`n🚀 Deploying Fix to Production Server" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test connection
Write-Host "📡 Testing connection..." -ForegroundColor Yellow
$testResult = ssh -i $sshKey $server "echo 'OK'"
if ($testResult -ne "OK") {
    Write-Host "❌ Cannot connect to server" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Connection successful!`n" -ForegroundColor Green

# Deploy and run fix
Write-Host "🔧 Applying deployment fix..." -ForegroundColor Yellow
Write-Host ""

$commands = "cd ~/LMSetjen-DPD-RI ; git pull origin main ; chmod +x fix-production.sh ; ./fix-production.sh"

ssh -i $sshKey $server $commands

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ Fix Applied!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "`n🔍 Checking final status..." -ForegroundColor Yellow
$statusCmd = "cd ~/LMSetjen-DPD-RI ; docker compose -f docker-compose.prod.yml ps"
ssh -i $sshKey $server $statusCmd

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check if all services show 'Up' status above" -ForegroundColor White
Write-Host "2. Open: http://16.79.83.21 or http://lmsetjendpdri.duckdns.org" -ForegroundColor White
Write-Host "3. Clear browser cache (Ctrl + Shift + R)" -ForegroundColor White
Write-Host "4. Test instructor pages" -ForegroundColor White
Write-Host ""
Write-Host "View logs on server:" -ForegroundColor Cyan
Write-Host "   ssh -i `"$sshKey`" $server" -ForegroundColor White
Write-Host "   cd ~/LMSetjen-DPD-RI" -ForegroundColor White
Write-Host "   docker compose -f docker-compose.prod.yml logs -f frontend" -ForegroundColor White
Write-Host ""
