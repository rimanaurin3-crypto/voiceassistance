class VoiceWebSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.onMessage = null;
        this.onOpen = null;
        this.onClose = null;
        this._sendQueue = [];
        this._connected = false;
    }

    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            this._connected = true;
            for (const msg of this._sendQueue) {
                this.ws.send(msg);
            }
            this._sendQueue = [];
            if (this.onOpen) this.onOpen();
        };

        this.ws.onclose = (ev) => {
            this._connected = false;
            if (this.onClose) this.onClose(ev);
        };

        this.ws.onerror = (err) => {
            console.error('WS error:', err);
        };

        this.ws.onmessage = (ev) => {
            if (this.onMessage) {
                if (ev.data instanceof ArrayBuffer) {
                    this.onMessage({ type: 'audio', data: ev.data });
                } else {
                    try {
                        const json = JSON.parse(ev.data);
                        this.onMessage(json);
                    } catch (e) {
                        console.warn('WS non-JSON message:', ev.data);
                    }
                }
            }
        };
    }

    sendAudio(chunk) {
        if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(chunk);
        } else {
            this._sendQueue.push(chunk);
        }
    }

    sendJson(obj) {
        const msg = JSON.stringify(obj);
        if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(msg);
        } else {
            this._sendQueue.push(msg);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._connected = false;
    }

    get connected() {
        return this._connected;
    }
}
