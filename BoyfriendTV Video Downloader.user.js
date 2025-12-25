// ==UserScript==
// @name         BoyfriendTV Downloader [Ultimate]
// @namespace    Violentmonkey Scripts
// @version      1.0.0
// @description  Scrip para Download de seguimentos HLS, com interface moderna e polida.
// @author       Parceiro IA & User
// @match        *://*.boyfriendtv.com/videos/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ===================================================================================
    // 0. CONFIGURAÇÕES & DEBUG
    // ===================================================================================
    const CONFIG = {
        MAX_CONCURRENT_DOWNLOADS: 3,
        MAX_RETRIES: 5,
        SEGMENT_TIMEOUT: 15000,
        MIN_SEGMENTS_FOR_ETA: 5
    };

    const debug = {
        log: (tag, msg, err) => console.log(`%c[${tag}]`, 'color: #3b82f6; font-weight: bold;', msg, err || '')
    };

    // ===================================================================================
    // 1. ESTILO VISUAL (Reset Total & Grid Layout)
    // ===================================================================================
    const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        /* Container Raiz - Isolamento total */
        #bftv-root {
            all: initial; /* Reseta tudo que vem do site */
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 16px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            box-sizing: border-box;
        }

        #bftv-root * {
            box-sizing: border-box;
            outline: none;
        }

        /* Variáveis Locais */
        #bftv-root {
            --bg-color: #0f0f0f;
            --surface-color: #1e1e1e;
            --border-color: rgba(255, 255, 255, 0.1);
            --text-primary: #ffffff;
            --text-secondary: #a3a3a3;
            --accent-color: #3b82f6;
            --accent-hover: #2563eb;
            --success-color: #22c55e;
            --error-color: #ef4444;
            --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
        }

        /* Botão Flutuante (FAB) */
        .bftv-fab {
            width: 56px;
            height: 56px;
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 50%;
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-lg);
            transition: transform 0.2s, border-color 0.2s;
        }

        .bftv-fab:hover {
            transform: scale(1.1);
            border-color: var(--accent-color);
            color: var(--accent-color);
        }

        .bftv-fab svg { width: 24px; height: 24px; stroke-width: 2.5; stroke: currentColor; fill: none; }

        /* Painel Principal */
        .bftv-panel {
            width: 400px; /* Largura fixa generosa */
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow-lg);
            display: none;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
        }

        .bftv-panel.active {
            display: flex;
            flex-direction: column;
            opacity: 1;
            transform: translateY(0);
        }

        /* Cabeçalho */
        .bftv-header {
            padding: 16px 20px;
            background-color: var(--surface-color);
            border-bottom: 1px solid var(--border-color);
        }

        .bftv-app-name {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            margin-bottom: 4px;
        }

        .bftv-video-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Lista de Itens */
        .bftv-list {
            padding: 12px;
            max-height: 400px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        /* Scrollbar Customizada */
        .bftv-list::-webkit-scrollbar { width: 6px; }
        .bftv-list::-webkit-scrollbar-track { background: transparent; }
        .bftv-list::-webkit-scrollbar-thumb { background-color: #333; border-radius: 3px; }
        .bftv-list::-webkit-scrollbar-thumb:hover { background-color: #444; }

        /* Card do Item (Grid Layout para estabilidade) */
        .bftv-item {
            position: relative;
            background-color: var(--surface-color);
            border-radius: 8px;
            padding: 14px 16px; /* Padding interno seguro */
            cursor: pointer;
            border: 1px solid transparent;
            transition: background 0.2s;
            overflow: hidden;

            /* GRID: A mágica acontece aqui.
               1fr = texto ocupa o resto.
               auto = status e botão ocupam o necessário. */
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 16px;
            align-items: center;
        }

        .bftv-item:hover {
            background-color: #262626;
            border-color: rgba(255,255,255,0.1);
        }

        /* Barra de progresso (Background) */
        .bftv-progress-bg {
            position: absolute;
            top: 0; left: 0; bottom: 0;
            width: 0%;
            background-color: rgba(59, 130, 246, 0.2);
            z-index: 0;
            transition: width 0.3s linear;
            pointer-events: none;
        }

        /* Área de Texto (Esquerda) */
        .bftv-text-area {
            position: relative; z-index: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0; /* Permite que o texto quebre ou use ellipsis */
        }

        .bftv-res {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .bftv-meta {
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 500;
        }

        /* Área de Ação (Direita) */
        .bftv-action-area {
            position: relative; z-index: 1;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .bftv-status {
            font-size: 12px;
            font-weight: 600;
            color: var(--accent-color);
            text-align: right;
            white-space: nowrap;
        }

        .bftv-btn-icon {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background-color: rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-primary);
            transition: all 0.2s;
        }

        .bftv-btn-icon svg { width: 18px; height: 18px; stroke-width: 2; fill: none; stroke: currentColor; }

        .bftv-item:hover .bftv-btn-icon { background-color: rgba(255, 255, 255, 0.1); color: var(--accent-color); }
        .bftv-item:hover .bftv-btn-icon.cancel-mode { background-color: rgba(239, 68, 68, 0.15); color: var(--error-color); }

        /* Mensagens */
        .bftv-message { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; }
        .bftv-error { color: var(--error-color); }
    `;

    // ===================================================================================
    // 2. LÓGICA DO USUÁRIO (Preservada)
    // ===================================================================================

    // Extractor
    class MediaExtractor {
        constructor() { this.media = { title: 'video', sources: [] }; }
        async extract() {
            this.getTitle();
            await this.extractFromSourcesVar();
            if (this.media.sources.length === 0) { await this.extractFromVideoElement(); }
            if (this.media.sources.length === 0) throw new Error("Nenhum vídeo detectado.");
            this.media.sources = [...new Map(this.media.sources.map(item => [item.url, item])).values()];
            this.media.sources.sort((a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0));
            return this.media;
        }
        getTitle() {
            const el = document.querySelector('h1') || document.querySelector('title');
            this.media.title = (el?.textContent.trim() || 'video').replace(/[^\w\s.-]/gi, '').substring(0, 80);
        }
        extractFromSourcesVar() {
            const match = document.documentElement.innerHTML.match(/var\s+sources\s*=\s*(\[[^]*?\]);/);
            if (!match?.[1]) return;
            try {
                const sourcesArray = JSON.parse(match[1]);
                sourcesArray.forEach(s => s.src && this.media.sources.push({ url: s.src.replace(/\\/g, ''), label: s.desc || 'Auto', type: 'HLS' }));
            } catch (e) { debug.log('Extractor', 'Erro JSON', e); }
        }
        extractFromVideoElement() {
            const video = document.querySelector('video'); if (!video) return;
            const source = video.querySelector('source');
            if (source?.src) { this.media.sources.push({ url: source.src, label: 'Player', type: 'MP4' }); }
            else if (video.src) { this.media.sources.push({ url: video.src, label: 'Player', type: 'MP4' }); }
        }
    }

    // Downloader
    class Downloader {
        constructor(source, title) {
            this.source = source;
            this.title = title;
            this.segments = [];
            this.isCancelled = false;
            this.activeRequests = new Set();
            this._events = {};
            this.resumeKey = `bf-resume-${title.replace(/\s/g, '-')}`;
        }
        on(e, cb) { if (!this._events[e]) this._events[e] = []; this._events[e].push(cb); }
        _emit(e, d) { this._events[e]?.forEach(cb => cb(d)); }

        async start() {
            try {
                if (this.source.type === 'HLS') {
                    const playlist = await this.fetchWithRetry(this.source.url, { responseType: 'text' });
                    this.segments = this.parsePlaylist(playlist, this.source.url);
                } else {
                    this.segments = [{ url: this.source.url, index: 0 }];
                }
                if (this.segments.length === 0) throw new Error("Playlist vazia.");

                const blobs = await this.downloadAllSegments();
                if (this.isCancelled) return;

                this._emit('progress', { percent: 100, message: 'Processando...', speed: 0, eta: 0 });
                const mergedBlob = new Blob(blobs, { type: 'video/mp2t' });
                this.saveFile(mergedBlob);
                await this.clearCompletionState();
            } catch (error) {
                if (!this.isCancelled) this._emit('error', { message: error.message });
            }
        }

        cancel() {
            if (this.isCancelled) return;
            this.isCancelled = true;
            this.activeRequests.forEach(req => req.abort());
            this.activeRequests.clear();
            this._emit('cancelled');
        }

        parsePlaylist(playlist, baseUrl) {
            const base = new URL(baseUrl);
            return playlist.split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => ({ url: new URL(l.trim(), base.href).href, index: i }));
        }

        async downloadAllSegments() {
            const segmentsData = new Array(this.segments.length);
            let downloadedBytes = 0, segmentsCompleted = 0;
            let lastUpdateTime = Date.now(), lastBytes = 0;
            const speeds = [];
            const completionState = await GM_getValue(this.resumeKey, {});
            const queue = this.segments.filter(s => !completionState[s.index]);
            segmentsCompleted = this.segments.length - queue.length;

            const updateProgress = () => {
                if (this.isCancelled) return;
                const now = Date.now();
                if (now - lastUpdateTime > 1000) {
                    const bytesDiff = downloadedBytes - lastBytes;
                    const speed = (bytesDiff / 1024 / 1024) / ((now - lastUpdateTime) / 1000);
                    if (speed > 0) speeds.push(speed); if (speeds.length > 5) speeds.shift();
                    const avgSpeed = speeds.length ? speeds.reduce((a,b)=>a+b,0)/speeds.length : 0;

                    this._emit('progress', {
                        percent: Math.round((segmentsCompleted / this.segments.length) * 100),
                        speed: avgSpeed
                    });
                    lastUpdateTime = now;
                    lastBytes = downloadedBytes;
                }
            };

            const worker = async () => {
                while (queue.length > 0) {
                    if (this.isCancelled) throw new Error('Cancelado');
                    const seg = queue.shift();
                    try {
                        const blob = await this.fetchWithRetry(seg.url, { responseType: 'blob' });
                        segmentsData[seg.index] = blob;
                        downloadedBytes += blob.size;
                        segmentsCompleted++;
                        updateProgress();
                    } catch (e) {
                        if (!this.isCancelled) queue.unshift(seg);
                        throw e;
                    }
                }
            };

            try { await Promise.all(Array.from({ length: CONFIG.MAX_CONCURRENT_DOWNLOADS }, worker)); } catch(e) { if(this.isCancelled) return null; throw e; }
            if (this.isCancelled) return null;
            return segmentsData;
        }

        fetchWithRetry(url, options, retries = CONFIG.MAX_RETRIES) {
            return new Promise((resolve, reject) => {
                let attempt = 0;
                const req = () => {
                    if (this.isCancelled) return reject(new Error('Cancelado'));
                    attempt++;
                    const r = GM_xmlhttpRequest({
                        method: 'GET', url, ...options, timeout: CONFIG.SEGMENT_TIMEOUT,
                        onload: (res) => {
                            this.activeRequests.delete(r);
                            if (res.status >= 200 && res.status < 300) resolve(res.response);
                            else if (attempt < retries) setTimeout(req, 1000 * attempt);
                            else reject(new Error(`HTTP ${res.status}`));
                        },
                        onerror: () => { this.activeRequests.delete(r); if(attempt < retries && !this.isCancelled) setTimeout(req, 1000*attempt); else reject(new Error('Rede')); },
                        ontimeout: () => { this.activeRequests.delete(r); if(attempt < retries && !this.isCancelled) setTimeout(req, 1000*attempt); else reject(new Error('Timeout')); },
                        onabort: () => { this.activeRequests.delete(r); reject(new Error('Cancelado')); }
                    });
                    this.activeRequests.add(r);
                };
                req();
            });
        }

        saveFile(blob) {
            const url = URL.createObjectURL(blob);
            const name = `${this.title}.ts`;
            GM_notification({ title: 'Download Concluído', text: 'Salvando arquivo...', timeout: 2000 });
            this._emit('success', {});
            try {
                if (typeof GM_download === 'function') GM_download({ url, name, saveAs: true, onload: () => URL.revokeObjectURL(url) });
                else { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 100); }
            } catch(e) { console.error(e); }
        }
        async clearCompletionState() { await GM_deleteValue(this.resumeKey); }
    }

    // ===================================================================================
    // 3. INTERFACE (UI Grid Layout)
    // ===================================================================================
    class BFTVInterface {
        constructor() {
            this.extractor = new MediaExtractor();
            this.activeDownloads = new Map();
            this.hasExtracted = false;
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                window.addEventListener('load', () => this.inject());
            } else {
                this.inject();
            }
        }

        inject() {
            GM_addStyle(STYLES);

            // Raiz isolada
            this.root = document.createElement('div');
            this.root.id = 'bftv-root';

            // Painel
            this.panel = document.createElement('div');
            this.panel.className = 'bftv-panel';
            this.panel.innerHTML = `
                <div class="bftv-header">
                    <div class="bftv-app-name">Download Manager</div>
                    <div class="bftv-video-title" id="bftv-title-display">...</div>
                </div>
                <div class="bftv-list" id="bftv-list">
                    <div class="bftv-message">Toque no ícone para carregar.</div>
                </div>
            `;

            // Botão
            const fab = document.createElement('div');
            fab.className = 'bftv-fab';
            fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
            fab.onclick = () => this.togglePanel();

            this.root.appendChild(this.panel);
            this.root.appendChild(fab);
            document.body.appendChild(this.root);
        }

        togglePanel() {
            if (this.panel.classList.contains('active')) {
                this.panel.classList.remove('active');
            } else {
                this.panel.classList.add('active');
                if (!this.hasExtracted) this.scan();
            }
        }

        async scan() {
            const list = document.getElementById('bftv-list');
            list.innerHTML = `<div class="bftv-message">Analisando página...</div>`;

            try {
                const data = await this.extractor.extract();
                this.hasExtracted = true;

                document.getElementById('bftv-title-display').textContent = data.title;
                list.innerHTML = '';

                data.sources.forEach(source => this.renderRow(list, source, data.title));
            } catch (e) {
                list.innerHTML = `<div class="bftv-message bftv-error">${e.message}</div>`;
            }
        }

        renderRow(container, source, title) {
            const item = document.createElement('div');
            item.className = 'bftv-item';

            const iconDownload = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
            const iconCancel = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

            item.innerHTML = `
                <div class="bftv-progress-bg"></div>
                <div class="bftv-text-area">
                    <span class="bftv-res">${source.label}</span>
                    <span class="bftv-meta">${source.type}</span>
                </div>
                <div class="bftv-action-area">
                    <span class="bftv-status" data-role="status">Baixar</span>
                    <div class="bftv-btn-icon" data-role="btn">${iconDownload}</div>
                </div>
            `;

            const btn = item.querySelector('[data-role="btn"]');
            const status = item.querySelector('[data-role="status"]');
            const progress = item.querySelector('.bftv-progress-bg');

            const reset = () => {
                progress.style.width = '0%';
                status.textContent = 'Cancelado';
                status.style.color = 'var(--text-secondary)';
                btn.innerHTML = iconDownload;
                btn.classList.remove('cancel-mode');
            };

            item.onclick = (e) => {
                if (this.activeDownloads.has(source.url)) {
                    this.activeDownloads.get(source.url).cancel();
                    return;
                }

                // Iniciar Download
                const dl = new Downloader(source, `${title}_${source.label}`);
                this.activeDownloads.set(source.url, dl);

                btn.innerHTML = iconCancel;
                btn.classList.add('cancel-mode');
                status.textContent = 'Iniciando...';
                status.style.color = 'var(--accent-color)';

                dl.on('progress', (d) => {
                    progress.style.width = `${d.percent}%`;
                    status.textContent = d.speed > 0 ? `${d.percent}% (${d.speed.toFixed(1)} MB/s)` : `${d.percent}%`;
                });

                dl.on('cancelled', () => {
                    this.activeDownloads.delete(source.url);
                    reset();
                });

                dl.on('error', (d) => {
                    this.activeDownloads.delete(source.url);
                    status.textContent = 'Erro';
                    status.style.color = 'var(--error-color)';
                    alert(d.message);
                    reset();
                });

                dl.on('success', () => {
                    this.activeDownloads.delete(source.url);
                    status.textContent = 'Salvo!';
                    status.style.color = 'var(--success-color)';
                    progress.style.width = '100%';
                    progress.style.background = 'rgba(34, 197, 94, 0.2)';
                    btn.innerHTML = iconDownload;
                    btn.classList.remove('cancel-mode');
                });

                dl.start();
            };

            container.appendChild(item);
        }
    }

    new BFTVInterface();

})();
