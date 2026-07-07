class AudioPlayback {
    constructor(options = {}) {
        this._audioCtx = null;
        this._gainNode = null;
        this._bufferQueue = [];
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

    enqueue(audioData) {
        if (!this._audioCtx) return;
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume();
        }
        this._audioCtx.decodeAudioData(audioData, (buffer) => {
            this._bufferQueue.push(buffer);
            this._scheduleNext();
        });
    }

    _scheduleNext() {
        if (this._playing || this._bufferQueue.length === 0) return;
        this._playing = true;
        if (this._nextTime < this._audioCtx.currentTime) {
            this._nextTime = this._audioCtx.currentTime + 0.05;
        }
        while (this._bufferQueue.length > 0) {
            const buffer = this._bufferQueue.shift();
            const source = this._audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this._gainNode);
            source.start(this._nextTime);
            this._nextTime += buffer.duration;
            source.onended = () => {
                if (this._bufferQueue.length === 0 && this._nextTime <= this._audioCtx.currentTime) {
                    this._playing = false;
                    this._onDone();
                }
            };
        }
    }

    stop() {
        this._bufferQueue = [];
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
        this._playing = false;
        this._nextTime = 0;
    }
}
