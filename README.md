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

## Keys — do your own setup
Copy `backend/.env.example` to `backend/.env` and fill in your OpenRouter
API key (free, from https://openrouter.ai/keys). The `.env` file is
gitignored — never commit it to a public repo, GitHub's secret scanner
and OpenRouter's own scanner will auto-revoke any key they find there.

## Documentation
- Capstone report: `paper/Hedgyyyboo_Capstone_Report_v2.docx`
- IEEE paper draft: `paper/hedgyyyboo_ieee.docx`
- Study notes (viva prep): `paper/Hedgyyyboo_Study_Notes.pdf`
