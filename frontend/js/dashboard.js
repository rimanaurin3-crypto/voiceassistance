class LatencyDashboard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.turns = [];
        this._statsWs = null;
        this._initCanvas();
    }

    _initCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width || 900;
        this.canvas.height = 600;
    }

    addTurn(turnData) {
        this.turns.push(turnData);
        if (this.turns.length > 50) this.turns.shift();
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (this.turns.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for data...', w / 2, h / 2);
            return;
        }

        const margin = { top: 40, right: 30, bottom: 50, left: 160 };
        const chartW = w - margin.left - margin.right;
        const chartH = h - margin.top - margin.bottom;

        let maxLatency = 0;
        for (const turn of this.turns) {
            const total = turn.elapsed_ms?.total_mic_to_sound || 0;
            if (total > maxLatency) maxLatency = total;
        }
        maxLatency = Math.max(maxLatency, 100);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '11px monospace';

        for (let ms = 0; ms <= maxLatency; ms += Math.ceil(maxLatency / 10 / 100) * 100) {
            const x = margin.left + (ms / maxLatency) * chartW;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + chartH);
            ctx.stroke();
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText(ms + 'ms', x, margin.top + chartH + 16);
        }

        ctx.font = '10px monospace';
        const barH = Math.min(20, (chartH - 10) / this.turns.length - 2);
        const colors = {
            'vad_to_stt_partial': '#4CAF50',
            'vad_to_stt_final': '#8BC34A',
            'stt_to_llm_first_token': '#2196F3',
            'llm_first_token_to_first_sentence': '#FF9800',
            'llm_to_tts_first_chunk': '#9C27B0',
            'total_mic_to_sound': '#F44336',
        };
        const labels = {
            'vad_to_stt_partial': '→ STT partial',
            'vad_to_stt_final': '→ STT final',
            'stt_to_llm_first_token': '→ LLM first token',
            'llm_first_token_to_first_sentence': '→ LLM first sentence',
            'llm_to_tts_first_chunk': '→ TTS first chunk',
            'total_mic_to_sound': 'Total',
        };

        const stageOrder = [
            'vad_to_stt_partial', 'vad_to_stt_final', 'stt_to_llm_first_token',
            'llm_first_token_to_first_sentence', 'llm_to_tts_first_chunk', 'total_mic_to_sound'
        ];

        for (let i = 0; i < this.turns.length; i++) {
            const turn = this.turns[i];
            const y = margin.top + i * (barH + 4);
            ctx.fillStyle = '#555';
            ctx.textAlign = 'right';
            ctx.fillText(turn.turn_id, margin.left - 8, y + barH / 2 + 3);

            let cumulative = 0;
            for (const stage of stageOrder) {
                const val = turn.elapsed_ms?.[stage];
                if (val == null) continue;
                const x = margin.left + (cumulative / maxLatency) * chartW;
                const bw = (val / maxLatency) * chartW;
                ctx.fillStyle = colors[stage] || '#ccc';
                ctx.fillRect(x, y, bw, barH);
                cumulative += val;
            }
        }

        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        let legendY = margin.top + Math.min(this.turns.length * (barH + 4), chartH) + 30;
        let legendX = margin.left;
        for (const stage of stageOrder) {
            ctx.fillStyle = colors[stage] || '#ccc';
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.fillStyle = '#ccc';
            ctx.fillText(labels[stage] || stage, legendX + 18, legendY + 10);
            legendX += ctx.measureText(labels[stage] || stage).width + 40;
            if (legendX > w - margin.right - 100) {
                legendX = margin.left;
                legendY += 20;
            }
        }
    }

    connectLive(wsUrl) {
        this._statsWs = new WebSocket(wsUrl);
        this._statsWs.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                if (data.type === 'latency_report' || data.elapsed_ms) {
                    this.addTurn(data);
                }
            } catch (e) { }
        };
    }
}
