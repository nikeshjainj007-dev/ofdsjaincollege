@echo off
echo =========================================================
echo Starting OFDS JAINITES - Campus Food Delivery System
echo =========================================================
echo.
echo Launching FastAPI Server on http://127.0.0.1:8000 ...
echo Press Ctrl+C to stop the server.
echo.
uv run --with fastapi,uvicorn python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
