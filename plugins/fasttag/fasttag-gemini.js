(function initializeFastTagGemini(root) {
    'use strict';

    let dependencies = null;
    let geminiSocket = null;
    let geminiRequestId = 1;
    const geminiPendingRequests = new Map();
    const geminiSceneParseCache = new Map();

    function configure(options) {
        dependencies = options;
    }

    function getDependencies() {
        if (!dependencies) throw new Error('[FastTag] Gemini integration is not configured');
        return dependencies;
    }

    function getGeminiSocketUrl() {
        const host = root.location.hostname || '127.0.0.1';
        return `ws://${host}:9998`;
    }

    async function ensureGeminiSocket() {
        if (geminiSocket && geminiSocket.readyState === root.WebSocket.OPEN) return geminiSocket;

        return new Promise(async (resolve, reject) => {
            const socketUrl = getGeminiSocketUrl();
            let settled = false;

            const setupSocketHandlers = (socket) => {
                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        const id = data.id;
                        if (id && geminiPendingRequests.has(id)) {
                            const { resFn, rejFn } = geminiPendingRequests.get(id);
                            geminiPendingRequests.delete(id);
                            if (data.error) rejFn(new Error(data.error));
                            else resFn(data.result || data);
                        }
                    } catch (e) {}
                };
                socket.onclose = () => { geminiSocket = null; };
            };

            let socket;
            try { socket = new root.WebSocket(socketUrl); } catch (e) {}

            const timeout = root.setTimeout(async () => {
                if (!settled && (!socket || socket.readyState !== root.WebSocket.OPEN)) {
                    if (socket) try { socket.close(); } catch (e) {}
                    try {
                        await getDependencies().fetchGQL('mutation { runPluginTask(plugin_id: "mypluginrc", task_name: "Start Gemini Bridge") }');
                        await new Promise(wait => root.setTimeout(wait, 600));
                        const retrySocket = new root.WebSocket(socketUrl);
                        retrySocket.onopen = () => {
                            if (!settled) {
                                settled = true;
                                geminiSocket = retrySocket;
                                setupSocketHandlers(retrySocket);
                                resolve(retrySocket);
                            }
                        };
                        retrySocket.onerror = () => {
                            if (!settled) {
                                settled = true;
                                reject(new Error('Cannot connect to FastTag Gemini Bridge. Click "Start Gemini Bridge" in Tasks.'));
                            }
                        };
                    } catch (error) {
                        if (!settled) {
                            settled = true;
                            reject(new Error('FastTag Gemini Bridge offline'));
                        }
                    }
                }
            }, 800);

            if (socket) {
                socket.onopen = () => {
                    if (!settled) {
                        settled = true;
                        root.clearTimeout(timeout);
                        geminiSocket = socket;
                        setupSocketHandlers(socket);
                        resolve(socket);
                    }
                };
                socket.onerror = () => {};
            }
        });
    }

    async function sendGeminiSocketRequest(payload) {
        const socket = await ensureGeminiSocket();
        const id = geminiRequestId++;
        payload.id = id;
        return new Promise((resFn, rejFn) => {
            geminiPendingRequests.set(id, { resFn, rejFn });
            socket.send(JSON.stringify(payload));
            root.setTimeout(() => {
                if (geminiPendingRequests.has(id)) {
                    geminiPendingRequests.delete(id);
                    rejFn(new Error('AI request took too long (>40s). Google API may be busy or rate-limited.'));
                }
            }, 40000);
        });
    }

    async function callGeminiAPI(customApiKey = null, customModel = null) {
        const deps = getDependencies();
        const apiKey = customApiKey || deps.getGeminiApiKey();
        if (!apiKey) throw new Error('No Gemini API key configured. Enter your key in Settings ➔ 🤖 AI');
        return sendGeminiSocketRequest({
            type: 'test',
            api_key: apiKey,
            model: customModel || deps.getGeminiModel()
        });
    }

    function normalizeSceneParseResult(result) {
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
            throw new Error('Gemini returned an invalid response. Please try AI Parse again.');
        }

        const cleanString = value => typeof value === 'string' ? value.trim() : '';
        const cleanList = value => Array.isArray(value)
            ? value.map(cleanString).filter(Boolean)
            : [];
        const normalized = {
            clean_title: cleanString(result.clean_title),
            date: cleanString(result.date),
            studio: cleanString(result.studio),
            performers: cleanList(result.performers),
            tags: cleanList(result.tags),
            confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null
        };

        const hasSuggestion = normalized.clean_title || normalized.date || normalized.studio
            || normalized.performers.length > 0 || normalized.tags.length > 0;
        if (!hasSuggestion) {
            throw new Error('Gemini found no usable metadata suggestions for this scene. Try adjusting the title or filename, then run AI Parse again.');
        }
        return normalized;
    }

    async function parseSceneWithGemini(sceneId, rawFilename, rawTitle) {
        if (geminiSceneParseCache.has(sceneId)) return geminiSceneParseCache.get(sceneId);
        const deps = getDependencies();
        const apiKey = deps.getGeminiApiKey();
        if (!apiKey) throw new Error('No Gemini API key configured. Enter your key in Settings ➔ 🤖 AI');

        deps.log('ACTION', 'GeminiAI', `Running AI smart parser on scene #${sceneId}: "${rawFilename || rawTitle}"...`);
        let performersContext = [];
        let studiosContext = [];
        try {
            const cachedPerformers = deps.getCachedOrNull('performers') || [];
            if (cachedPerformers.length > 0) performersContext = cachedPerformers.map(performer => performer.name).slice(0, 150);
            const cachedStudios = deps.getCachedOrNull('studios') || [];
            if (cachedStudios.length > 0) studiosContext = cachedStudios.map(studio => studio.name).slice(0, 60);
        } catch (e) {}

        const rawResult = await sendGeminiSocketRequest({
            type: 'parse',
            api_key: apiKey,
            model: deps.getGeminiModel(),
            filename: rawFilename || '',
            title: rawTitle || '',
            performers_context: performersContext,
            studios_context: studiosContext
        });
        const result = normalizeSceneParseResult(rawResult);
        deps.log('ACTION', 'GeminiAI', `Gemini AI parsed scene #${sceneId}: title="${result?.clean_title}", studio="${result?.studio}", performers=${JSON.stringify(result?.performers || [])}`);
        geminiSceneParseCache.set(sceneId, result);
        return result;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.gemini = Object.freeze({ configure, callGeminiAPI, parseSceneWithGemini });
}(typeof window !== 'undefined' ? window : globalThis));
