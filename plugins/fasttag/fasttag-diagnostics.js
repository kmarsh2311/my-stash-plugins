(function(root) {
    'use strict';

    root.FastTag = root.FastTag || {};

    const DEBUG_STORAGE_KEY = 'fasttag_debug_mode';
    const DEBUG_LOGS_STORAGE_KEY = 'fasttag_debug_logs_buffer';
    const MAX_DEBUG_LOGS = 600;
    let getUsageCount = () => 0;
    let inMemoryDebugLogs = [];
    let saveLogsTimeout = null;

    try {
        const savedLogs = root.localStorage.getItem(DEBUG_LOGS_STORAGE_KEY);
        if (savedLogs) inMemoryDebugLogs = JSON.parse(savedLogs) || [];
    } catch (e) {
        inMemoryDebugLogs = [];
    }

    function configure(options = {}) {
        if (typeof options.getUsageCount === 'function') getUsageCount = options.getUsageCount;
    }

    function getDebugMode() {
        return root.localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    }

    function setDebugMode(enabled) {
        root.localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? 'true' : 'false');
        ftLog('INFO', 'CONFIG', `Debug Mode turned ${enabled ? 'ON' : 'OFF'}`);
    }

    function getCircularReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === 'object' && value !== null) {
                const isElement = typeof root.HTMLElement === 'function' && value instanceof root.HTMLElement;
                const isNode = typeof root.Node === 'function' && value instanceof root.Node;
                if (seen.has(value) || isElement || isNode) return '[DOM/Circular]';
                seen.add(value);
            }
            return value;
        };
    }

    function scheduleSaveLogsBuffer() {
        if (saveLogsTimeout) return;
        saveLogsTimeout = root.setTimeout(() => {
            saveLogsTimeout = null;
            try {
                root.localStorage.setItem(DEBUG_LOGS_STORAGE_KEY, JSON.stringify(inMemoryDebugLogs.slice(-250)));
            } catch (e) {}
        }, 1000);
    }

    function ftLog(level, category, message, data = null) {
        const now = new Date();
        const entry = {
            time: now.toISOString().replace('T', ' ').replace('Z', ''),
            level: String(level).toUpperCase(),
            category: String(category).toUpperCase(),
            message: String(message),
            data: data ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data, getCircularReplacer())) : data) : null
        };

        inMemoryDebugLogs.push(entry);
        if (inMemoryDebugLogs.length > MAX_DEBUG_LOGS) inMemoryDebugLogs.shift();
        scheduleSaveLogsBuffer();

        if (getDebugMode() || level === 'ERROR' || level === 'WARN') {
            const prefix = `[FastTag][${entry.category}]`;
            if (level === 'ERROR') root.console?.error?.(prefix, message, data || '');
            else if (level === 'WARN') root.console?.warn?.(prefix, message, data || '');
            else root.console?.log?.(prefix, message, data || '');
        }
    }

    function getLogBufferSize() {
        return inMemoryDebugLogs.length;
    }

    function clearDebugLogs() {
        inMemoryDebugLogs = [];
        try { root.localStorage.removeItem(DEBUG_LOGS_STORAGE_KEY); } catch (e) {}
        ftLog('INFO', 'LOG', 'Debug logs cleared by user');
    }

    function exportDebugLogsAsText() {
        const screenInfo = `Screen: ${root.innerWidth}x${root.innerHeight}, DPR: ${root.devicePixelRatio || 1}, UserAgent: ${root.navigator.userAgent}`;
        const header = `=== FastTag Diagnostics Log ===\nExported: ${new Date().toISOString()}\n${screenInfo}\nUsage Count: ${getUsageCount()}\n===============================\n\n`;
        const body = inMemoryDebugLogs.map(entry => {
            let dataStr = '';
            if (entry.data !== null && entry.data !== undefined) {
                try {
                    dataStr = '\n  ' + JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ');
                } catch (error) {
                    dataStr = '\n  [Non-serializable data]';
                }
            }
            return `[${entry.time}] [${entry.level}] [${entry.category}] ${entry.message}${dataStr}`;
        }).join('\n');
        return header + body;
    }

    function downloadDebugLogFile() {
        const text = exportDebugLogsAsText();
        const blob = new root.Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = root.URL.createObjectURL(blob);
        const link = root.document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `fasttag-debug-${date}.log`;
        root.document.body.appendChild(link);
        link.click();
        root.setTimeout(() => { link.remove(); root.URL.revokeObjectURL(url); }, 500);
    }

    function copyDebugLogsToClipboard() {
        const text = exportDebugLogsAsText();
        if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
            return root.navigator.clipboard.writeText(text);
        }
        const textarea = root.document.createElement('textarea');
        textarea.value = text;
        root.document.body.appendChild(textarea);
        textarea.select();
        root.document.execCommand('copy');
        textarea.remove();
        return Promise.resolve();
    }

    function attachGlobalErrorListeners() {
        if (root._fastTagErrorListenersAttached) return;
        root._fastTagErrorListenersAttached = true;
        root.addEventListener('error', event => {
            if (event?.filename && event.filename.includes('fasttag')) {
                ftLog('ERROR', 'RUNTIME', `Uncaught error in ${event.filename}:${event.lineno}:${event.colno} - ${event.message}`, {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack || null
                });
            }
        });
        root.addEventListener('unhandledrejection', event => {
            const reason = event.reason;
            const message = String(reason?.message || reason);
            if (message.includes('fasttag') || (reason?.stack && reason.stack.includes('fasttag'))) {
                ftLog('ERROR', 'PROMISE', `Unhandled Promise Rejection: ${message}`, {
                    message,
                    stack: reason?.stack || null
                });
            }
        });
    }

    root.FastTag.diagnostics = Object.freeze({
        configure,
        getDebugMode,
        setDebugMode,
        ftLog,
        getLogBufferSize,
        clearDebugLogs,
        exportDebugLogsAsText,
        downloadDebugLogFile,
        copyDebugLogsToClipboard,
        attachGlobalErrorListeners
    });
}(typeof window !== 'undefined' ? window : globalThis));
