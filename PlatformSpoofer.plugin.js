/**
 * @name PlatformSpoofer
 * @version 1.8.9
 * @author Kazed
 * @description Spoof what platform or device you're on
 * @authorLink https://github.com/KazedDev
 * @website https://github.com/KazedDev/Discord_PlatformSpoofer
 * @source https://github.com/KazedDev/Discord_PlatformSpoofer/blob/main/PlatformSpoofer.plugin.js
 * @updateUrl https://raw.githubusercontent.com/KazedDev/Discord_PlatformSpoofer/main/PlatformSpoofer.plugin.js
 * @donate https://ko-fi.com/kazeddev
 */

module.exports = class PlatformSpoofer {
    constructor() {
        this.defaultSettings = { platform: "android", fabX: null, fabY: null };
        this.platformOptions = [
            { label: "Desktop",     value: "desktop",     icon: "🖥️" },
            { label: "Web",         value: "web",         icon: "🌐" },
            { label: "Android",     value: "android",     icon: "🤖" },
            { label: "iOS",         value: "ios",         icon: "🍎" },
            { label: "Xbox",        value: "xbox",        icon: "🎮" },
            { label: "Playstation", value: "playstation", icon: "🕹️" },
            { label: "VR",          value: "vr",          icon: "🥽" },
        ];
        this._floatingBtn = null;
        this._guiPanel    = null;
        this._overlay     = null;
        this._styleEl     = null;

        this._drag = {
            active: false,
            moved:  false,
            startX: 0, startY: 0,
            btnStartX: 0, btnStartY: 0,
            velX: 0, velY: 0,
            lastX: 0, lastY: 0,
            lastTime: 0,
            rafId: null,
        };
        this._lastTrail = 0;
    }

    start() {
        this.settings = this.loadSettings();
        this.patch();
        this.sendIdentify();
        this._injectStyles();
        this._createFloatingButton();
        this._startProfileWatcher();
        BdApi.UI.showToast("PlatformSpoofer actif ✅", { type: "success", timeout: 3000 });
    }

    stop() {
        BdApi.Patcher.unpatchAll("PlatformSpoofer");
        this._stopProfileWatcher();
        this._removeFloatingButton();
        this._removeStyles();
        BdApi.UI.showToast("PlatformSpoofer désactivé.", { type: "info", timeout: 3000 });
    }

    // ─── Patch & Gateway ─────────────────────────────────────────────────────

    getGateway() {
        return BdApi.Webpack.getModule(m => {
            try { return m instanceof Object && m.constructor?.toString?.().includes("_doIdentify"); }
            catch(e) { return false; }
        }, { searchExports: true });
    }

    patch() {
        const SuperProperties = BdApi.Webpack.getModule(
            m => typeof m?.getSuperProperties === "function", { searchExports: true }
        );
        if (!SuperProperties) {
            BdApi.UI.showToast("PlatformSpoofer: module introuvable ❌", { type: "error" });
            return;
        }
        BdApi.Patcher.after("PlatformSpoofer", SuperProperties, "getSuperProperties", (_, args, ret) => {
            const platform = this.getPlatform();
            if (platform && ret) Object.assign(ret, platform);
            return ret;
        });
    }

    sendIdentify() {
        try {
            const gw = this.getGateway();
            if (gw && typeof gw.send === "function" && typeof gw.handleIdentify === "function")
                gw.send(2, gw.handleIdentify());
        } catch(e) {
            BdApi.UI.showToast("PlatformSpoofer: erreur lors du re-identify ❌", { type: "error" });
        }
    }

    getPlatform() {
        switch (this.settings?.platform ?? "android") {
            case "desktop":     return { browser: "Discord Client",   os: "Windows" };
            case "web":         return { browser: "Discord Web",      os: "Windows" };
            case "ios":         return { browser: "Discord iOS",      os: "iOS" };
            case "android":     return { browser: "Discord Android",  os: "Android" };
            case "xbox":        return { browser: "Discord Embedded", os: "Xbox One" };
            case "playstation": return { browser: "Discord Embedded", os: "PlayStation 4" };
            case "vr":          return { browser: "Discord VR",       os: "Windows" };
            default:            return null;
        }
    }

    // ─── Styles ───────────────────────────────────────────────────────────────

    _injectStyles() {
        this._styleEl = document.createElement("style");
        this._styleEl.id = "PlatformSpooferStyles";
        this._styleEl.textContent = `

            #ps-fab {
                position: fixed !important;
                z-index: 99999 !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #3ba55c, #2d7d46) !important;
                border: none !important;
                cursor: grab !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 2px 10px rgba(59,165,92,0.5) !important;
                outline: none !important;
                padding: 0 !important; margin: 0 !important;
                pointer-events: all !important;
                visibility: visible !important; opacity: 1 !important;
                user-select: none !important; -webkit-user-select: none !important;
                /* Seules les props non-positionnelles sont transitionées */
                transition: box-shadow 0.2s ease, background 0.2s ease, border-radius 0.25s ease !important;
                will-change: left, top, transform !important;
            }
            #ps-fab:hover {
                box-shadow: 0 4px 18px rgba(59,165,92,0.7) !important;
                background: linear-gradient(135deg, #43c66a, #3ba55c) !important;
            }
            #ps-fab.ps-dragging {
                cursor: grabbing !important;
                border-radius: 28% !important;
                box-shadow: 0 14px 40px rgba(59,165,92,0.6), 0 4px 12px rgba(0,0,0,0.4) !important;
                background: linear-gradient(135deg, #50de76, #3ba55c) !important;
            }
            #ps-fab svg {
                width: 18px !important; height: 18px !important;
                fill: #fff !important; display: block !important;
                pointer-events: none !important;
                transition: transform 0.2s ease !important;
            }
            #ps-fab.ps-dragging svg { transform: scale(0.82) !important; }

            /* ── Trail ── */
            .ps-trail {
                position: fixed !important;
                pointer-events: none !important;
                border-radius: 50% !important;
                z-index: 99997 !important;
                background: radial-gradient(circle, rgba(59,165,92,0.7) 0%, transparent 70%) !important;
                animation: ps-trail-fade 0.4s ease-out forwards !important;
            }
            @keyframes ps-trail-fade {
                0%   { opacity: 0.85; transform: scale(1); }
                100% { opacity: 0;    transform: scale(0.05); }
            }

            /* ── Drop ripple ── */
            .ps-drop-ripple {
                position: fixed !important;
                pointer-events: none !important;
                border-radius: 50% !important;
                z-index: 99996 !important;
                border: 2px solid rgba(59,165,92,0.55) !important;
                width: 36px !important; height: 36px !important;
                animation: ps-ripple-out 0.6s ease-out forwards !important;
            }
            @keyframes ps-ripple-out {
                0%   { opacity: 0.85; transform: translate(-50%,-50%) scale(1); }
                100% { opacity: 0;    transform: translate(-50%,-50%) scale(4); }
            }

            /* ── Panel animations ── */
            @keyframes ps-panel-pop {
                0%   { opacity: 0; transform: scale(0.7) rotateX(12deg); }
                50%  { opacity: 1; transform: scale(1.05) rotateX(-2deg); }
                65%  { transform: scale(0.97) rotateX(1deg); }
                72%  { transform: scale(1.01) rotate(-0.5deg); }
                78%  { transform: scale(0.99) rotate(0.5deg); }
                84%  { transform: scale(1.005) rotate(-0.3deg); }
                90%  { transform: scale(0.998) rotate(0.2deg); }
                100% { opacity: 1; transform: scale(1) rotate(0deg); }
            }
            @keyframes ps-panel-idle-shake {
                0%   { transform: rotate(0deg) translate(0px,0px); }
                20%  { transform: rotate(0.15deg) translate(0.4px,-0.3px); }
                40%  { transform: rotate(-0.1deg) translate(-0.3px,0.4px); }
                60%  { transform: rotate(0.12deg) translate(0.2px,0.3px); }
                80%  { transform: rotate(-0.08deg) translate(-0.4px,-0.2px); }
                100% { transform: rotate(0deg) translate(0px,0px); }
            }
            @keyframes ps-shine {
                0%   { left: -80%; opacity: 0; }
                1%   { opacity: 1; }
                16%  { left: 130%; opacity: 0.6; }
                17%  { opacity: 0; left: 130%; }
                100% { opacity: 0; left: 130%; }
            }

            /* ── Panel ── */
            #ps-panel {
                position: fixed !important;
                z-index: 99999 !important;
                width: 280px !important;
                background: var(--background-floating, #18191c) !important;
                border: 1px solid var(--background-modifier-accent, #2f3136) !important;
                border-radius: 10px !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3) !important;
                overflow: hidden !important;
                display: none !important;
                transform-origin: top right !important;
            }
            #ps-panel.ps-panel-open { display: block !important; }
            #ps-panel::after {
                content: ''; position: absolute; top: 0; left: -80%;
                width: 60%; height: 100%;
                background: linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.14) 50%,rgba(255,255,255,0.06) 60%,transparent 80%);
                pointer-events: none;
                animation: ps-shine 5s linear 0.3s infinite;
                z-index: 10;
            }
            #ps-panel-header {
                display: flex; align-items: center; gap: 8px;
                padding: 12px 14px 10px;
                border-bottom: 1px solid var(--background-modifier-accent, #2f3136);
                background: var(--background-secondary, #2f3136);
            }
            #ps-panel-header .ps-dot {
                width: 10px; height: 10px; border-radius: 50%;
                background: #3ba55c; box-shadow: 0 0 6px rgba(59,165,92,0.8); flex-shrink: 0;
            }
            #ps-panel-header span { font-size: 13px; font-weight: 700; color: var(--header-primary, #fff); letter-spacing: 0.3px; flex: 1; }
            #ps-panel-header .ps-version {
                font-size: 10px; font-weight: 500; color: var(--text-muted, #72767d);
                background: var(--background-modifier-accent, #202225); padding: 2px 8px;
                border-radius: 999px; display: flex; align-items: center; gap: 5px; white-space: nowrap;
            }
            #ps-panel-header .ps-version .ps-by { font-style: italic; color: var(--text-muted, #72767d); }
            #ps-panel-header .ps-version .ps-ver { color: #3ba55c; font-weight: 700; }
            #ps-panel-body { padding: 12px 14px 14px; }
            #ps-warning {
                display: flex; align-items: flex-start; gap: 8px;
                background: rgba(250,166,26,0.08); border-left: 3px solid #faa61a;
                border-radius: 4px; padding: 8px 10px; margin-bottom: 12px;
                font-size: 11.5px; line-height: 1.5; color: #faa61a;
            }
            .ps-label {
                display: block; font-size: 11px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.6px;
                color: var(--header-secondary, #b9bbbe); margin-bottom: 8px;
            }
            #ps-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; }
            .ps-option {
                display: flex; align-items: center; gap: 7px; padding: 8px 10px;
                border-radius: 6px; border: 1.5px solid transparent; cursor: pointer;
                font-size: 13px; color: var(--text-normal, #dcddde);
                background: var(--background-modifier-hover, #32353b);
                transition: background 0.15s ease, border-color 0.15s ease; user-select: none;
            }
            .ps-option:hover { background: var(--background-modifier-active, #393c43); }
            .ps-option.ps-selected { background: rgba(59,165,92,0.15); border-color: #3ba55c; color: #fff; font-weight: 600; }
            .ps-option .ps-icon { font-size: 15px; line-height: 1; }
            .ps-option-vr { width: 48%; justify-content: center; }
            #ps-apply {
                width: 100%; padding: 9px; border-radius: 6px; border: none;
                background: linear-gradient(135deg, #3ba55c, #2d7d46); color: #fff;
                font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px;
                transition: filter 0.15s ease, transform 0.15s ease;
            }
            #ps-apply:hover { filter: brightness(1.1); }
            #ps-apply:active { transform: scale(0.97); }
            #ps-hint { margin-top: 9px; font-size: 11px; color: var(--text-muted, #72767d); text-align: center; }
            #ps-support { margin-top: 8px; font-size: 11px; color: #fff; text-align: center; }
            #ps-ispice { color: #5865f2; text-decoration: none; font-weight: 600; }
            #ps-ispice:hover { text-decoration: underline; }
        `;
        document.head.appendChild(this._styleEl);
    }

    _removeStyles() {
        this._styleEl?.remove();
        this._styleEl = null;
    }

    // ─── Floating Button ──────────────────────────────────────────────────────

    _createFloatingButton() {
        const container = document.getElementById("app-mount")
            || document.querySelector("[class*='app-']")
            || document.querySelector("[class*='layers']")
            || document.body;

        this._overlay = document.createElement("div");
        this._overlay.id = "ps-overlay";
        this._overlay.style.cssText = `position:fixed;inset:0;z-index:99998;background:transparent;display:none;`;
        this._overlay.addEventListener("click", () => this._closePanel());
        container.appendChild(this._overlay);

        this._floatingBtn = document.createElement("button");
        this._floatingBtn.id = "ps-fab";
        this._floatingBtn.title = "PlatformSpoofer";
        this._floatingBtn.innerHTML = this._iconPause();
        container.appendChild(this._floatingBtn);

        this._guiPanel = this._buildPanel();
        container.appendChild(this._guiPanel);

        // Position initiale
        const initX = this.settings.fabX ?? (window.innerWidth - 44);
        const initY = this.settings.fabY ?? 48;
        this._setFabPos(initX, initY);

        this._attachDragListeners();

        setTimeout(() => {
            const el = document.getElementById("ps-fab");
            if (!el || !el.offsetParent) {
                document.body.appendChild(this._floatingBtn);
                document.body.appendChild(this._guiPanel);
                document.body.appendChild(this._overlay);
            }
        }, 500);
    }

    _setFabPos(x, y) {
        const btn = this._floatingBtn;
        if (!btn) return;
        x = Math.max(0, Math.min(x, window.innerWidth  - 36));
        y = Math.max(0, Math.min(y, window.innerHeight - 36));
        btn.style.left   = x + "px";
        btn.style.top    = y + "px";
        btn.style.right  = "auto";
        btn.style.bottom = "auto";
    }

    _repositionPanel() {
        if (!this._guiPanel || !this._floatingBtn) return;
        const btnX   = parseFloat(this._floatingBtn.style.left) || 0;
        const btnY   = parseFloat(this._floatingBtn.style.top)  || 0;
        const panelW = 280;
        const panelH = this._guiPanel.offsetHeight || 400;
        let x = btnX - panelW - 8;
        if (x < 4) x = btnX + 36 + 8;
        let y = btnY;
        if (y + panelH > window.innerHeight - 8) y = window.innerHeight - panelH - 8;
        if (y < 4) y = 4;
        this._guiPanel.style.left   = x + "px";
        this._guiPanel.style.top    = y + "px";
        this._guiPanel.style.right  = "auto";
        this._guiPanel.style.bottom = "auto";
    }

    // ─── Drag ────────────────────────────────────────────────────────────────

    _attachDragListeners() {
        const btn = this._floatingBtn;
        const MOVE_THRESHOLD = 4;

        const getXY = e => e.touches
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };

        const onDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const { x, y } = getXY(e);

            this._drag.active    = false;
            this._drag.moved     = false;
            this._drag.startX    = x;
            this._drag.startY    = y;
            this._drag.btnStartX = parseFloat(btn.style.left) || 0;
            this._drag.btnStartY = parseFloat(btn.style.top)  || 0;
            this._drag.velX      = 0;
            this._drag.velY      = 0;
            this._drag.lastX     = x;
            this._drag.lastY     = y;
            this._drag.lastTime  = performance.now();

            if (this._drag.rafId) {
                cancelAnimationFrame(this._drag.rafId);
                this._drag.rafId = null;
            }

            document.addEventListener("mousemove",  onMove);
            document.addEventListener("mouseup",    onUp);
            document.addEventListener("touchmove",  onMove, { passive: false });
            document.addEventListener("touchend",   onUp);
        };

        const onMove = (e) => {
            const { x, y } = getXY(e);
            const dx = x - this._drag.startX;
            const dy = y - this._drag.startY;

            // Activer le drag dès qu'on dépasse le seuil
            if (!this._drag.active) {
                if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
                    this._drag.active = true;
                    this._drag.moved  = true;
                    btn.classList.add("ps-dragging");
                    if (this._guiPanel.classList.contains("ps-panel-open"))
                        this._closePanel();
                } else return;
            }

            if (e.cancelable) e.preventDefault();

            // ── Position directe, collée à la souris ──
            const newX = this._drag.btnStartX + dx;
            const newY = this._drag.btnStartY + dy;
            this._setFabPos(newX, newY);

            // Vélocité pour l'inertie au relâchement
            const now = performance.now();
            const dt  = Math.max(now - this._drag.lastTime, 1);
            this._drag.velX     = (x - this._drag.lastX) / dt * 16;
            this._drag.velY     = (y - this._drag.lastY) / dt * 16;
            this._drag.lastX    = x;
            this._drag.lastY    = y;
            this._drag.lastTime = now;

            // Jelly squish basé sur la vélocité
            this._applySquish(this._drag.velX, this._drag.velY);

            // Particules (throttle ~30ms)
            if (now - this._lastTrail > 30) {
                this._spawnTrail(x, y);
                this._lastTrail = now;
            }
        };

        const onUp = () => {
            document.removeEventListener("mousemove",  onMove);
            document.removeEventListener("mouseup",    onUp);
            document.removeEventListener("touchmove",  onMove);
            document.removeEventListener("touchend",   onUp);

            if (!this._drag.active) {
                // Simple clic → toggle panel
                this._togglePanel();
                return;
            }

            btn.classList.remove("ps-dragging");
            this._drag.active = false;

            // Reset squish proprement
            btn.style.transition = "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, background 0.2s ease, border-radius 0.25s ease";
            btn.style.transform  = "";
            setTimeout(() => {
                if (btn) btn.style.transition = "";
            }, 320);

            // Ripple au dépôt
            const cx = parseFloat(btn.style.left) + 18;
            const cy = parseFloat(btn.style.top)  + 18;
            this._spawnDropRipple(cx, cy);

            // Inertie puis snap sur le bord
            this._runInertia();
        };

        btn.addEventListener("mousedown",  onDown);
        btn.addEventListener("touchstart", onDown, { passive: true });
    }
 
    
    // ─── Inertia + edge snap ──────────────────────────────────────────────────

    _runInertia() {
        const FRICTION = 0.88;
        const btn = this._floatingBtn;
        let vx = this._drag.velX * 4.5;
        let vy = this._drag.velY * 4.5;
        let x  = parseFloat(btn.style.left) || 0;
        let y  = parseFloat(btn.style.top)  || 0;

        const tick = () => {
            vx *= FRICTION;
            vy *= FRICTION;
            x  += vx;
            y  += vy;

            const maxX = window.innerWidth  - 36;
            const maxY = window.innerHeight - 36;
            const cx = Math.max(0, Math.min(x, maxX));
            const cy = Math.max(0, Math.min(y, maxY));
            // Rebond léger sur les bords
            if (cx !== x) { vx *= -0.3; x = cx; }
            if (cy !== y) { vy *= -0.3; y = cy; }

            this._setFabPos(x, y);

            if (Math.abs(vx) + Math.abs(vy) > 0.3) {
                this._drag.rafId = requestAnimationFrame(tick);
            } else {
                this._snapToEdge(x, y);
            }
        };
        this._drag.rafId = requestAnimationFrame(tick);
    }

    _snapToEdge(x, y) {
        const maxX    = window.innerWidth  - 36;
        const maxY    = window.innerHeight - 36;
        const targetX = x < window.innerWidth / 2 ? 8 : maxX - 8;
        const targetY = Math.max(8, Math.min(y, maxY - 8));
        let cx = x, cy = y;

        const snap = () => {
            cx += (targetX - cx) * 0.18;
            cy += (targetY - cy) * 0.18;
            this._setFabPos(cx, cy);
            if (Math.abs(cx - targetX) + Math.abs(cy - targetY) > 0.5) {
                requestAnimationFrame(snap);
            } else {
                this._setFabPos(targetX, targetY);
                this.settings.fabX = targetX;
                this.settings.fabY = targetY;
                this.saveSettings(this.settings);
            }
        };
        requestAnimationFrame(snap);
    }

    // ─── FX helpers ──────────────────────────────────────────────────────────

    _applySquish(vx, vy) {
        const btn = this._floatingBtn;
        if (!btn) return;
        const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
        const skewX  = clamp(vx * 1.6, -18, 18);
        const skewY  = clamp(vy * 1.6, -18, 18);
        const scaleX = clamp(1 + Math.abs(vx) * 0.045, 0.82, 1.32);
        const scaleY = clamp(1 + Math.abs(vy) * 0.045, 0.82, 1.32);
        btn.style.transform = `skew(${skewX}deg, ${skewY}deg) scale(${scaleX}, ${scaleY})`;
    }

    _spawnTrail(x, y) {
        const size = 6 + Math.random() * 11;
        const el   = document.createElement("div");
        el.className = "ps-trail";
        el.style.cssText = `width:${size}px;height:${size}px;left:${x - size/2}px;top:${y - size/2}px;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 450);
    }

    _spawnDropRipple(cx, cy) {
        for (let i = 0; i < 3; i++) {
            const el = document.createElement("div");
            el.className = "ps-drop-ripple";
            el.style.cssText = `left:${cx}px;top:${cy}px;animation-delay:${i * 0.1}s;opacity:${0.85 - i * 0.2};`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 800 + i * 100);
        }
    }

    
    // ─── Button / Panel helpers ───────────────────────────────────────────────

    _removeFloatingButton() {
        clearTimeout(this._shakeTimer);
        if (this._drag.rafId) cancelAnimationFrame(this._drag.rafId);
        this._floatingBtn?.remove();
        this._guiPanel?.remove();
        this._overlay?.remove();
        this._floatingBtn = null;
        this._guiPanel    = null;
        this._overlay     = null;
    }

    _iconPause() {
        return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
                     10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>`;
    }

    _iconClose() {
        return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41
                     10.59 12 5 17.59 6.41 19 12 13.41
                     17.59 19 19 17.59 13.41 12z"/>
        </svg>`;
    }

    _togglePanel() {
        this._guiPanel.classList.contains("ps-panel-open")
            ? this._closePanel()
            : this._openPanel();
    }

    _openPanel() {
        clearTimeout(this._shakeTimer);
        this._repositionPanel();
        this._overlay.style.display = "block";
        this._floatingBtn.innerHTML = this._iconClose();
        this._guiPanel.classList.add("ps-panel-open");
        this._guiPanel.style.animation = "ps-panel-pop 0.6s cubic-bezier(0.22,1,0.36,1) forwards";
        this._shakeTimer = setTimeout(() => {
            if (this._guiPanel?.classList.contains("ps-panel-open"))
                this._guiPanel.style.animation = "ps-panel-idle-shake 2.5s ease-in-out infinite";
        }, 650);
    }

    _closePanel() {
        clearTimeout(this._shakeTimer);
        this._guiPanel.style.animation = "";
        this._guiPanel.classList.remove("ps-panel-open");
        this._overlay.style.display = "none";
        this._floatingBtn.innerHTML = this._iconPause();
    }

    
    // ─── Profile watcher ─────────────────────────────────────────────────────

    _startProfileWatcher() {
        try {
            const UserStore = BdApi.Webpack.getModule(
                m => typeof m?.getCurrentUser === "function", { searchExports: true }
            );
            if (!UserStore?.addChangeListener) return;
            this._profileListener = () => {
                const user = this._getCurrentUser();
                if (!user) return;
                const avatarEl = document.getElementById("ps-author-avatar");
                const nameEl   = document.getElementById("ps-author-name");
                const tagEl    = document.getElementById("ps-author-tag");
                if (avatarEl) avatarEl.src = this._getAvatarUrl(user) || "";
                if (nameEl)   nameEl.textContent = user.globalName || user.username;
                if (tagEl)    tagEl.textContent  = `@${user.username}`;
            };
            UserStore.addChangeListener(this._profileListener);
        } catch(e) {}
    }

    _stopProfileWatcher() {
        try {
            if (!this._profileListener) return;
            const UserStore = BdApi.Webpack.getModule(
                m => typeof m?.getCurrentUser === "function", { searchExports: true }
            );
            UserStore?.removeChangeListener?.(this._profileListener);
            this._profileListener = null;
        } catch(e) {}
    }

    _getCurrentUser() {
        try {
            const UserStore = BdApi.Webpack.getModule(
                m => typeof m?.getCurrentUser === "function", { searchExports: true }
            );
            return UserStore?.getCurrentUser?.() ?? null;
        } catch(e) { return null; }
    }

    _getAvatarUrl(user) {
        if (!user) return null;
        if (!user.avatar)
            return `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;
        const ext = user.avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
    }

    // ─── Panel Builder ────────────────────────────────────────────────────────

    _buildPanel() {
        const panel = document.createElement("div");
        panel.id = "ps-panel";
        panel.innerHTML = `
            <div id="ps-panel-header">
                <div class="ps-dot"></div>
                <span>Platform Spoofer</span>
                <span class="ps-version">
                    <span class="ps-by">${atob('Ynkga2F6ZWREZXY=')}</span>
                    <span class="ps-ver">v1.8.9</span>
                </span>
            </div>
            <div id="ps-panel-body">
                <div id="ps-warning">
                    ⚠️ Ce plugin peut entraîner un avertissement ou un ban. Utilise à tes risques.
                </div>
                <label class="ps-label">Choisir une plateforme</label>
                <div id="ps-grid"></div>
                <button id="ps-apply">⚡ Appliquer</button>
                <p id="ps-hint">Le changement s'applique instantanément.</p>
                <p id="ps-support">Soutien : <a href="https://discord.gg/ispice" target="_blank" id="ps-ispice">ispice</a></p>
            </div>
        `;

        const grid = panel.querySelector("#ps-grid");
        const mainOptions = this.platformOptions.filter(o => o.value !== "vr");
        const vrOption    = this.platformOptions.find(o => o.value === "vr");

        mainOptions.forEach(opt => {
            const btn = document.createElement("div");
            btn.className = "ps-option" + (opt.value === this.settings.platform ? " ps-selected" : "");
            btn.dataset.value = opt.value;
            btn.innerHTML = `<span class="ps-icon">${opt.icon}</span>${opt.label}`;
            btn.addEventListener("click", () => {
                grid.querySelectorAll(".ps-option").forEach(b => b.classList.remove("ps-selected"));
                btn.classList.add("ps-selected");
            });
            grid.appendChild(btn);
        });

        if (vrOption) {
            const vrRow = document.createElement("div");
            vrRow.style.cssText = "grid-column: 1 / -1; display: flex; justify-content: center;";
            const vbtn = document.createElement("div");
            vbtn.className = "ps-option ps-option-vr" + (vrOption.value === this.settings.platform ? " ps-selected" : "");
            vbtn.dataset.value = vrOption.value;
            vbtn.innerHTML = `<span class="ps-icon">${vrOption.icon}</span>${vrOption.label}`;
            vbtn.addEventListener("click", () => {
                grid.querySelectorAll(".ps-option").forEach(b => b.classList.remove("ps-selected"));
                vbtn.classList.add("ps-selected");
            });
            vrRow.appendChild(vbtn);
            grid.appendChild(vrRow);
        }

        panel.querySelector("#ps-apply").addEventListener("click", () => {
            const selected = grid.querySelector(".ps-selected");
            if (!selected) return;
            this.settings.platform = selected.dataset.value;
            this.saveSettings(this.settings);
            this.sendIdentify();
            const label = this.platformOptions.find(o => o.value === this.settings.platform)?.label ?? this.settings.platform;
            BdApi.UI.showToast(`Plateforme changée en "${label}" ✅`, { type: "success", timeout: 3000 });
            this._closePanel();
        });

        return panel;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.cssText = "padding:12px;color:var(--text-normal);font-size:13px";
        panel.textContent = "⚡ Utilise le bouton vert en haut à droite de Discord pour accéder au GUI.";
        return panel;
    }

    loadSettings() {
        return Object.assign({}, this.defaultSettings, BdApi.Data.load("PlatformSpoofer", "settings"));
    }

    saveSettings(settings) {
        BdApi.Data.save("PlatformSpoofer", "settings", settings);
    }
};

