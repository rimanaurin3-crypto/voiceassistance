# Real-Time Voice Assistant Pipeline

A fully pipelined, latency-instrumented voice assistant with graceful degradation.
Every stage streams output to the next without waiting for completion.

## Architecture

```
Browser                          Backend (FastAPI + asyncio)
┌────────────┐    PCM audio      ┌─────────────────────────────────┐
│ MicCapture  │ ────────────────▶ │ STT (Deepgram Nova-2)          │
│ + VAD       │                  │   │ partial/final transcripts   │
│ + Playback  │                  │   ▼                              │
│ + Dashboard │                  │ LLM (Gemini 2.0 Flash)          │
└────────────┘    audio chunks   │   │ sentence boundaries          │
       ▲                         │   ▼                              │
       │ ◀────────────────────── │ TTS (ElevenLabs Turbo)           │
       WebSocket                 └─────────────────────────────────┘
```

## Stack

- **STT**: Deepgram Nova-2 (WebSocket streaming, partial results)
- **LLM**: Google Gemini 2.0 Flash (streaming via `google-generativeai`)
- **TTS**: ElevenLabs (WebSocket streaming, chunked MP3)
- **Backend**: Python 3.11+ / FastAPI + asyncio WebSocket
- **Frontend**: Vanilla HTML + JS + Web Audio API + Canvas waterfall

## Quick Start

```bash
# 1. Clone and install
cd backend
pip install -r ../requirements.txt

# 2. Set up API keys
cp ../.env.example .env
# Edit .env with your keys

# 3. Run
python -m uvicorn backend.main:app --reload --port 8765

# 4. Open http://localhost:8765 in your browser
```

## Pipeline Stages

| Stage | Service | Mode | Key Feature |
|-------|---------|------|-------------|
| VAD | Browser JS | Energy threshold | ~50ms, no ML |
| STT | Deepgram | WebSocket streaming | Partial results every ~200ms |
| LLM | Gemini 2.0 Flash | SSE streaming | Sentence boundary detection |
| TTS | ElevenLabs | WebSocket streaming | First chunk in ~300ms |

## Degradation Strategy

| Failure | Timeout | Fallback |
|---------|---------|----------|
| STT fails | 2000ms | "I didn't catch that" audio |
| LLM first token slow | 1500ms | "Thinking..." audio, then wait |
| LLM total timeout | 5000ms | Synthesize what's generated |
| TTS fails | 3000ms | Text-only response |
| Any stage (circuit open) | — | Skip to fallback for 60s |

## Latency Budget

| Metric | Target p50 | Target p95 |
|--------|-----------|-----------|
| Total mic → sound | ~1.5s | ~3.5s |

See `docs/latency_budget.md` for per-stage targets.

## Latency Dashboard

Open `http://localhost:8765/dashboard` for:
- Real-time waterfall chart (last 50 turns)
- Per-stage p50/p95/min/max statistics
- Live updates via WebSocket

## Keys & Setup

| Service | Free Tier | Sign Up |
|---------|-----------|---------|
| Deepgram | $200 free credit | https://console.deepgram.com |
| Gemini | Free tier (60 req/min) | https://aistudio.google.com |
| ElevenLabs | 10k chars/month | https://elevenlabs.io |
