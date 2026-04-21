# Hedgyyyboo — Capstone Project

Multi-asset quantitative research terminal with retrieval-augmented LLM narrative layer.

## Stack
- **Backend**: Python 3.11+, FastAPI, NumPy/SciPy, SQLAlchemy + SQLite
- **Frontend**: Next.js 16.1.6, React 19, TypeScript, Tailwind v4, Recharts
- **LLM**: Google Gemma-3n-E4B-it via OpenRouter (free tier)
- **Data sources**: Yahoo Finance · US Treasury · Google News RSS · SEC EDGAR · CFTC COT · BIS REER · GDELT · Forex Factory

## Quick start

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py           # serves on :8001
```

### Frontend
```bash
cd hedgyyyboo-frontend
npm install
npm run dev             # serves on :3000
```

### Note on paths with spaces
Next.js Turbopack's tailwind resolver breaks on absolute paths containing spaces.
If the parent folder has a space in its name, symlink it:
```bash
ln -s "/Users/you/Downloads/untitled folder/hedgyyyboo-frontend" /tmp/hedgyyyboo-frontend
cd /tmp/hedgyyyboo-frontend && npm run dev
```

## ⚠️ Keys in this repo
This repo includes a **live `.env` file** for convenience during development.
**The `OPENROUTER_API_KEY` committed here will be rotated — do not rely on it.**
Generate your own free key at https://openrouter.ai/keys.

## Documentation
- Capstone report: `paper/Hedgyyyboo_Capstone_Report_v2.docx`
- IEEE paper draft: `paper/hedgyyyboo_ieee.docx`
- Study notes (viva prep): `paper/Hedgyyyboo_Study_Notes.pdf`
