class MicCapture {
    constructor(options = {}) {
        this.onAudio = options.onAudio || (() => {});
        this._stream = null;
        this._audioCtx = null;
        this._processor = null;
        this._source = null;
        this._running = false;
        this.sampleRate = 16000;
    }

    async start() {
        this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this._audioCtx = new AudioCtx({ sampleRate: this.sampleRate });
        if (this._audioCtx.state === 'suspended') {
            await this._audioCtx.resume();
        }
        this.sampleRate = this._audioCtx.sampleRate;

        this._source = this._audioCtx.createMediaStreamSource(this._stream);
        const bufferSize = 4096;
        this._processor = this._audioCtx.createScriptProcessor(bufferSize, 1, 1);
        this._processor.onaudioprocess = (e) => {
            if (!this._running) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm16 = this._float32ToPcm16(input);
            this.onAudio(pcm16, input);
        };
        this._source.connect(this._processor);
        this._running = true;
    }

    stop() {
        this._running = false;
        if (this._processor) {
            this._processor.disconnect();
            this._processor = null;
        }
        if (this._source) {
            this._source.disconnect();
            this._source = null;
        }
        if (this._audioCtx) {
            this._audioCtx.close();
            this._audioCtx = null;
        }
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    }

    _float32ToPcm16(float32) {
        const len = float32.length;
        const buf = new Int16Array(len);
        for (let i = 0; i < len; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return buf.buffer;
    }
}
