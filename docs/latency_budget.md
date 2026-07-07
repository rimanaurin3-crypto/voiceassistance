# Latency Budget

## Target Latency per Stage

| Stage | Target (p50) | Target (p95) | Notes |
|-------|-------------|-------------|-------|
| VAD end-of-speech detection | 0–100ms | 200ms | Energy-threshold in browser |
| STT first partial result | 150–300ms | 500ms | Deepgram Nova-2 streaming |
| STT final transcript | 300–600ms | 900ms | Deepgram end-of-utterance |
| LLM time-to-first-token | 400–800ms | 1500ms | Gemini 2.0 Flash |
| LLM first sentence complete | 800–1500ms | 2500ms | ~10–20 tokens |
| TTS first audio chunk | 200–400ms | 700ms | ElevenLabs WebSocket |
| Audio playback start | +50ms | +100ms | Web Audio API scheduling |
| **Total (mic→sound)** | **~1.5s** | **~3.5s** | Pipelined, not sequential |

## Pipeline Overlap

Because stages run concurrently, total wall-clock time is less than sum of individual stages:

```
Mic ──▶ STT ──▶ LLM ──▶ TTS ──▶ Speaker
        │       │       │
        ▼       ▼       ▼
     partial  token   chunk
```

- STT partial results feed into LLM immediately (no wait for final)
- LLM sentence boundaries trigger TTS immediately (no wait for full response)
- TTS chunks stream to browser as they arrive

## Measurement Method

Each turn is timestamped using `time.monotonic()` at these points:

1. `vad_end` — browser detects silence, last audio sent
2. `stt_first_partial` — first Deepgram partial transcript received
3. `stt_final` — final Deepgram transcript with `speech_final=true`
4. `llm_first_token` — first token from Gemini stream
5. `llm_first_sentence` — first sentence-boundary detected
6. `llm_complete` — full LLM response received
7. `tts_first_chunk` — first audio chunk from ElevenLabs
8. `playback_start` — first audio buffer scheduled in Web Audio API

Timestamps are logged to `logs/session_<id>.jsonl` and displayed in the waterfall dashboard.
