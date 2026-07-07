import asyncio
import json
import logging
import uuid

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.live_session import GeminiLiveSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice Assistant - Gemini Live API")
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def get_index():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.get("/dashboard")
async def get_dashboard():
    with open("frontend/dashboard.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = str(uuid.uuid4())[:8]

    live = GeminiLiveSession()
    receive_task: asyncio.Task = None

    async def forward_events_to_ws():
        try:
            async for event in live.receive_events():
                try:
                    if event["type"] == "assistant_audio":
                        audio_b64 = __import__("base64").b64encode(event["audio"]).decode()
                        await ws.send_json({
                            "type": "assistant_audio",
                            "audio": audio_b64,
                            "mime_type": event["mime_type"],
                        })
                    else:
                        await ws.send_json(event)
                except Exception:
                    break
        except Exception:
            pass

    try:
        logger.info("Connecting Gemini Live session [%s]", session_id)
        await live.connect()
        await ws.send_json({"type": "connected", "session_id": session_id})

        receive_task = asyncio.create_task(forward_events_to_ws())

        while True:
            raw = await ws.receive()
            msg_type = raw.get("type", "")

            if msg_type == "websocket.disconnect":
                break

            if "bytes" in raw:
                await live.send_audio(raw["bytes"])
                continue

            text = raw.get("text")
            if text is None:
                continue

            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                continue

            cmd = msg.get("type")

            if cmd == "text_message":
                text_content = msg.get("text", "").strip()
                if text_content:
                    await live.send_text(text_content)



    except WebSocketDisconnect:
        logger.info("WebSocket disconnected [%s]", session_id)
    except Exception as e:
        logger.error("WS error [%s]: %s", session_id, e)
        try:
            await ws.send_json({"type": "error", "text": str(e)})
        except Exception:
            pass
    finally:
        if receive_task:
            receive_task.cancel()
            try:
                await receive_task
            except Exception:
                pass
        await live.close()
