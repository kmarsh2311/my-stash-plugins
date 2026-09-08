(function(root) {
    'use strict';

    root.FastTag = root.FastTag || {};

    let escapeHtml = value => String(value ?? '');
    let getDebugMode = () => false;
    let log = () => {};

    function configure(options = {}) {
        if (typeof options.escapeHtml === 'function') escapeHtml = options.escapeHtml;
        if (typeof options.getDebugMode === 'function') getDebugMode = options.getDebugMode;
        if (typeof options.log === 'function') log = options.log;
    }

    function fallbackCopyText(text) {
        const textarea = root.document.createElement('textarea');
        textarea.value = String(text ?? '');
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        root.document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        let copied = false;
        try {
            copied = Boolean(root.document.execCommand?.('copy'));
        } catch (error) {}
        textarea.remove();
        return copied;
    }

    async function copyTextToClipboard(text) {
        const value = String(text ?? '');
        if (!value) return false;
        if (root.navigator.clipboard?.writeText) {
            try {
                await root.navigator.clipboard.writeText(value);
                return true;
            } catch (error) {}
        }
        return fallbackCopyText(value);
    }

    function showToast(message, type = 'success', duration = 3000, debugPayload = null) {
        try {
            const isDebug = getDebugMode();
            const effectiveDuration = isDebug ? Math.max(duration, 15000) : duration;
            log(type === 'error' ? 'ERROR' : (type === 'info' ? 'INFO' : 'ACTION'), 'TOAST', message, debugPayload);

            root.document.getElementById('fasttag-native-toast')?.remove();
            const toast = root.document.createElement('div');
            toast.id = 'fasttag-native-toast';
            const background = type === 'success' ? '#059669' : (type === 'info' ? '#6366f1' : '#dc2626');
            const icon = type === 'success' ? '✓' : (type === 'info' ? 'ℹ' : '✕');
            toast.style.cssText = `
                position: fixed;
                top: 18px;
                left: 50%;
                transform: translateX(-50%) translateY(-10px);
                background: ${background};
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: 20000000;
                opacity: 0;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                max-width: 90vw;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            const copyButton = type === 'error' || debugPayload || isDebug
                ? '<button id="fasttag-toast-copy-btn" type="button" style="background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.35); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; line-height: 1.3;" title="Copy details to clipboard">📋 Copy</button>'
                : '';
            const closeButton = isDebug || type === 'error'
                ? '<button id="fasttag-toast-close-btn" type="button" style="background: none; border: none; color: rgba(255,255,255,0.85); padding: 0 0 0 4px; font-size: 14px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center;" title="Dismiss">✕</button>'
                : '';

            toast.innerHTML = `
                <span style="font-size: 13px; line-height: 1; flex-shrink: 0;">${icon}</span>
                <span class="fasttag-toast-msg" style="word-break: break-word; max-width: 600px;">${escapeHtml(message)}</span>
                ${copyButton}
                ${closeButton}
            `;
            root.document.body.appendChild(toast);

            const copyBtn = toast.querySelector('#fasttag-toast-copy-btn');
            if (copyBtn) {
                copyBtn.onclick = event => {
                    event.stopPropagation();
                    const messageElement = toast.querySelector('.fasttag-toast-msg');
                    let copyText = (messageElement ? messageElement.innerText : String(message).replace(/<[^>]*>/g, '')).trim();
                    if (debugPayload) {
                        try {
                            copyText += '\n\nDetails:\n' + (typeof debugPayload === 'object' ? JSON.stringify(debugPayload, null, 2) : String(debugPayload));
                        } catch (error) {
                            copyText += '\n\nDetails:\n' + String(debugPayload);
                        }
                    }

                    copyTextToClipboard(copyText).then(copied => {
                        copyBtn.textContent = copied ? '✓ Copied!' : '❌ Failed';
                    });
                    root.setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy'; }, 2500);
                };
            }

            let dismissTimer = null;
            const startDismiss = time => {
                dismissTimer = root.setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(-10px)';
                    root.setTimeout(() => { if (toast.parentNode) toast.remove(); }, 220);
                }, time);
            };

            const closeBtn = toast.querySelector('#fasttag-toast-close-btn');
            if (closeBtn) {
                closeBtn.onclick = event => {
                    event.stopPropagation();
                    if (dismissTimer) root.clearTimeout(dismissTimer);
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(-10px)';
                    root.setTimeout(() => { if (toast.parentNode) toast.remove(); }, 220);
                };
            }

            toast.addEventListener('mouseenter', () => {
                if (dismissTimer) root.clearTimeout(dismissTimer);
            });
            toast.addEventListener('mouseleave', () => startDismiss(Math.min(effectiveDuration, 5000)));
            root.requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
            startDismiss(effectiveDuration);
        } catch (error) {
            root.console?.log?.(`[Toast ${type}]: ${message}`);
        }
    }

    function toastSuccess(message, debug) {
        showToast(message, 'success', 3000, debug);
        if (debug) root.console?.log?.(debug);
    }

    function toastError(message, debug, duration = 8000) {
        showToast(message, 'error', duration, debug);
        if (debug) root.console?.error?.(debug);
        else root.console?.error?.(`[FastTag Error]: ${message}`);
    }

    root.FastTag.notifications = Object.freeze({ configure, copyTextToClipboard, showToast, toastSuccess, toastError });
}(typeof window !== 'undefined' ? window : globalThis));
