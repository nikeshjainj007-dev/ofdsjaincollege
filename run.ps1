Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Starting OFDS JAINITES - Campus Food Delivery System" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launching server on http://127.0.0.1:8000 ..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

uv run --with fastapi,uvicorn python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
