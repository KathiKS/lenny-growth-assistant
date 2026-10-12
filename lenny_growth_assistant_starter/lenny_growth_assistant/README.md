# The Lenny Growth Assistant — Starter

A local-first starter for the Forward Deployed Engineer take-home assignment.

## Requirements
- Windows 10/11
- Python 3.11 or newer
- Ollama for Windows
- A small Ollama model; start with `qwen3:4b ` on a machine with 8 GB RAM or less.
- VS Code

## 1. Install Ollama and download a model
Install Ollama from https://ollama.com/download/windows, then open a new PowerShell terminal:

```powershell
ollama pull qwen3:4b 
ollama run qwen3:4b 
```

Wait for a response to a simple prompt, then exit the model chat with `/bye`. Keep Ollama running in the background.

## 2. Set up Python
Open PowerShell in this project folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks virtual-environment activation, run this for the current terminal only:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again.

## 3. Start the app
```powershell
uvicorn backend.main:app --reload
```

Open http://127.0.0.1:8000. API health is at http://127.0.0.1:8000/api/health and interactive API docs at http://127.0.0.1:8000/docs.

## 4. Add transcripts
Place UTF-8 plain-text `.txt` transcript files that you are permitted to use in `data/transcripts/`. Restarting is not required; the starter reads files when a query arrives. Without transcript files, the app should not be expected to provide useful grounded answers.

## Database note
For quick first boot, `.env.example` uses SQLite. The assignment requires PostgreSQL, so this is not submission-complete until you configure `DATABASE_URL` to a PostgreSQL connection string (for example, a Supabase PostgreSQL connection) and test persistence. Keep credentials only in `.env`, never in Git.

## Current implementation status
This starter provides a minimal chat UI, FastAPI, session/message persistence, Ollama calls, basic keyword retrieval, and source previews. It is a foundation, not the completed assessment.

Before submission, finish:
- PostgreSQL configuration and tests
- Required Pi Coding Agent SDK or Anthropic Claude Agent SDK integration
- Cloud model configuration and visible provider toggle
- Embedding-based transcript retrieval and source URLs
- Ship 30 for 30 writing skill
- Safe, functional Markdown/HTML artifact generation and viewer
- Structured logging, automated tests, and clean-clone verification
- 2–3 minute camera-on demo video uploaded to YouTube

## Manual smoke test
1. Open `/api/health` and verify Ollama is available.
2. Start a new chat.
3. Ask a question that is covered by an added transcript and inspect the source card.
4. Ask an unsupported question and check that the model acknowledges the lack of evidence.
5. Start another chat and verify session isolation.
6. Restart the server and verify that the prior session remains stored.
7. Test unavailable Ollama and database failure behavior.
