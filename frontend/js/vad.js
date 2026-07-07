class EnergyVAD {
    constructor(options = {}) {
        this.threshold = options.threshold || 0.02;
        this.silenceTimeoutMs = options.silenceTimeoutMs || 600;
        this.minSpeechMs = options.minSpeechMs || 250;
        this.cooldownMs = options.cooldownMs || 300;

        this._speaking = false;
        this._speechEnergyStart = 0;
        this._silenceStart = 0;
        this._lastStateChange = 0;

        this._onSpeechStart = options.onSpeechStart || (() => {});
        this._onSpeechEnd = options.onSpeechEnd || (() => {});
        this._onEnergy = options.onEnergy || (() => {});
    }

    process(samples) {
        const energy = this._computeEnergy(samples);
        this._onEnergy(energy);
        const now = performance.now();

        const inCooldown = (now - this._lastStateChange) < this.cooldownMs;

        if (energy > this.threshold) {
            if (!this._speaking) {
                if (this._speechEnergyStart === 0) {
                    this._speechEnergyStart = now;
                } else if (!inCooldown && now - this._speechEnergyStart >= this.minSpeechMs) {
                    this._speaking = true;
                    this._silenceStart = 0;
                    this._speechEnergyStart = 0;
                    this._lastStateChange = now;
                    this._onSpeechStart();
                }
            } else {
                this._silenceStart = 0;
            }
        } else {
            if (this._speaking) {
                if (this._silenceStart === 0) {
                    this._silenceStart = now;
                } else if (!inCooldown && now - this._silenceStart >= this.silenceTimeoutMs) {
                    this._speaking = false;
                    this._silenceStart = 0;
                    this._lastStateChange = now;
                    this._onSpeechEnd();
                }
            } else {
                this._speechEnergyStart = 0;
            }
        }
    }

    _computeEnergy(samples) {
        let sum = 0;
        const len = samples.length;
        for (let i = 0; i < len; i++) {
            sum += samples[i] * samples[i];
        }
        return Math.sqrt(sum / len);
    }

    reset() {
        this._speaking = false;
        this._speechEnergyStart = 0;
        this._silenceStart = 0;
        this._lastStateChange = 0;
    }

    get isSpeaking() {
        return this._speaking;
    }
}
