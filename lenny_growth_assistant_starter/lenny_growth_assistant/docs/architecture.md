# Architecture — Initial implementation

## Components
- Static frontend: `frontend/`
- FastAPI endpoints: `backend/main.py`
- Ollama local generation through its HTTP API
- Transcript file loader and lightweight keyword retrieval
- SQLAlchemy persistence with configurable `DATABASE_URL`
- SQLite is the bootstrap default; configure PostgreSQL before claiming assignment compliance.

## Current endpoints
- `GET /api/health`
- `POST /api/sessions`
- `GET /api/sessions/{session_id}`
- `POST /api/chat`

## Retrieval flow
Load UTF-8 `.txt` files, split into overlapping chunks, rank by keyword overlap, pass top passages to the model, and display the selected source filename and chunk.

## Important implementation gaps to close before submission
1. Replace keyword retrieval with embedding-based retrieval and document indexing/refresh.
2. Configure PostgreSQL and test persistence against it.
3. Add the required Pi Coding Agent SDK or Claude Agent SDK integration.
4. Add cloud provider switching and document fallback behavior.
5. Implement a real essay-generation skill and functional artifact creation/rendering.
6. Add automated tests, structured logs, and clean-clone setup verification.
