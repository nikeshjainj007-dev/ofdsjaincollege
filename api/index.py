"""
Vercel serverless entry point.
This file imports the FastAPI app from the project root so Vercel can serve it.
"""
import sys
import os

# Make sure the project root is on the Python path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app  # noqa: F401 - Vercel expects an `app` symbol
