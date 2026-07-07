import asyncio
import logging
from typing import AsyncGenerator, Optional

import google.genai as genai
from google.genai import types

from backend.config import settings

logger = logging.getLogger(__name__)


class GeminiLiveSession:
    def __init__(self):
        self._session: Optional[genai.live.AsyncSession] = None
        self._client: Optional[genai.Client] = None
        self._cm = None
        self._connected = False
        self._receive_task: Optional[asyncio.Task] = None
        self._event_queue: asyncio.Queue = asyncio.Queue()

    async def connect(self):
        if self._connected:
            return

        self._client = genai.Client(api_key=settings.gemini_api_key)

        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )

        self._cm = self._client.aio.live.connect(
            model=settings.gemini_live_model,
            config=config,
        )

        self._session = await self._cm.__aenter__()
        self._connected = True
        logger.info("Gemini Live session started")

        self._receive_task = asyncio.create_task(self._receive_loop())

    async def _receive_loop(self):
        try:
            async for msg in self._session.receive():
                if msg.setup_complete:
                    logger.info("Gemini Live setup complete")

                if msg.server_content:
                    sc = msg.server_content

                    if sc.input_transcription:
                        text = sc.input_transcription.text
                        if text:
                            await self._event_queue.put(
                                {"type": "user_transcript", "text": text}
                            )

                    if sc.model_turn:
                        for part in sc.model_turn.parts:
                            if part.text:
                                await self._event_queue.put(
                                    {"type": "assistant_text", "text": part.text}
                                )
                            if part.inline_data and part.inline_data.data:
                                await self._event_queue.put({
                                    "type": "assistant_audio",
                                    "audio": part.inline_data.data,
                                    "mime_type": part.inline_data.mime_type or "audio/pcm",
                                })

                    if sc.turn_complete:
                        await self._event_queue.put({"type": "turn_complete"})
                    if sc.interrupted:
                        await self._event_queue.put({"type": "turn_interrupted"})

                if msg.voice_activity:
                    vad = msg.voice_activity
                    if vad.activity_start:
                        await self._event_queue.put({"type": "vad_start"})
                    if vad.activity_end:
                        await self._event_queue.put({"type": "vad_end"})

                if msg.tool_call:
                    await self._event_queue.put(
                        {"type": "tool_call", "calls": msg.tool_call.function_calls}
                    )

        except Exception as e:
            logger.error("Gemini Live receive error: %s", e)
            await self._event_queue.put({"type": "error", "text": str(e)})

    async def send_audio(self, audio_bytes: bytes):
        if not self._session:
            return
        blob = types.Blob(data=audio_bytes, mime_type=f"audio/pcm;rate={settings.audio_sample_rate}")
        await self._session.send_realtime_input(audio=blob)

    async def send_text(self, text: str):
        if not self._session:
            return
        await self._session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text=text)]),
            turn_complete=True,
        )

    async def send_audio_end(self):
        if not self._session:
            return
        await self._session.send_realtime_input(audio_stream_end=True)

    async def receive_events(self) -> AsyncGenerator[dict, None]:
        while self._connected or not self._event_queue.empty():
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=0.5)
                yield event
            except asyncio.TimeoutError:
                continue

    async def close(self):
        self._connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except Exception:
                pass
            self._receive_task = None
        if self._cm:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception:
                pass
            self._cm = None
        self._session = None
        self._client = None
        logger.info("Gemini Live session closed")
