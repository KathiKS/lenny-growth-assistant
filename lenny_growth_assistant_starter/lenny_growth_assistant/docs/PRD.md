# Product Requirements Document — The Lenny Growth Assistant

## User and problem
Product and growth teams need to find reliable, reusable insights in Lenny's Podcast transcripts without manually searching long documents or writing complex prompts.

## Success metrics (initial targets)
- At least 90% of tested answer claims are supported by displayed transcript passages in a manually reviewed evaluation set.
- 100% of answers with retrieved passages expose source filenames in the UI.
- A fresh evaluator can start the application using only the README.
- Unsupported questions produce an explicit uncertainty statement instead of invented citations.

## Assumptions
- Transcript files are supplied from a source the developer is permitted to access and use.
- Local Ollama is the required demonstration provider.
- The first version uses a small local model to fit a low-memory Windows computer.
- PostgreSQL is the target persistence database; SQLite may be used only for initial bootstrapping.

## Scope
Included: chat, sessions, transcript retrieval, source references, local model, writing skill, artifact preview, tests, deployment and handoff docs.
Excluded initially: user accounts, multi-tenant access control, production-scale ingestion, and public hosting.

## Risks and trade-offs
Local model quality and latency; incomplete transcript coverage; retrieval misses; hallucinations; secrets leakage; unsafe generated HTML; database/network failures.

## Acceptance criteria
See README.md manual test plan and docs/architecture.md.
