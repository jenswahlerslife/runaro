
$sql = Get-Content -Path "./LEAGUE_DIRECTORY_MIGRATION.sql" -Raw
Set-Clipboard -Value $sql
Write-Host "✅ Migration SQL copied to clipboard!"
Write-Host "🔗 Opening Supabase Dashboard..."
Start-Process "https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql"
Write-Host ""
Write-Host "📋 NEXT STEPS:"
Write-Host "1. Paste the SQL (Ctrl+V) in the editor"
Write-Host "2. Click 'Run' to deploy"
Write-Host "3. League Directory will be fully operational!"
    