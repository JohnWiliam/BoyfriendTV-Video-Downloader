// ==UserScript==
// @name         BoyfriendTV Video Downloader
// @namespace    Violentmonkey Scripts
// @version      1.0.0
// @description  BoyfriendTV Video Downloader
// @author       John Wiliam & IA
// @match        https://www.boyfriendtv.com/videos/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ===================================================================================
    // 1. CONFIGURAÇÕES GLOBAIS E UTILITÁRIOS
    // ===================================================================================
    const CONFIG = {
        DOWNLOAD_BUTTON_ID: 'bf-downloader-btn',
        MODAL_ID: 'bf-downloader-modal',
        MAX_RETRIES: 5,
        SEGMENT_TIMEOUT: 20000,
        MAX_CONCURRENT_DOWNLOADS: 6,
        PROGRESS_UPDATE_INTERVAL: 300,
        MIN_SEGMENTS_FOR_ETA: 5,
        DEBUG: false
    };

    function throttle(fn, ms) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, ms);
            }
        };
    }

    // ===================================================================================
    // 2. CLASSE DE DEBUG
    // ===================================================================================
    class Debugger {
        log(stage, message, data = null) {
            if (CONFIG.DEBUG) {
                console.log(`[BF-DL DEBUG] ${stage}: ${message}`, data);
            }
        }
    }
    const debug = new Debugger();

    // ===================================================================================
    // 3. UIManager: Gerencia toda a interface do usuário
    // ===================================================================================
    class UIManager {
        constructor() {
            this.modal = null;
            this.isMinimized = false;
            this.activeDownloader = null;
            this.mediaCache = null;
            this.updateProgress = throttle(this._updateProgress.bind(this), CONFIG.PROGRESS_UPDATE_INTERVAL);
            this.init();
        }

        init() {
            this.createDownloadButton();
            this.injectStyles();
        }

        createDownloadButton() {
            if (document.getElementById(CONFIG.DOWNLOAD_BUTTON_ID)) return;
            const button = document.createElement('button');
            button.id = CONFIG.DOWNLOAD_BUTTON_ID;
            button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Baixar Vídeo`;
            button.onclick = () => this.showResolutionModal();
            document.body.appendChild(button);
        }

        async showResolutionModal() {
            if (this.isMinimized) this.toggleMinimize();
            this.render("loading", { message: 'Buscando qualidades disponíveis...' });
            try {
                if (!this.mediaCache) this.mediaCache = await new MediaExtractor().extract();
                const media = this.mediaCache;
                if (!media.sources || media.sources.length === 0) throw new Error("Nenhuma fonte de vídeo foi detectada.");
                this.render("resolutions", { title: media.title, sources: media.sources });
            } catch (error) {
                this.render("error", { message: error.message, onRetry: () => this.showResolutionModal() });
            }
        }

        startDownload(source, title) {
            this.activeDownloader = new Downloader(source, title);
            this.activeDownloader.on('progress', (data) => this.updateProgress(data));
            this.activeDownloader.on('success', (data) => { this.render("success", data); this.activeDownloader = null; });
            this.activeDownloader.on('error', (data) => { this.render("error", { message: data.message, onRetry: () => this.startDownload(source, title) }); this.activeDownloader = null; });
            this.activeDownloader.on('cancelled', () => { this.render("cancelled"); this.activeDownloader = null; });
            this.activeDownloader.start();
            this.render("loading", { message: 'Preparando download...' });
        }

        _updateProgress(data) {
            if (!this.modal || this.modal.style.display === 'none') this.render("loading", { message: 'Preparando download...'});
            this.render("progress", data);
        }

        render(state, data = {}) {
            this.createModal();
            let title = "Download";
            let mainHTML = "", minimizedHTML = "";

            switch(state) {
                case "loading": title = "Aguarde..."; mainHTML = `<div class="loader-container"><div class="loader"></div><p>${data.message}</p></div>`; break;
                case "resolutions": title = data.title; mainHTML = `<h3>Selecione a Qualidade</h3><div class="quality-grid">${data.sources.map((s, i) => `<div class="quality-option" data-index="${i}"><div class="quality-label">${s.label}</div><div class="quality-badge">${s.type.toUpperCase()}</div></div>`).join('')}</div>`; break;
                case "progress":
                    title = "Download em Progresso";
                    const { percent, message, speed, eta } = data;
                    const speedF = this.formatSpeed(speed), etaF = (eta && percent < 100) ? `ETA: ${this.formatEta(eta)}` : '';
                    mainHTML = `<div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:${percent}%;"></div></div><div class="progress-info"><span>${percent}%</span><span>${message}</span></div></div><div class="speed-info">${speedF} ${etaF}</div><button class="cancel-button">Cancelar Download</button>`;
                    minimizedHTML = `<div class="minimized-progress-bar" style="width:${percent}%;"></div><div class="minimized-info">Download ${percent}%</div>`;
                    break;
                case "success": title = "Sucesso!"; mainHTML = `<div class="status-message"><h3>Download Concluído!</h3><p><strong>${data.title}.ts</strong> (${this.formatFileSize(data.fileSize)})</p></div>`; break;
                case "error": title = "Erro"; mainHTML = `<div class="status-message"><h3>Falha no Download</h3><p>${data.message}</p></div><button class="retry-button">Tentar Novamente</button>`; break;
                case "cancelled": title = "Cancelado"; mainHTML = `<div class="status-message"><h3>Download Cancelado</h3></div>`; break;
            }
            this.updateModalContent(mainHTML, minimizedHTML, title);
            this.showModal();
        }

        handleModalClick(event) {
            const target = event.target;
            const modalContent = target.closest('.modal-content');
            if (modalContent?.classList.contains('minimized')) { this.toggleMinimize(); }
            else if (target.closest('.close-button') || event.target === this.modal) { this.activeDownloader?.cancel(); this.hideModal(); }
            else if (target.closest('.minimize-button')) { this.toggleMinimize(); }
            else if (target.closest('.cancel-button')) { this.activeDownloader?.cancel(); }
            else if (target.closest('.retry-button')) { this.showResolutionModal(); }
            else if (target.closest('.quality-option')) {
                const option = target.closest('.quality-option');
                const sourceIndex = parseInt(option.dataset.index, 10);
                const selectedSource = this.mediaCache.sources[sourceIndex];
                this.startDownload(selectedSource, this.mediaCache.title);
            }
        }

        createModal() {
            if (this.modal) return;
            this.modal = document.createElement('div');
            this.modal.id = CONFIG.MODAL_ID;
            this.modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h2 class="modal-title"></h2><div class="modal-controls"><span class="minimize-button">&minus;</span><span class="close-button">&times;</span></div></div><div class="modal-main"></div><div class="minimized-view"></div></div>`;
            document.body.appendChild(this.modal);
            this.modal.addEventListener('click', this.handleModalClick.bind(this));
        }

        updateModalContent(mainHTML, minimizedHTML = '', title) {
            this.modal.querySelector('.modal-title').textContent = title;
            this.modal.querySelector('.modal-main').innerHTML = mainHTML;
            this.modal.querySelector('.minimized-view').innerHTML = minimizedHTML;
        }

        toggleMinimize() {
            this.isMinimized = !this.isMinimized;
            this.modal.classList.toggle('overlay-inactive', this.isMinimized);
            this.modal.querySelector('.modal-content').classList.toggle('minimized', this.isMinimized);
        }

        showModal() { if (!this.modal) this.createModal(); this.modal.style.display = 'flex'; setTimeout(() => this.modal.classList.add('visible'), 10); }
        hideModal() { if (!this.modal) return; this.modal.classList.remove('visible'); setTimeout(() => { this.modal.style.display = 'none'; this.modal.remove(); this.modal = null; }, 300); }

        formatSpeed(s) { return (s < 1024 ? `${s.toFixed(1)} B/s` : s < 1048576 ? `${(s/1024).toFixed(1)} KB/s` : `${(s/1048576).toFixed(1)} MB/s`); }
        formatFileSize(b) { return (b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : b < 1073741824 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1073741824).toFixed(1)} GB`); }
        formatEta(s) { return (s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s/60)}m ${Math.round(s%60)}s` : `${Math.floor(s/3600)}h ${Math.round((s%3600)/60)}m`); }

        injectStyles() { GM_addStyle(`:root{--brand-1:#6a11cb;--brand-2:#2575fc;--accent:#4cc9f0;--success:#2ecc71;--error:#e74c3c;--text:#f1f1f1;--bg-1:#1e2a3a;--bg-2:#141e30;--radius:16px}#${CONFIG.DOWNLOAD_BUTTON_ID}{position:fixed;right:20px;bottom:20px;z-index:9999;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;width:180px;background:linear-gradient(135deg,var(--brand-1),var(--brand-2));color:white;border:none;border-radius:30px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(37,117,252,.3);transition:all .3s;transform:translateZ(0)}#${CONFIG.DOWNLOAD_BUTTON_ID}:hover{transform:translateY(-3px) translateZ(0);box-shadow:0 8px 20px rgba(37,117,252,.45)}#${CONFIG.MODAL_ID}{display:none;position:fixed;z-index:10000;inset:0;background-color:rgba(0,0,0,.5);justify-content:center;align-items:center;font-family:'Segoe UI',sans-serif;opacity:0;transition:opacity .3s ease;backdrop-filter:blur(5px)}#${CONFIG.MODAL_ID}.visible{opacity:1}#${CONFIG.MODAL_ID}.overlay-inactive{background:transparent;backdrop-filter:none;pointer-events:none;align-items:flex-end;justify-content:flex-end}#${CONFIG.MODAL_ID}.overlay-inactive .modal-content{pointer-events:auto}.modal-content{background:linear-gradient(145deg,var(--bg-1),var(--bg-2));color:var(--text);padding:0;border-radius:var(--radius);width:90%;max-width:500px;box-shadow:0 10px 40px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);transform:scale(.95);transition:all .3s;display:flex;flex-direction:column;max-height:90vh;will-change:transform,opacity;contain:content}#${CONFIG.MODAL_ID}.visible .modal-content{transform:scale(1)}.modal-header{padding:20px 25px;border-bottom:1px solid rgba(255,255,255,.1);position:relative;flex-shrink:0}.modal-title{margin:0;font-size:1.5rem;text-align:center;color:var(--accent)}.modal-main{padding:20px 25px;overflow-y:auto;text-align:center}.modal-controls{position:absolute;top:50%;right:25px;transform:translateY(-50%);display:flex;gap:8px}.close-button,.minimize-button{font-size:28px;cursor:pointer;transition:all .2s}.close-button:hover,.minimize-button:hover{color:white;transform:scale(1.1)}.quality-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:15px}.quality-option{background:rgba(255,255,255,.05);border-radius:10px;padding:15px;text-align:center;cursor:pointer;border:1px solid rgba(255,255,255,.1);transition:all .3s ease;transform:translateZ(0)}.quality-option:hover{transform:translateY(-5px) translateZ(0);background:rgba(37,117,252,.15);border-color:rgba(37,117,252,.5)}.quality-label,.quality-badge{pointer-events:none}.loader{border:4px solid rgba(255,255,255,.1);border-top:4px solid var(--accent);border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:20px auto}.progress-info{display:flex;justify-content:space-between;margin-top:8px;font-size:.9em;padding:0 5px}.progress-bar{height:12px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden;margin-top:8px}.progress-fill{height:100%;background:linear-gradient(90deg,var(--brand-1),var(--brand-2));border-radius:6px;transition:width .4s ease-out}.speed-info{text-align:center;color:var(--accent);margin-top:10px;height:1.2em}.cancel-button,.retry-button{display:block;width:100%;padding:12px;font-weight:600;cursor:pointer;border-radius:8px;margin-top:20px;border:1px solid;transition:all .3s;background:rgba(231,76,60,.15);color:var(--error);border-color:rgba(231,76,60,.3)}.retry-button{background:rgba(46,204,113,.15);color:var(--success);border-color:rgba(46,204,113,.3)}.cancel-button:hover{background:rgba(231,76,60,.25)}.retry-button:hover{background:rgba(46,204,113,.25)}.status-message{text-align:center;padding:20px 0}.minimized-view{display:none}.modal-content.minimized{position:fixed;bottom:70px;right:20px;width:180px;height:40px;border-radius:30px;padding:0;cursor:pointer;transform:none!important;background:var(--bg-2);overflow:hidden}.modal-content.minimized .modal-header,.modal-content.minimized .modal-main{display:none}.modal-content.minimized .minimized-view{display:flex;align-items:center;justify-content:center;width:100%;height:100%;position:relative}.minimized-progress-bar{position:absolute;left:0;top:0;height:100%;background:linear-gradient(135deg,var(--brand-1),var(--brand-2));transition:width .4s ease-out}.minimized-info{z-index:1;color:white;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,.5);white-space:nowrap}@keyframes spin{to{transform:rotate(360deg)}}`); }
    }

    // ===================================================================================
    // 4. MediaExtractor: Extrai informações de mídia da página
    // ===================================================================================
    class MediaExtractor {
        constructor() { this.media = { title: 'video', sources: [] }; }
        async extract() {
            this.getTitle();
            await this.extractFromSourcesVar();
            if (this.media.sources.length === 0) { await this.extractFromVideoElement(); }
            if (this.media.sources.length === 0) throw new Error("Fontes de vídeo não detectadas.");
            this.media.sources = [...new Map(this.media.sources.map(item => [item.url, item])).values()];
            this.media.sources.sort((a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0));
            return this.media;
        }
        getTitle() {
            const el = document.querySelector('h1') || document.querySelector('title');
            this.media.title = (el?.textContent.trim() || 'video')
                .replace(/[^\w\s.-]/gi, '')
                .substring(0, 80);
        }
        extractFromSourcesVar() {
            const match = document.documentElement.innerHTML.match(/var\s+sources\s*=\s*(\[[^]*?\]);/);
            if (!match?.[1]) return;
            try {
                const sourcesArray = JSON.parse(match[1]);
                sourcesArray.forEach(s => s.src && this.media.sources.push({ url: s.src.replace(/\\/g, ''), label: s.desc || 'Padrão', type: 'hls' }));
            } catch (e) { debug.log('Extractor', 'Erro ao processar "sources"', e); }
        }
        extractFromVideoElement() {
            const video = document.querySelector('video'); if (!video) return;
            const source = video.querySelector('source');
            if (source?.src) { this.media.sources.push({ url: source.src, label: 'Player', type: 'mp4' }); }
            else if (video.src) { this.media.sources.push({ url: video.src, label: 'Player (SRC)', type: 'mp4' }); }
        }
    }

    // ===================================================================================
    // 5. Downloader: Gerencia o processo de download dos segmentos
    // ===================================================================================
    class Downloader {
        constructor(source, title) {
            this.source = source; this.title = title; this.segments = []; this.isCancelled = false;
            this.activeRequests = new Set(); this._events = {}; this.resumeKey = `bf-resume-${title}`;
        }
        on(e, cb) { if (!this._events[e]) this._events[e] = []; this._events[e].push(cb); }
        _emit(e, d) { this._events[e]?.forEach(cb => cb(d)); }
        async start() {
            try {
                if (this.source.type === 'hls') {
                    const playlist = await this.fetchWithRetry(this.source.url, { responseType: 'text' });
                    this.segments = this.parsePlaylist(playlist, this.source.url);
                } else { this.segments = [{ url: this.source.url, index: 0 }]; }
                if (this.segments.length === 0) throw new Error("Playlist vazia.");
                const blobs = await this.downloadAllSegments();
                if (this.isCancelled || !blobs) return;
                this._emit('progress', { percent: 100, message: 'Finalizando...', speed: 0, eta: 0 });
                const mergedBlob = new Blob(blobs, { type: 'video/MP2T' });
                this.saveFile(mergedBlob); await this.clearCompletionState();
            } catch (error) {
                if (!this.isCancelled) { this._emit('error', { message: error.message }); }
            }
        }
        cancel() {
            if (this.isCancelled) return;
            debug.log('Downloader', 'Cancelamento solicitado.');
            this.isCancelled = true;
            this.activeRequests.forEach(req => {
                req.abort();
                req.onreadystatechange = null;
            });
            this.activeRequests.clear();
            this._emit('cancelled');
        }
        parsePlaylist(playlist, baseUrl) { const base = new URL(baseUrl); return playlist.split('\n').filter(line => line.trim()&&!line.startsWith('#')).map((line, i) => ({ url: new URL(line.trim(), base.href).href, index: i })); }
        async downloadAllSegments() {
            const segmentsData = new Array(this.segments.length); let downloadedBytes = 0, segmentsCompleted = 0; let lastUpdateTime = Date.now(); const speeds = [];
            const completionState = await GM_getValue(this.resumeKey, {});
            const downloadQueue = this.segments.filter(s => !completionState[s.index]);
            segmentsCompleted = this.segments.length - downloadQueue.length;

            const updateProgress = () => {
                if (this.isCancelled) return;
                const now = Date.now(), timeDiff = (now - lastUpdateTime) / 1000, bytesDiff = downloadedBytes - (speeds.lastBytes || 0);
                if (bytesDiff > 0 && timeDiff > 0) speeds.push(bytesDiff / timeDiff); if (speeds.length > 10) speeds.shift();
                const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length || 0;
                const avgSegmentSize = segmentsCompleted > 0 ? downloadedBytes / segmentsCompleted : 0;
                const remainingBytes = (this.segments.length - segmentsCompleted) * avgSegmentSize;
                const eta = (avgSpeed > 0 && segmentsCompleted >= CONFIG.MIN_SEGMENTS_FOR_ETA) ? remainingBytes / avgSpeed : 0;
                this._emit('progress', { percent:Math.round((segmentsCompleted/this.segments.length)*100), message:`${segmentsCompleted}/${this.segments.length}`, speed:avgSpeed, eta:eta });
                speeds.lastBytes = downloadedBytes; lastUpdateTime = now;
            };

            const worker = async () => {
                while (downloadQueue.length > 0) {
                    if (this.isCancelled) throw new Error('Cancelado');
                    const segment = downloadQueue.shift();
                    try {
                        const blob = await this.fetchWithRetry(segment.url, { responseType: 'blob' });
                        segmentsData[segment.index] = blob; downloadedBytes += blob.size; segmentsCompleted++;
                        const currentState = await GM_getValue(this.resumeKey,{}); currentState[segment.index] = true; await GM_setValue(this.resumeKey, currentState);
                        updateProgress();
                    } catch (err) {
                        if (!this.isCancelled) downloadQueue.unshift(segment);
                        throw err;
                    }
                }
            };

            try {
                await Promise.all(Array.from({ length: CONFIG.MAX_CONCURRENT_DOWNLOADS }, () => worker()));
            } catch (error) {
                if (this.isCancelled) {
                    debug.log('Downloader', 'Workers pararam devido ao cancelamento.');
                    return null;
                }
                throw error;
            }

            if (this.isCancelled) return null;
            if (segmentsData.filter(Boolean).length !== this.segments.length) { await this.clearCompletionState(); throw new Error("Download incompleto."); }
            return segmentsData;
        }
        fetchWithRetry(url, options, retries = CONFIG.MAX_RETRIES) {
            return new Promise((resolve, reject) => {
                let attempt = 0;
                const sendRequest = () => {
                    if (this.isCancelled) return reject(new Error('Abortado pelo cancelamento'));
                    attempt++;
                    const req = GM_xmlhttpRequest({ method:'GET', url, ...options, timeout:CONFIG.SEGMENT_TIMEOUT,
                        onload: (res) => { this.activeRequests.delete(req); if (res.status>=200&&res.status<300) resolve(res.response); else if (attempt<retries) setTimeout(sendRequest, 1000*attempt); else reject(new Error(`HTTP ${res.status}`)); },
                        onerror: (err) => { this.activeRequests.delete(req); if (attempt<retries&&!this.isCancelled) setTimeout(sendRequest, 1000*attempt); else reject(new Error('Erro de rede')); },
                        ontimeout: () => { this.activeRequests.delete(req); if (attempt<retries&&!this.isCancelled) setTimeout(sendRequest, 1000*attempt); else reject(new Error('Timeout')); },
                        onabort: () => { this.activeRequests.delete(req); reject(new Error('Abortado pelo cancelamento')); }
                    }); this.activeRequests.add(req);
                }; sendRequest();
            });
        }
        saveFile(blob) {
            const url = URL.createObjectURL(blob);
            GM_notification({ title:'Download Concluído!', text:`O vídeo "${this.title}" foi salvo.`, timeout:5000 });
            this._emit('success', { title:this.title, fileSize:blob.size });
            try {
                // Note: GM_download não é uma função padrão do Tampermonkey
                // Esta linha pode causar erro se não for suportada
                if (typeof GM_download === 'function') {
                    GM_download({ url:url, name:`${this.title}.ts`, onload:()=>URL.revokeObjectURL(url), onerror:()=>this.fallbackDownload(url) });
                } else {
                    this.fallbackDownload(url);
                }
            } catch (e) { this.fallbackDownload(url); }
        }
        fallbackDownload(url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.title}.ts`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
        async clearCompletionState() { await GM_deleteValue(this.resumeKey); }
    }

    // ===================================================================================
    // 6. INICIALIZAÇÃO
    // ===================================================================================
    function initialize() {
        checkForMediaAndInitialize();
        const observer = new MutationObserver((_, obs) => {
             if (document.getElementById(CONFIG.DOWNLOAD_BUTTON_ID)) { obs.disconnect(); return; }
            checkForMediaAndInitialize(obs);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function checkForMediaAndInitialize(observer = null) {
        if (document.documentElement.innerHTML.includes('var sources = [{' )) {
             try {
                const media = await new MediaExtractor().extract();
                if (media?.sources.length > 0) {
                    new UIManager();
                    if (observer) observer.disconnect();
                }
            } catch (e) { /* Aguarda */ }
        }
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); }
    else { initialize(); }

})();
