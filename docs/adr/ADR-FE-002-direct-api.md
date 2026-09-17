# ADR-FE-002 — Direct FastAPI calls + CORS
Status: Frozen. Frontend calls FastAPI directly via NEXT_PUBLIC_ECORACE_API_URL.
No Next.js proxy in MVP. FastAPI configures CORS allowlist (Phase 3).
Single typed client: frontend/src/lib/api-client.ts.
