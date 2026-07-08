class AudioPlayback {
    constructor(options = {}) {
        this._audioCtx = null;
        this._gainNode = null;
        this._bufferQueue = [];
        this._activeSources = [];
        this._playing = false;
        this._nextTime = 0;
        this._onDone = options.onDone || (() => {});
        this._onBargeIn = options.onBargeIn || (() => {});
    }

    async init() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this._audioCtx = new AudioCtx();
        if (this._audioCtx.state === 'suspended') {
            await this._audioCtx.resume();
        }
        this._gainNode = this._audioCtx.createGain();
        this._gainNode.gain.value = 1.0;
        this._gainNode.connect(this._audioCtx.destination);
    }

    enqueue(audioData, mimeType = '') {
        if (!this._audioCtx) return;
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume();
        }

        // Determine sample rate (default to 24000 Hz for Gemini Live audio)
        let sampleRate = 24000;
        if (mimeType && mimeType.includes('rate=')) {
            const match = mimeType.match(/rate=(\d+)/);
            if (match) {
                sampleRate = parseInt(match[1], 10);
            }
        }

        try {
            // Parse raw PCM (Int16, little-endian)
            const int16Array = new Int16Array(audioData);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }

            // Create an AudioBuffer and copy the Float32 samples
            const buffer = this._audioCtx.createBuffer(1, float32Array.length, sampleRate);
            buffer.copyToChannel(float32Array, 0);

            this._bufferQueue.push(buffer);
            this._scheduleNext();
        } catch (err) {
            console.error('Error queuing raw PCM audio:', err);
        }
    }

    _scheduleNext() {
        if (!this._audioCtx) return;

        if (this._nextTime < this._audioCtx.currentTime) {
            this._nextTime = this._audioCtx.currentTime + 0.05;
        }

        while (this._bufferQueue.length > 0) {
            const buffer = this._bufferQueue.shift();
            const source = this._audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this._gainNode);

            this._activeSources.push(source);
            source.start(this._nextTime);
            this._nextTime += buffer.duration;

            source.onended = () => {
                this._activeSources = this._activeSources.filter(s => s !== source);
                if (this._activeSources.length === 0 && this._bufferQueue.length === 0) {
                    this._playing = false;
                    this._onDone();
                }
            };
        }
        this._playing = true;
    }

    stop() {
        this._bufferQueue = [];
        for (const source of this._activeSources) {
            try {
                source.stop();
            } catch (e) {}
        }
        this._activeSources = [];
        this._playing = false;
        this._nextTime = 0;
        if (this._audioCtx && this._audioCtx.state !== 'closed') {
            this._audioCtx.close().then(() => {
                this._audioCtx = null;
            });
        }
    }

    bargeIn() {
        this._bufferQueue = [];
        for (const source of this._activeSources) {
            try {
                source.stop();
            } catch (e) {}
        }
        this._activeSources = [];
        this._playing = false;
        this._nextTime = 0;
        this._onBargeIn();
    }
}
