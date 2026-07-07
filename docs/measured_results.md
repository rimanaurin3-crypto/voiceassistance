# Measured Results

> Fill in after running the assistant.

## Baseline (Phase 1 — Sequential)

| Stage | p50 | p95 | Samples | Notes |
|-------|-----|-----|---------|-------|
| VAD → STT partial | | | | |
| VAD → STT final | | | | |
| STT → LLM first token | | | | |
| LLM first token → sentence | | | | |
| LLM sentence → TTS chunk | | | | |
| Total mic → sound | | | | |

## Streaming (Phase 2 — Full Pipeline)

| Stage | p50 | p95 | Samples | vs Baseline |
|-------|-----|-----|---------|-------------|
| VAD → STT partial | | | | |
| VAD → STT final | | | | |
| STT → LLM first token | | | | |
| LLM first token → sentence | | | | |
| LLM sentence → TTS chunk | | | | |
| Total mic → sound | | | | |

## Divergence from Budget

| Stage | Target p50 | Measured p50 | Δ | Notes |
|-------|-----------|-------------|---|-------|
| STT first partial | 300ms | | | |
| STT final | 600ms | | | |
| LLM TTFT | 800ms | | | |
| LLM first sentence | 1500ms | | | |
| TTS first chunk | 400ms | | | |
| Total | 1500ms | | | |
