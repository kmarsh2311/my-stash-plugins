(function(root) {
    'use strict';

    root.FastTag = root.FastTag || {};

    function open(options = {}) {
        const {
            cacheStore,
            getEffectiveTheme,
            getThemePreference,
            getShowIdColumns,
            getEnableSuggestions,
            getAutoScrapeSequential,
            getScrubSpeeds,
            getScraperMatchingSettings,
            getShowRecentChips,
            getShowPinnedChips,
            getEnableCardIconClicks,
            getCompactCoverEditor,
            getAlwaysPlayFullVideo,
            getOrganizedWord,
            getAutoMarkOrganized,
            getDetachScraper,
            getFillMissingPerformerImages,
            getGeminiApiKey,
            getGeminiModel,
            getGeminiAutoParse,
            getDebugMode,
            getLogBufferSize,
            setThemePreference,
            setShowIdColumns,
            setEnableSuggestions,
            setShowRecentChips,
            setShowPinnedChips,
            setEnableCardIconClicks,
            setCompactCoverEditor,
            setAlwaysPlayFullVideo,
            setAutoMarkOrganized,
            setAutoScrapeSequential,
            setDetachScraper,
            setFillMissingPerformerImages,
            setScraperMatchingSettings,
            setScraperMatchingPreset,
            resetScraperMatchingSettings,
            setScrubSpeeds,
            resetScrubCueCount,
            DEFAULT_SCRUB_SPEEDS,
            setGeminiApiKey,
            setGeminiModel,
            setGeminiAutoParse,
            callGeminiAPI,
            setDebugMode,
            copyDebugLogsToClipboard,
            downloadDebugLogFile,
            clearDebugLogs,
            resetAllLayoutsToDefault,
            invalidateCache,
            promptDebugModeWarningDialog,
            loadFastTagHelpModule,
            showToast,
            toastError
        } = options;
        const window = root;
        const document = root.document;
        const console = root.console;
        const setTimeout = (...args) => root.setTimeout(...args);
        const existing = document.getElementById('fasttag-settings-modal');
        if (existing) existing.remove();

        const theme = getEffectiveTheme();
        const currentPref = getThemePreference();
        const showIds = getShowIdColumns();
        const enableSug = getEnableSuggestions();
        const autoScrape = getAutoScrapeSequential();
        const scrubSpeeds = getScrubSpeeds();
        const scraperMatching = getScraperMatchingSettings();

        const modal = document.createElement('div');
        modal.id = 'fasttag-settings-modal';
        modal.className = `theme-${theme}`;
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000000;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fasttagFadeIn 0.15s ease-out;
        `;

        const isDark = theme === 'dark';
        const bg = isDark ? '#1e293b' : '#ffffff';
        const text = isDark ? '#f8fafc' : '#0f172a';
        const textMuted = isDark ? '#94a3b8' : '#64748b';
        const border = isDark ? '#334155' : '#e2e8f0';
        const cardBg = isDark ? '#0f172a' : '#f8fafc';

        modal.innerHTML = `
            <div style="background: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 12px; width: 480px; max-width: 92vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); overflow: hidden; font-family: inherit;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 12px; border-bottom: 1px solid ${border}; background: ${cardBg};">
                    <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                        <span>⚙️</span> FastTag Settings
                    </div>
                    <button id="fasttag-settings-close" style="background: none; border: none; font-size: 18px; color: ${textMuted}; cursor: pointer; line-height: 1; padding: 4px;">✕</button>
                </div>

                <!-- Category Tabs Header -->
                <div id="fasttag-settings-tab-bar" style="display: flex; gap: 4px; padding: 6px 12px; background: ${cardBg}; border-bottom: 1px solid ${border}; user-select: none;">
                    <button type="button" class="fasttag-settings-tab-btn active" data-tab="display" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 700; border: none; border-radius: 7px; background: #6366f1; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🎨</span> Display
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="video" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🎬</span> Video
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="scraper" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>⚡</span> Workflow
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="matching" title="Scraper Matching" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease;">
                        <span>🎯</span> Match
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="ai" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease;">
                        <span>🤖</span> AI <span style="font-size: 8px; padding: 1px 4px; border-radius: 3px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 800; line-height: 1.1;">BETA</span>
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="system" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🛠️</span> System
                    </button>
                </div>

                <div style="padding: 16px 18px; min-height: 290px; max-height: 60vh; overflow-y: auto;">
                    <!-- TAB 1: DISPLAY -->
                    <div id="fasttag-tab-pane-display" class="fasttag-tab-pane" style="display: flex; flex-direction: column; gap: 14px;">
                        <!-- Theme setting -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <div>
                                <div style="font-weight: 600; font-size: 13px;">Theme</div>
                                <div style="font-size: 11px; color: ${textMuted};">Choose popup visual theme</div>
                            </div>
                            <select id="fasttag-setting-theme" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${cardBg}; color: ${text}; font-size: 12px; cursor: pointer;">
                                <option value="dark" ${currentPref === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${currentPref === 'light' ? 'selected' : ''}>Light</option>
                                <option value="auto" ${currentPref === 'auto' ? 'selected' : ''}>Auto (Match Stash)</option>
                            </select>
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Show ID Column setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Show ID Column</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display numeric database ID column in Tag, Performer, Studio, and Gallery popups.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-show-ids" ${showIds ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Smart Suggestions setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Smart Suggestions</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically detect and suggest matching Performers, Tags, and Studios from filenames and titles.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-suggestions" ${enableSug ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Show Recent Items setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Show Recent Items</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display recent history chips above tables across all modals.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-show-recent" ${getShowRecentChips() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Show Pinned Items setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Show Pinned Items</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display pinned chips (📌) in quick action bars.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-show-pinned" ${getShowPinnedChips() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Compact Cover Editor</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Reduce helper text and place Upload/Paste directly beneath New Cover to save vertical space.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-compact-cover" ${getCompactCoverEditor() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Card Icon Clicks setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Enable Card Icon Clicks</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Left-clicking Tag, Performer, Studio, or Gallery icons on scene cards opens FastTag popups directly. (Uncheck to require right-click context menu)</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-card-icon-clicks" ${getEnableCardIconClicks() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>
                    </div>

                    <!-- TAB 2: VIDEO -->
                    <div id="fasttag-tab-pane-video" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Always Play Full Video setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Always Play Full Video</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically stream the full video when opening scenes instead of short preview clips. (Shortcut: Option+V / Alt+V)</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-always-full-video" ${getAlwaysPlayFullVideo() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Video Scrubbing Speeds setting -->
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600; font-size: 13px;">Video Scrubbing Speeds</div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Seconds skipped per wheel notch in Full Video mode (Set to 0 to disable)</div>
                                </div>
                                <button type="button" id="fasttag-setting-reset-speeds" style="background: none; border: 1px solid ${border}; color: ${textMuted}; font-size: 11px; padding: 4px 8px; border-radius: 5px; cursor: pointer; transition: all 0.15s ease;">Reset Defaults</button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <span>🐢</span> Slow Click (sec)
                                    </label>
                                    <input type="number" id="fasttag-speed-slow" min="0" max="30" step="1" value="${scrubSpeeds.slow}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <span>🚗</span> Normal Scroll (sec)
                                    </label>
                                    <input type="number" id="fasttag-speed-normal" min="0" max="60" step="1" value="${scrubSpeeds.normal}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <span>🚀</span> Fast Flick (sec)
                                    </label>
                                    <input type="number" id="fasttag-speed-fast" min="0" max="120" step="1" value="${scrubSpeeds.fast}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <span>⏸️</span> Shift Freeze (sec)
                                    </label>
                                    <input type="number" id="fasttag-speed-freeze" min="0.1" max="10" step="0.5" value="${scrubSpeeds.freeze}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 3: WORKFLOW -->
                    <div id="fasttag-tab-pane-scraper" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Auto-Mark Scene as Organized / Organised -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Mark Scene as ${getOrganizedWord('organized')}</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically set scene status to '${getOrganizedWord('organized')}' when saving tags in FastTag.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-auto-mark-organized" ${getAutoMarkOrganized() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #059669; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Auto-Scrape in Sequential Mode setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Scrape in Sequential Mode</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically fetch scraper matches on scene transitions when using Edit Everything in Sequential Mode.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-auto-scrape" ${autoScrape ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Detach Scraper Window setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Detach Scraper Window</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Open scraper matches in a floating sidecar window alongside the popup instead of embedding inside.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-detach-scraper" ${getDetachScraper() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>
                    </div>

                    <!-- TAB 4: SCRAPER MATCHING -->
                    <div id="fasttag-tab-pane-matching" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-weight: 700; font-size: 13px;">Matching preset</div>
                                <div id="fasttag-matching-preset-summary" style="font-size: 10.5px; color: ${textMuted}; margin-top: 2px;">Balanced is the FastTag default.</div>
                            </div>
                            <select id="fasttag-setting-matching-preset" style="padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${cardBg}; color: ${text}; font-size: 11.5px; cursor: pointer;">
                                <option value="conservative" ${scraperMatching.preset === 'conservative' ? 'selected' : ''}>Conservative</option>
                                <option value="balanced" ${scraperMatching.preset === 'balanced' ? 'selected' : ''}>Balanced (Default)</option>
                                <option value="strict" ${scraperMatching.preset === 'strict' ? 'selected' : ''}>Strict</option>
                                <option value="custom" disabled ${scraperMatching.preset === 'custom' ? 'selected' : ''}>Custom (modified)</option>
                            </select>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <label style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:${cardBg}; border:1px solid ${border}; border-radius:7px; padding:8px; font-size:11px;">
                                <span><strong>Hide false positives</strong><br><span style="color:${textMuted};">Keep them under Show hidden.</span></span>
                                <input type="checkbox" id="fasttag-match-hide" ${scraperMatching.hideObviousFalsePositives ? 'checked' : ''} style="accent-color:#6366f1;">
                            </label>
                            <label style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:${cardBg}; border:1px solid ${border}; border-radius:7px; padding:8px; font-size:11px;">
                                <span><strong>Major cast conflict</strong><br><span style="color:${textMuted};">Penalise disjoint multi-person casts.</span></span>
                                <input type="checkbox" id="fasttag-match-cast-conflict" ${scraperMatching.majorCastConflict ? 'checked' : ''} style="accent-color:#6366f1;">
                            </label>
                            <label style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:${cardBg}; border:1px solid ${border}; border-radius:7px; padding:8px; font-size:11px;">
                                <span><strong>Require studio conflict</strong><br><span style="color:${textMuted};">Needed before automatic hiding.</span></span>
                                <input type="checkbox" id="fasttag-match-require-studio" ${scraperMatching.requireStudioMismatch ? 'checked' : ''} style="accent-color:#6366f1;">
                            </label>
                            <label style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:${cardBg}; border:1px solid ${border}; border-radius:7px; padding:8px; font-size:11px;">
                                <span><strong>Close duration protects</strong><br><span style="color:${textMuted};">Retain results inside tolerance.</span></span>
                                <input type="checkbox" id="fasttag-match-duration-protects" ${scraperMatching.closeDurationProtects ? 'checked' : ''} style="accent-color:#6366f1;">
                            </label>
                        </div>

                        <label style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; background:${cardBg}; border:1px solid ${border}; border-radius:7px; padding:9px; font-size:11px;">
                            <span><strong>Fill missing performer images</strong><br><span style="color:${textMuted};">Add scraper images and missing source IDs to selected performers with no local image. Existing images are never replaced.</span></span>
                            <input type="checkbox" id="fasttag-match-fill-performer-images" ${getFillMissingPerformerImages() ? 'checked' : ''} style="accent-color:#6366f1; flex-shrink:0;">
                        </label>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:${cardBg}; border:1px solid ${border}; border-radius:8px; padding:10px;">
                            <label style="font-size:10.5px; color:${textMuted};">Single-word aliases
                                <select id="fasttag-match-alias-mode" style="display:block; width:100%; margin-top:4px; padding:5px; border-radius:5px; border:1px solid ${border}; background:${bg}; color:${text};">
                                    <option value="ignore" ${scraperMatching.singleWordAliasMode === 'ignore' ? 'selected' : ''}>Ignore</option>
                                    <option value="weak" ${scraperMatching.singleWordAliasMode === 'weak' ? 'selected' : ''}>Weak evidence</option>
                                    <option value="strong" ${scraperMatching.singleWordAliasMode === 'strong' ? 'selected' : ''}>Confirmed match</option>
                                </select>
                            </label>
                            <label style="font-size:10.5px; color:${textMuted};">Initial results shown
                                <input id="fasttag-match-result-limit" type="number" min="5" max="100" step="5" value="${scraperMatching.initialResultLimit}" style="display:block; width:100%; box-sizing:border-box; margin-top:4px; padding:5px; border-radius:5px; border:1px solid ${border}; background:${bg}; color:${text};">
                            </label>
                            <label style="font-size:10.5px; color:${textMuted};">Title similarity below (%)
                                <input id="fasttag-match-title-threshold" type="number" min="0" max="100" step="5" value="${Math.round(scraperMatching.titleSimilarityThreshold * 100)}" style="display:block; width:100%; box-sizing:border-box; margin-top:4px; padding:5px; border-radius:5px; border:1px solid ${border}; background:${bg}; color:${text};">
                            </label>
                            <label style="font-size:10.5px; color:${textMuted};">Duration difference (sec)
                                <input id="fasttag-match-duration-threshold" type="number" min="0" max="3600" step="30" value="${scraperMatching.durationMismatchThreshold}" style="display:block; width:100%; box-sizing:border-box; margin-top:4px; padding:5px; border-radius:5px; border:1px solid ${border}; background:${bg}; color:${text};">
                            </label>
                            <label style="font-size:10.5px; color:${textMuted}; grid-column:1 / -1;">Duration difference (% of local scene)
                                <input id="fasttag-match-duration-percent" type="number" min="0" max="100" step="5" value="${scraperMatching.durationMismatchPercent}" style="display:block; width:100%; box-sizing:border-box; margin-top:4px; padding:5px; border-radius:5px; border:1px solid ${border}; background:${bg}; color:${text};">
                            </label>
                        </div>

                        <div style="font-size:10.5px; color:${textMuted}; line-height:1.4; padding:8px; border:1px dashed ${border}; border-radius:7px;">Safety rules are fixed: verified fingerprints and direct scene-ID matches are never hidden, at least one result remains visible, and Show hidden/Show all always restores candidates.</div>
                        <div style="display:flex; justify-content:flex-end;"><button type="button" id="fasttag-match-restore-defaults" style="background:rgba(99,102,241,.14); border:1px solid rgba(129,140,248,.45); color:#818cf8; font-size:11px; font-weight:700; padding:6px 10px; border-radius:6px; cursor:pointer;">↺ Restore Defaults</button></div>
                    </div>

                    <!-- TAB 5: AI (GEMINI) -->
                    <div id="fasttag-tab-pane-ai" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Prominent Experimental Feature Banner -->
                        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 18px; line-height: 1.1; flex-shrink: 0;">⚠️</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; font-size: 12px; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
                                    EXPERIMENTAL FEATURE
                                    <span style="font-size: 8.5px; background: rgba(245, 158, 11, 0.25); color: #f59e0b; padding: 1px 5px; border-radius: 4px; font-weight: 800;">ACTIVE DEVELOPMENT</span>
                                </div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 3px; line-height: 1.45;">
                                    The Gemini AI Smart Parser is an experimental feature currently under active development. Results, quotas, and response times may vary depending on filename formatting and Google API availability.
                                </div>
                            </div>
                        </div>

                        <!-- Gemini API Key configuration -->
                        <div style="display: flex; flex-direction: column; gap: 8px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                    <span>✨</span> Google Gemini API Key
                                </div>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #818cf8; text-decoration: none; font-weight: 600;">Get Free Key ↗</a>
                            </div>
                            <div style="font-size: 11px; color: ${textMuted};">Powers intelligent filename parsing, performer extraction, studio identification, and clean title generation.</div>
                            
                            <div style="display: flex; gap: 6px; margin-top: 4px;">
                                <div style="position: relative; flex: 1;">
                                    <input type="password" id="fasttag-setting-gemini-key" value="${getGeminiApiKey()}" placeholder="Paste your Gemini API key here..." style="width: 100%; box-sizing: border-box; padding: 7px 34px 7px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: monospace;">
                                    <button type="button" id="fasttag-btn-toggle-key" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 13px; color: ${textMuted}; padding: 2px 4px;" title="Show/Hide Key">👁️</button>
                                </div>
                                <button type="button" id="fasttag-btn-test-gemini" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #818cf8; font-size: 11.5px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">⚡ Test Key</button>
                            </div>
                            <div id="fasttag-gemini-test-status" style="font-size: 11px; display: none; margin-top: 2px;"></div>
                        </div>

                        <!-- Gemini Model Selection -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <div>
                                <div style="font-weight: 600; font-size: 13px;">AI Model</div>
                                <div style="font-size: 11px; color: ${textMuted};">Select Google Gemini model</div>
                            </div>
                            <select id="fasttag-setting-gemini-model" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${cardBg}; color: ${text}; font-size: 12px; cursor: pointer;">
                                <option value="gemini-flash-latest" ${getGeminiModel() === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash Latest (Auto-Managed, Recommended)</option>
                                <option value="gemini-3.8-flash" ${getGeminiModel() === 'gemini-3.8-flash' ? 'selected' : ''}>Gemini 3.8 Flash (High Performance)</option>
                                <option value="gemini-3.6-flash" ${getGeminiModel() === 'gemini-3.6-flash' ? 'selected' : ''}>Gemini 3.6 Flash</option>
                                <option value="gemini-flash-lite-latest" ${getGeminiModel() === 'gemini-flash-lite-latest' ? 'selected' : ''}>Gemini Flash Lite (Fastest)</option>
                                <option value="gemini-pro-latest" ${getGeminiModel() === 'gemini-pro-latest' ? 'selected' : ''}>Gemini Pro Latest (Deep Analysis)</option>
                            </select>
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Auto-Parse on Scene Open -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Parse Filename on Scene Open</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically run AI filename extraction when opening a scene to suggest missing metadata.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-gemini-auto-parse" ${getGeminiAutoParse() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                    </div>

                    <!-- TAB 6: SYSTEM -->
                    <div id="fasttag-tab-pane-system" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Reset Layouts & Sizes setting -->
                        <div style="display: flex; flex-direction: column; gap: 8px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                                        <span>📐</span> Layout & Dimensions
                                    </div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Reset all customized popup sizes, column widths, and window positions back to optimal display defaults.</div>
                                </div>
                                <button type="button" id="fasttag-setting-reset-layouts" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #818cf8; font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">↺ Reset Layouts</button>
                            </div>
                        </div>

                        <!-- Persistent Cache (IndexedDB) -->
                        <div style="display: flex; flex-direction: column; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                        <span>⚡</span> Persistent Client Cache (IndexedDB)
                                    </div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Caches tags, performers, studios, and groups locally in browser storage so Edit Everything opens in 0ms across network connections.</div>
                                </div>
                                <button type="button" id="fasttag-btn-purge-cache" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">🗑️ Purge Cache</button>
                            </div>
                            <div id="fasttag-cache-stats" style="font-size: 11px; color: ${textMuted}; border-top: 1px dashed ${border}; padding-top: 6px; display: flex; gap: 10px; flex-wrap: wrap;">
                                <span>Tags: <strong style="color: ${text};">${cacheStore.tags?.data?.length || 0}</strong></span>
                                <span>Performers: <strong style="color: ${text};">${cacheStore.performers?.data?.length || 0}</strong></span>
                                <span>Studios: <strong style="color: ${text};">${cacheStore.studios?.data?.length || 0}</strong></span>
                                <span>Groups: <strong style="color: ${text};">${cacheStore.groups?.data?.length || 0}</strong></span>
                            </div>
                        </div>

                        <!-- Developer & Diagnostics / Debug Mode -->
                        <div style="display: flex; flex-direction: column; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                                        <span>🛠️</span> Debug Mode
                                    </div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Extends toast display time to 15 seconds and records continuous diagnostics.</div>
                                </div>
                                <input type="checkbox" id="fasttag-setting-debug-mode" ${getDebugMode() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px dashed ${border}; padding-top: 8px; margin-top: 2px;">
                                <div style="font-size: 11px; color: ${textMuted}; display: flex; align-items: center; gap: 4px;">
                                    <span>📋</span> Logs: <strong id="fasttag-log-count" style="color: ${text};">${getLogBufferSize()} entries</strong>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    <button type="button" id="fasttag-btn-copy-log" style="background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); color: #818cf8; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 5px; cursor: pointer;">📋 Copy Log</button>
                                    <button type="button" id="fasttag-btn-export-log" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 5px; cursor: pointer;">📥 Download Log</button>
                                    <button type="button" id="fasttag-btn-clear-log" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; font-size: 11px; font-weight: 600; padding: 4px 7px; border-radius: 5px; cursor: pointer;" title="Clear log buffer">🗑️</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding: 12px 18px; background: ${cardBg}; border-top: 1px solid ${border}; display: flex; justify-content: space-between; gap: 8px;">
                    <button id="fasttag-settings-help" type="button" style="background: ${isDark ? 'rgba(99,102,241,.16)' : '#eef2ff'}; color: ${isDark ? '#c7d2fe' : '#3730a3'}; border: 1px solid ${isDark ? 'rgba(129,140,248,.45)' : '#a5b4fc'}; padding: 7px 13px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">❓ Help &amp; User Guide</button>
                    <button id="fasttag-settings-done" style="background: #6366f1; color: white; border: none; padding: 7px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">Done</button>
                </div>
            </div>
        `;

        // Tab Switching Handlers
        let activeSettingsTab = 'display';
        const tabBtns = modal.querySelectorAll('.fasttag-settings-tab-btn');
        const tabPanes = modal.querySelectorAll('.fasttag-tab-pane');

        const switchSettingsTab = (targetTab) => {
            activeSettingsTab = targetTab;
            tabBtns.forEach(btn => {
                const isActive = btn.getAttribute('data-tab') === targetTab;
                btn.classList.toggle('active', isActive);
                btn.style.background = isActive ? '#6366f1' : 'transparent';
                btn.style.color = isActive ? '#ffffff' : textMuted;
                btn.style.fontWeight = isActive ? '700' : '600';
            });
            tabPanes.forEach(pane => {
                const isTarget = pane.id === `fasttag-tab-pane-${targetTab}`;
                pane.style.display = isTarget ? 'flex' : 'none';
            });
        };

        tabBtns.forEach(btn => {
            btn.onclick = () => switchSettingsTab(btn.getAttribute('data-tab'));
            btn.onmouseenter = () => {
                if (btn.getAttribute('data-tab') !== activeSettingsTab) {
                    btn.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                    btn.style.color = text;
                }
            };
            btn.onmouseleave = () => {
                if (btn.getAttribute('data-tab') !== activeSettingsTab) {
                    btn.style.background = 'transparent';
                    btn.style.color = textMuted;
                }
            };
        });

        const themeSelect = modal.querySelector('#fasttag-setting-theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                setThemePreference(e.target.value);
                // Most settings colours are deliberately inline so host themes
                // cannot override them. Rebuild the modal to apply the new palette.
                closeModal();
                setTimeout(() => open(options), 0);
                showToast(`Theme set to ${e.target.value}`, 'info');
            });
        }

        const idToggle = modal.querySelector('#fasttag-setting-show-ids');
        if (idToggle) {
            idToggle.addEventListener('change', (e) => {
                setShowIdColumns(e.target.checked);
                showToast(`ID column ${e.target.checked ? 'enabled' : 'hidden'}`, 'success');
            });
        }

        const sugToggle = modal.querySelector('#fasttag-setting-suggestions');
        if (sugToggle) {
            sugToggle.addEventListener('change', (e) => {
                setEnableSuggestions(e.target.checked);
                showToast(`Suggestions ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const recentToggle = modal.querySelector('#fasttag-setting-show-recent');
        if (recentToggle) {
            recentToggle.addEventListener('change', (e) => {
                setShowRecentChips(e.target.checked);
                showToast(`Recent items ${e.target.checked ? 'enabled' : 'hidden'}`, 'info');
            });
        }

        const pinnedToggle = modal.querySelector('#fasttag-setting-show-pinned');
        if (pinnedToggle) {
            pinnedToggle.addEventListener('change', (e) => {
                setShowPinnedChips(e.target.checked);
                showToast(`Pinned items ${e.target.checked ? 'enabled' : 'hidden'}`, 'info');
            });
        }

        const iconClicksToggle = modal.querySelector('#fasttag-setting-card-icon-clicks');
        if (iconClicksToggle) {
            iconClicksToggle.addEventListener('change', (e) => {
                setEnableCardIconClicks(e.target.checked);
                showToast(`Card icon clicks ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const compactCoverToggle = modal.querySelector('#fasttag-setting-compact-cover');
        if (compactCoverToggle) {
            compactCoverToggle.addEventListener('change', (e) => {
                setCompactCoverEditor(e.target.checked);
                showToast(`Compact Cover Editor ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const autoMarkOrganizedToggle = modal.querySelector('#fasttag-setting-auto-mark-organized');
        if (autoMarkOrganizedToggle) {
            autoMarkOrganizedToggle.addEventListener('change', (e) => {
                setAutoMarkOrganized(e.target.checked);
                showToast(`Auto-Mark Scene as Organized ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const autoScrapeToggle = modal.querySelector('#fasttag-setting-auto-scrape');
        if (autoScrapeToggle) {
            autoScrapeToggle.addEventListener('change', (e) => {
                setAutoScrapeSequential(e.target.checked);
                showToast(`Auto-Scrape in Sequential Mode ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const detachScraperToggle = modal.querySelector('#fasttag-setting-detach-scraper');
        if (detachScraperToggle) {
            detachScraperToggle.addEventListener('change', (e) => {
                setDetachScraper(e.target.checked);
                showToast(`Scraper sidecar ${e.target.checked ? 'detached' : 'embedded'}`, 'info');
            });
        }

        const fillMissingPerformerImagesToggle = modal.querySelector('#fasttag-match-fill-performer-images');
        if (fillMissingPerformerImagesToggle) {
            fillMissingPerformerImagesToggle.addEventListener('change', (event) => {
                setFillMissingPerformerImages(event.target.checked);
                showToast(`Missing performer image import ${event.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const matchingPresetSelect = modal.querySelector('#fasttag-setting-matching-preset');
        const matchingControls = {
            hide: modal.querySelector('#fasttag-match-hide'),
            castConflict: modal.querySelector('#fasttag-match-cast-conflict'),
            requireStudio: modal.querySelector('#fasttag-match-require-studio'),
            durationProtects: modal.querySelector('#fasttag-match-duration-protects'),
            aliasMode: modal.querySelector('#fasttag-match-alias-mode'),
            resultLimit: modal.querySelector('#fasttag-match-result-limit'),
            titleThreshold: modal.querySelector('#fasttag-match-title-threshold'),
            durationThreshold: modal.querySelector('#fasttag-match-duration-threshold'),
            durationPercent: modal.querySelector('#fasttag-match-duration-percent')
        };
        const matchingSummary = modal.querySelector('#fasttag-matching-preset-summary');
        const matchingPresetDescriptions = {
            conservative: 'Shows more uncertain candidates and requires stronger conflicts before hiding.',
            balanced: 'FastTag default: cautious filtering with strong cast-conflict handling.',
            strict: 'Shows fewer candidates and filters aggressively when evidence is weak.',
            custom: 'Custom is selected automatically because one or more preset values were modified.'
        };
        const populateMatchingControls = (settings) => {
            if (matchingPresetSelect) matchingPresetSelect.value = settings.preset;
            if (matchingControls.hide) matchingControls.hide.checked = settings.hideObviousFalsePositives;
            if (matchingControls.castConflict) matchingControls.castConflict.checked = settings.majorCastConflict;
            if (matchingControls.requireStudio) matchingControls.requireStudio.checked = settings.requireStudioMismatch;
            if (matchingControls.durationProtects) matchingControls.durationProtects.checked = settings.closeDurationProtects;
            if (matchingControls.aliasMode) matchingControls.aliasMode.value = settings.singleWordAliasMode;
            if (matchingControls.resultLimit) matchingControls.resultLimit.value = settings.initialResultLimit;
            if (matchingControls.titleThreshold) matchingControls.titleThreshold.value = Math.round(settings.titleSimilarityThreshold * 100);
            if (matchingControls.durationThreshold) matchingControls.durationThreshold.value = settings.durationMismatchThreshold;
            if (matchingControls.durationPercent) matchingControls.durationPercent.value = settings.durationMismatchPercent;
            if (matchingSummary) matchingSummary.textContent = matchingPresetDescriptions[settings.preset] || matchingPresetDescriptions.custom;
        };
        const saveCustomMatchingControls = () => {
            const updated = setScraperMatchingSettings({
                preset: 'custom',
                hideObviousFalsePositives: Boolean(matchingControls.hide?.checked),
                majorCastConflict: Boolean(matchingControls.castConflict?.checked),
                requireStudioMismatch: Boolean(matchingControls.requireStudio?.checked),
                closeDurationProtects: Boolean(matchingControls.durationProtects?.checked),
                singleWordAliasMode: matchingControls.aliasMode?.value || 'weak',
                initialResultLimit: matchingControls.resultLimit?.value,
                titleSimilarityThreshold: Number(matchingControls.titleThreshold?.value || 0) / 100,
                durationMismatchThreshold: matchingControls.durationThreshold?.value,
                durationMismatchPercent: matchingControls.durationPercent?.value
            });
            populateMatchingControls(updated);
        };
        Object.values(matchingControls).forEach(control => {
            control?.addEventListener('change', saveCustomMatchingControls);
        });
        matchingPresetSelect?.addEventListener('change', () => {
            if (matchingPresetSelect.value === 'custom') return;
            const updated = setScraperMatchingPreset(matchingPresetSelect.value);
            populateMatchingControls(updated);
            showToast(`${matchingPresetSelect.options[matchingPresetSelect.selectedIndex].text} scraper matching applied`, 'info');
        });
        modal.querySelector('#fasttag-match-restore-defaults')?.addEventListener('click', (event) => {
            event.preventDefault();
            const defaults = resetScraperMatchingSettings();
            populateMatchingControls(defaults);
            showToast('Scraper matching restored to Balanced defaults', 'success');
        });
        populateMatchingControls(scraperMatching);

        const alwaysFullVideoToggle = modal.querySelector('#fasttag-setting-always-full-video');
        if (alwaysFullVideoToggle) {
            alwaysFullVideoToggle.addEventListener('change', (e) => {
                setAlwaysPlayFullVideo(e.target.checked);
                showToast(`Always play full video ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const speedSlowInput = modal.querySelector('#fasttag-speed-slow');
        const speedNormalInput = modal.querySelector('#fasttag-speed-normal');
        const speedFastInput = modal.querySelector('#fasttag-speed-fast');
        const speedFreezeInput = modal.querySelector('#fasttag-speed-freeze');

        const saveSpeedsFromInputs = () => {
            const parseVal = (input, min, max, def) => {
                const val = parseFloat(input?.value);
                if (isNaN(val)) return def;
                return Math.max(min, Math.min(max, val));
            };
            const newSpeeds = {
                slow: parseVal(speedSlowInput, 0, 30, DEFAULT_SCRUB_SPEEDS.slow),
                normal: parseVal(speedNormalInput, 0, 60, DEFAULT_SCRUB_SPEEDS.normal),
                fast: parseVal(speedFastInput, 0, 120, DEFAULT_SCRUB_SPEEDS.fast),
                freeze: parseVal(speedFreezeInput, 0.1, 10, DEFAULT_SCRUB_SPEEDS.freeze)
            };
            setScrubSpeeds(newSpeeds);
        };

        [speedSlowInput, speedNormalInput, speedFastInput, speedFreezeInput].forEach((inp) => {
            if (inp) {
                inp.addEventListener('input', saveSpeedsFromInputs);
                inp.addEventListener('change', saveSpeedsFromInputs);
            }
        });

        const resetSpeedsBtn = modal.querySelector('#fasttag-setting-reset-speeds');
        if (resetSpeedsBtn) {
            resetSpeedsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                setScrubSpeeds(DEFAULT_SCRUB_SPEEDS);
                resetScrubCueCount();
                if (speedSlowInput) speedSlowInput.value = DEFAULT_SCRUB_SPEEDS.slow;
                if (speedNormalInput) speedNormalInput.value = DEFAULT_SCRUB_SPEEDS.normal;
                if (speedFastInput) speedFastInput.value = DEFAULT_SCRUB_SPEEDS.fast;
                if (speedFreezeInput) speedFreezeInput.value = DEFAULT_SCRUB_SPEEDS.freeze;
                showToast('Scrubbing speeds & onboarding tips reset', 'info');
            });
        }

        // TAB 4: AI Listeners
        const geminiKeyInput = modal.querySelector('#fasttag-setting-gemini-key');
        const toggleKeyBtn = modal.querySelector('#fasttag-btn-toggle-key');
        const testGeminiBtn = modal.querySelector('#fasttag-btn-test-gemini');
        const geminiTestStatus = modal.querySelector('#fasttag-gemini-test-status');
        const geminiModelSelect = modal.querySelector('#fasttag-setting-gemini-model');
        const geminiAutoParseToggle = modal.querySelector('#fasttag-setting-gemini-auto-parse');

        if (geminiKeyInput) {
            geminiKeyInput.addEventListener('input', (e) => {
                setGeminiApiKey(e.target.value);
            });
        }

        if (toggleKeyBtn && geminiKeyInput) {
            toggleKeyBtn.addEventListener('click', () => {
                const isPass = geminiKeyInput.type === 'password';
                geminiKeyInput.type = isPass ? 'text' : 'password';
                toggleKeyBtn.textContent = isPass ? '🔒' : '👁️';
            });
        }

        if (testGeminiBtn && geminiTestStatus) {
            testGeminiBtn.addEventListener('click', async () => {
                const key = geminiKeyInput?.value?.trim() || getGeminiApiKey();
                if (!key) {
                    geminiTestStatus.style.display = 'block';
                    geminiTestStatus.style.color = '#f87171';
                    geminiTestStatus.textContent = '✕ Please paste a Gemini API key first.';
                    return;
                }

                testGeminiBtn.disabled = true;
                testGeminiBtn.textContent = '⏳ Testing...';
                geminiTestStatus.style.display = 'block';
                geminiTestStatus.style.color = '#818cf8';
                geminiTestStatus.textContent = 'Connecting to Google Gemini API...';

                try {
                    const res = await callGeminiAPI(key, geminiModelSelect?.value || 'gemini-1.5-flash');
                    if (res?.status === 'ok') {
                        geminiTestStatus.style.color = '#34d399';
                        geminiTestStatus.innerHTML = `✓ <strong>Connected!</strong> Google Gemini AI is online and ready.`;
                        setGeminiApiKey(key);
                        showToast('✓ Gemini API key verified & saved successfully!', 'success');
                    } else {
                        geminiTestStatus.style.color = '#f87171';
                        geminiTestStatus.textContent = `✕ Unexpected response from Gemini.`;
                    }
                } catch (err) {
                    geminiTestStatus.style.color = '#f87171';
                    geminiTestStatus.textContent = `✕ ${err.message}`;
                    showToast(`Gemini Test Failed: ${err.message}`, 'error');
                } finally {
                    testGeminiBtn.disabled = false;
                    testGeminiBtn.textContent = '⚡ Test Key';
                }
            });
        }

        if (geminiModelSelect) {
            geminiModelSelect.addEventListener('change', (e) => {
                setGeminiModel(e.target.value);
                showToast(`Gemini Model set to ${e.target.value}`, 'info');
            });
        }

        if (geminiAutoParseToggle) {
            geminiAutoParseToggle.addEventListener('change', (e) => {
                setGeminiAutoParse(e.target.checked);
                showToast(`Auto-Parse on Scene Open ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const resetLayoutsBtn = modal.querySelector('#fasttag-setting-reset-layouts');
        if (resetLayoutsBtn) {
            resetLayoutsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetAllLayoutsToDefault();
            });
        }

        const purgeCacheBtn = modal.querySelector('#fasttag-btn-purge-cache');
        if (purgeCacheBtn) {
            purgeCacheBtn.addEventListener('click', (e) => {
                e.preventDefault();
                invalidateCache();
                const statsEl = modal.querySelector('#fasttag-cache-stats');
                if (statsEl) {
                    statsEl.innerHTML = '<span style="color: #10b981; font-weight: 600;">✓ Cache purged! Live network reload on next search.</span>';
                }
                showToast('Persistent client cache cleared', 'success');
            });
        }

        const debugToggle = modal.querySelector('#fasttag-setting-debug-mode');
        if (debugToggle) {
            debugToggle.addEventListener('click', async (e) => {
                const wantsEnable = debugToggle.checked;
                if (wantsEnable) {
                    debugToggle.checked = false;
                    const confirmed = await promptDebugModeWarningDialog();
                    if (confirmed) {
                        debugToggle.checked = true;
                        setDebugMode(true);
                        showToast('Debug Mode ENABLED (15s toasts active)', 'info');
                    }
                } else {
                    setDebugMode(false);
                    showToast('Debug Mode disabled', 'info');
                }
            });
        }

        const copyLogBtn = modal.querySelector('#fasttag-btn-copy-log');
        if (copyLogBtn) {
            copyLogBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await copyDebugLogsToClipboard();
                copyLogBtn.textContent = '✓ Copied!';
                setTimeout(() => { if (copyLogBtn) copyLogBtn.textContent = '📋 Copy Log'; }, 2000);
                showToast('Copied FastTag debug log to clipboard', 'success');
            });
        }

        const exportLogBtn = modal.querySelector('#fasttag-btn-export-log');
        if (exportLogBtn) {
            exportLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                downloadDebugLogFile();
                showToast('Downloaded FastTag debug log file', 'success');
            });
        }

        const clearLogBtn = modal.querySelector('#fasttag-btn-clear-log');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clearDebugLogs();
                const countEl = modal.querySelector('#fasttag-log-count');
                if (countEl) countEl.textContent = '0 entries';
                showToast('FastTag debug logs cleared', 'info');
            });
        }

        const closeModal = () => {
            try {
                saveSpeedsFromInputs();
            } catch (err) {
                console.warn('[FastTag] Error saving speeds:', err);
            }
            document.removeEventListener('keydown', onSettingsKeyDown);
            modal.remove();
        };

        const onSettingsKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            }
        };
        document.addEventListener('keydown', onSettingsKeyDown);

        const closeBtn = modal.querySelector('#fasttag-settings-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };

        const doneBtn = modal.querySelector('#fasttag-settings-done');
        if (doneBtn) doneBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };

        const helpBtn = modal.querySelector('#fasttag-settings-help');
        if (helpBtn) helpBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            helpBtn.disabled = true;
            const originalText = helpBtn.innerHTML;
            helpBtn.textContent = '⏳ Loading Guide…';
            try {
                const help = await loadFastTagHelpModule();
                help.openGuide({ theme: getEffectiveTheme(), version: '4.4.4' });
            } catch (error) {
                toastError(`Unable to open help: ${error.message}`);
            } finally {
                helpBtn.disabled = false;
                helpBtn.innerHTML = originalText;
            }
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        document.body.appendChild(modal);
    }


    root.FastTag.settings = Object.freeze({ open });
}(typeof window !== 'undefined' ? window : globalThis));
