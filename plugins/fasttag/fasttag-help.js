(function initializeFastTagHelp(root) {
    'use strict';

    const GUIDE_SECTIONS = Object.freeze([
        { id: 'start', icon: '🚀', title: 'Getting Started', html: `
            <p>FastTag adds fast metadata editing to Stash scene cards. Open its context menu by right-clicking the information area of a scene card. Right-clicking the preview image or video deliberately keeps the browser’s normal menu.</p>
            <p>When enabled in Settings, left-click the tag, performer, studio, gallery, or group indicators on a card to jump directly to that editor. Choose <strong>Edit Everything</strong> when you want the full workspace, scraping, or AI Parse.</p>
            <div class="note"><strong>First check:</strong> FastTag edits your Stash database immediately after a save. Keep a normal Stash backup strategy.</div>
        ` },
        { id: 'editors', icon: '✏️', title: 'Editing Scenes', html: `
            <h3>Single-field editors</h3><p>Edit Tags, Performers, Studio, Galleries, or Groups when you only need one metadata type. Search the table, select or deselect rows, then save. Scraping is intentionally unavailable in these focused editors because a scraper can return several metadata types.</p>
            <h3>Edit Everything</h3><p>Edit Everything combines video, studio, group, tags, performers, suggestions, recent items, sequential navigation, StashDB scraping, and AI Parse. Selected rows use the highlighted table colour; the counters above each table show how many are selected.</p>
            <p>FastTag queues rapid saves in order and snapshots the active scene so moving between scenes cannot apply an older selection to the wrong scene.</p>
        ` },
        { id: 'search', icon: '🔎', title: 'Search and Creation', html: `
            <p>The shared search box filters tags, performers, studios, and groups. Multiple words must all occur in an item’s searchable fields. Selected and frequently used results are ranked prominently.</p>
            <p>If no suitable item exists, FastTag can create a new entity using the entered text. Newly created entities are added to the scene and made available to subsequent scenes, including sequential mode.</p>
            <div class="note"><strong>Cache note:</strong> If an entity was edited directly elsewhere in Stash and FastTag still shows its old name, use the circular refresh button. Page reloads retain FastTag’s persistent cache for speed.</div>
        ` },
        { id: 'suggestions', icon: '💡', title: 'Suggestions, Recent and Pinned', html: `
            <h3>Smart suggestions</h3><p>FastTag compares scene title, filename, and details with primary entity names and safe aliases. Exact primary performer names are prioritised. Ambiguous single-word aliases are not automatically suggested, while genuine single-name performers remain supported.</p>
            <p>A <strong>+</strong> pill is available to add; a <strong>✓</strong> pill is already selected and clicking it removes that item.</p>
            <h3>Recent and pinned items</h3><p>Recently used items provide quick access across scenes. Right-click or Alt-click an item to pin or unpin it. Pinned items remain readily available until removed. Their visibility can be controlled in Settings.</p>
        ` },
        { id: 'keyboard', icon: '⌨️', title: 'Keyboard Navigation', html: `
            <p>Use <kbd>↑</kbd> and <kbd>↓</kbd> to move between suggestion pills, recent items, tables, and creation actions. Use <kbd>←</kbd>, <kbd>→</kbd>, or <kbd>Tab</kbd> within horizontal pill rows. Press <kbd>Enter</kbd> to activate the focused item and <kbd>Escape</kbd> to close dialogs.</p>
            <p><kbd>Alt/Option</kbd> + <kbd>→</kbd> advances in sequential workflows. <kbd>Alt/Option</kbd> + <kbd>V</kbd> switches between preview and Full Video. <kbd>Alt/Option</kbd> + <kbd>O</kbd> toggles Organised/Organized status.</p>
            <p>Keyboard actions avoid capturing keystrokes while you are actively typing into text fields.</p>
        ` },
        { id: 'sequential', icon: '⏭️', title: 'Sequential and Random Workflows', html: `
            <p>Enable <strong>Sequential</strong> to work through the scene cards currently represented by the page. Next and previous controls retain the popup workflow while loading each scene’s own selections and metadata.</p>
            <p>Random untagged mode selects from unorganised or untagged scenes and displays the remaining count. Auto-Scrape can run after moving to the next scene when enabled in Workflow Settings.</p>
            <div class="warning"><strong>Remember:</strong> Search filters, page contents, and Stash query results determine which scenes are available to a sequence.</div>
        ` },
        { id: 'bulk', icon: '🧰', title: 'Bulk Editing', html: `
            <p>Bulk editors apply deliberate changes across multiple selected scenes. FastTag calculates additions and removals relative to each scene rather than blindly replacing every collection.</p>
            <p>Completion messages distinguish full success, partial success, and total failure. If any operation fails, review the reported result and retry rather than assuming every scene was changed.</p>
        ` },
        { id: 'video', icon: '🎬', title: 'Video, Scrubbing and Pop-out', html: `
            <p>Preview mode uses Stash preview media. <strong>Full Video</strong> switches to the scene stream. Enable Always Play Full Video in Settings if that should be the default.</p>
            <p>In Full Video mode, place the pointer over the video and use the mouse wheel or trackpad to scrub. Slow movements, normal scrolling, and fast flicks use configurable skip distances. Hold <kbd>Shift</kbd> to use the fine freeze step. Reset Defaults also resets the limited-display scrubbing onboarding cue.</p>
            <p>Pop Out moves the player into a draggable, resizable floating HUD. Dock returns it to the editor. FastTag remembers useful layout positions and sizes; System Settings can reset them.</p>
        ` },
        { id: 'scraping', icon: '⚡', title: 'StashDB and Scraping', html: `
            <p>Scraping is available only in Edit Everything so every returned field can be reviewed. FastTag first attempts Stash’s scene lookup and then uses cleaned title or filename search terms. The optional search field lets you correct difficult filenames without changing the scene first.</p>
            <h3>Evidence labels</h3>
            <ul><li><strong>Verified Fingerprint</strong> means a returned fingerprint was actually compared with and matched the local file.</li><li><strong>Scene Lookup</strong> means Stash found results from the scene lookup; it is not presented as fingerprint verification.</li><li><strong>Keyword Search</strong> means words from a title, filename, or manual query found the result.</li><li><strong>Performer Match</strong> shows overlap with performers already linked locally.</li><li><strong>Studio/Duration Mismatch</strong> identifies objective conflicts.</li><li><strong>Limited Comparison</strong> means some local evidence was unavailable.</li></ul>
            <p>Strong, Likely, Possible, and Likely Wrong Scene assessments combine available evidence. All results remain reviewable; a warning never silently blocks acceptance.</p>
            <h3>Saving scraper fields</h3><p>Checkboxes control title, date, cover, studio, performers, tags, and details where shown. Existing performers and tags are merged with selected scraped values. Cover images save separately so an image failure does not prevent other metadata from saving.</p>
        ` },
        { id: 'ai', icon: '✨', title: 'Gemini AI Parse', html: `
            <p>AI Parse asks Google Gemini to extract a clean title, date, studio, performers, and tags from the current filename and title. Suggestions are a review aid, not authoritative metadata.</p>
            <p>Configure the API key and model in AI Settings. Stash browser security prevents the direct Google request, so the bundled local Gemini bridge must be running. The connection test verifies authenticated model access.</p>
            <p>Each suggestion can be applied separately, or Apply All can apply the displayed set. Existing Stash entities are matched before new ones are offered. Empty AI responses are rejected and not cached; the bridge attempts fallback models before showing an error.</p>
            <div class="warning"><strong>Review AI output:</strong> Names, studios, dates, and scene interpretation can be wrong even when confidence appears high.</div>
        ` },
        { id: 'organised', icon: '✅', title: 'Organised Status', html: `
            <p>The Organised/Organized control changes the scene’s Stash status. You can toggle it from the popup header, use the virtual action row found by searching “org”, or press <kbd>Alt/Option</kbd> + <kbd>O</kbd>.</p>
            <p>Workflow Settings can automatically mark a scene organised whenever FastTag saves metadata. Disable that option if organisation is a separate review step in your library.</p>
        ` },
        { id: 'settings', icon: '⚙️', title: 'Settings Reference', html: `
            <ul><li><strong>Display:</strong> theme, ID columns, smart suggestions, recent and pinned items, and card icon clicks.</li><li><strong>Video:</strong> default Full Video behaviour and all scrubbing speeds.</li><li><strong>Workflow:</strong> automatic organised status, sequential scraping, and scraper docking behaviour.</li><li><strong>AI:</strong> Gemini key, model, connection test, auto-parse, and AI suggestions.</li><li><strong>System:</strong> layout reset, persistent cache controls, debug mode, and diagnostic logs.</li></ul>
            <p>Settings and layout preferences are stored in the current browser profile. Different browsers or devices can therefore have different FastTag preferences.</p>
        ` },
        { id: 'cache', icon: '⚡', title: 'Cache and Performance', html: `
            <p>Tags, performers, studios, groups, and galleries are cached in IndexedDB so editors can open immediately, including across network connections. The cache has a long lifetime and revalidates older data in the background.</p>
            <p>Entities created through FastTag invalidate the relevant cache and become available to following scenes. Changes made directly elsewhere in Stash may require the circular refresh button. Purge Cache in System Settings forces a complete network reload on the next search.</p>
        ` },
        { id: 'themes', icon: '🎨', title: 'Themes and Scene Cards', html: `
            <p>FastTag supports its own dark, light, and automatic themes. Scene-card detection also supports standard Stash layouts and compatible themes such as Refract.</p>
            <p>Metadata saves update Stash’s Apollo cache so the card behind the popup can update immediately. Refract-specific refresh handling is also included. Browser media context menus remain available when right-clicking previews.</p>
        ` },
        { id: 'troubleshooting', icon: '🩺', title: 'Troubleshooting', html: `
            <h3>Plugin does not open</h3><p>Confirm FastTag is enabled, use Reload Plugins after changing installation files, then hard-refresh the Stash page. Check that every JavaScript module listed in fasttag.yml exists.</p>
            <h3>Old entity name appears</h3><p>Press the circular refresh button. Use Purge Cache only if a normal refresh does not resolve it.</p>
            <h3>Gemini is unavailable</h3><p>Test the API key, confirm the local bridge task is running, and inspect the displayed error. Empty results can be retried and are not cached.</p>
            <h3>Scraper result looks wrong</h3><p>Check source, performer, studio, duration, and fingerprint badges; inspect every returned result; edit the manual search phrase; and accept only selected fields.</p>
            <h3>Reporting a problem</h3><p>Enable Debug Mode only while reproducing the issue, then Copy or Download Log from System Settings. Disable Debug Mode afterwards because it produces verbose diagnostics and longer-lived notifications.</p>
        ` },
        { id: 'privacy', icon: '🔐', title: 'Data and Privacy', html: `
            <p>Normal FastTag editing and scraping communicate with your configured Stash server and its configured scraper sources. Gemini AI Parse sends the scene filename/title and limited library-name context through the local bridge to Google Gemini.</p>
            <p>Your Gemini API key is stored in the current browser’s local storage and supplied to the local bridge for requests. Avoid sharing debug logs until you have reviewed their contents.</p>
        ` }
    ]);

    function stripHtml(value) {
        return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function searchGuide(query) {
        const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
        if (!terms.length) return GUIDE_SECTIONS.slice();
        return GUIDE_SECTIONS.filter(section => {
            const haystack = `${section.title} ${stripHtml(section.html)}`.toLowerCase();
            return terms.every(term => haystack.includes(term));
        });
    }

    function openGuide(options = {}) {
        const documentRef = root.document;
        if (!documentRef?.body) return null;
        documentRef.getElementById('fasttag-help-modal')?.remove();
        const isDark = (options.theme || 'dark') !== 'light';
        const colors = isDark
            ? { bg: '#111827', panel: '#0f172a', card: '#1e293b', text: '#f8fafc', muted: '#94a3b8', border: '#334155', accent: '#818cf8' }
            : { bg: '#f8fafc', panel: '#ffffff', card: '#f1f5f9', text: '#0f172a', muted: '#64748b', border: '#cbd5e1', accent: '#4f46e5' };
        const overlay = documentRef.createElement('div');
        overlay.id = 'fasttag-help-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000001;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;';
        overlay.innerHTML = `
            <div role="dialog" aria-modal="true" aria-labelledby="fasttag-help-title" style="width:min(1080px,96vw);height:min(780px,92vh);display:flex;flex-direction:column;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};border-radius:12px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.65);">
                <header style="display:flex;align-items:center;gap:12px;padding:13px 16px;background:${colors.panel};border-bottom:1px solid ${colors.border};">
                    <div style="min-width:0;flex:1"><div id="fasttag-help-title" style="font-size:16px;font-weight:800;">⚡ FastTag User Guide</div><div style="font-size:10.5px;color:${colors.muted};">Version ${options.version || '4.2.10'} · Available offline</div></div>
                    <input id="fasttag-help-search" type="search" placeholder="Search the guide…" aria-label="Search the FastTag guide" style="width:min(330px,42vw);padding:7px 10px;border-radius:7px;border:1px solid ${colors.border};background:${colors.card};color:${colors.text};outline:none;">
                    <button id="fasttag-help-close" type="button" aria-label="Close guide" style="border:0;background:transparent;color:${colors.muted};font-size:19px;cursor:pointer;padding:5px;">✕</button>
                </header>
                <div style="display:flex;flex:1;min-height:0;">
                    <nav id="fasttag-help-nav" aria-label="Guide sections" style="width:225px;max-width:32%;padding:9px;overflow-y:auto;background:${colors.panel};border-right:1px solid ${colors.border};"></nav>
                    <main id="fasttag-help-content" tabindex="0" style="flex:1;min-width:0;padding:20px 24px;overflow-y:auto;line-height:1.55;font-size:13px;"></main>
                </div>
            </div>`;
        documentRef.body.appendChild(overlay);

        const nav = overlay.querySelector('#fasttag-help-nav');
        const content = overlay.querySelector('#fasttag-help-content');
        const search = overlay.querySelector('#fasttag-help-search');
        let activeId = GUIDE_SECTIONS[0].id;

        const render = (sections = GUIDE_SECTIONS) => {
            if (!sections.length) {
                nav.innerHTML = '';
                content.innerHTML = `<div style="padding:30px;text-align:center;color:${colors.muted};"><strong>No guide sections matched.</strong><br>Try fewer or different words.</div>`;
                return;
            }
            if (!sections.some(section => section.id === activeId)) activeId = sections[0].id;
            nav.innerHTML = sections.map(section => `<button type="button" data-help-section="${section.id}" style="width:100%;display:flex;align-items:center;gap:7px;text-align:left;padding:8px 9px;margin-bottom:3px;border-radius:7px;border:1px solid ${section.id === activeId ? colors.accent : 'transparent'};background:${section.id === activeId ? colors.card : 'transparent'};color:${section.id === activeId ? colors.text : colors.muted};font-size:11.5px;font-weight:${section.id === activeId ? '700' : '600'};cursor:pointer;"><span>${section.icon}</span><span>${section.title}</span></button>`).join('');
            const active = sections.find(section => section.id === activeId) || sections[0];
            content.innerHTML = `<style>#fasttag-help-content h2{margin:0 0 14px;font-size:21px}#fasttag-help-content h3{margin:17px 0 5px;font-size:14px;color:${colors.accent}}#fasttag-help-content p{margin:0 0 11px}#fasttag-help-content ul{margin:5px 0 13px;padding-left:22px}#fasttag-help-content li{margin:4px 0}#fasttag-help-content kbd{padding:1px 5px;border-radius:4px;border:1px solid ${colors.border};background:${colors.card};font:11px monospace}#fasttag-help-content .note,#fasttag-help-content .warning{margin:13px 0;padding:10px 12px;border-radius:7px;background:${colors.card};border-left:3px solid ${colors.accent}}#fasttag-help-content .warning{border-left-color:#f59e0b}</style><h2>${active.icon} ${active.title}</h2>${active.html}`;
            nav.querySelectorAll('[data-help-section]').forEach(button => {
                button.onclick = () => { activeId = button.getAttribute('data-help-section'); render(sections); content.scrollTop = 0; };
            });
        };

        const close = () => { documentRef.removeEventListener('keydown', onKeyDown, true); overlay.remove(); };
        const onKeyDown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
        documentRef.addEventListener('keydown', onKeyDown, true);
        overlay.querySelector('#fasttag-help-close').onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        search.oninput = () => { const results = searchGuide(search.value); activeId = results[0]?.id || ''; render(results); };
        render();
        root.setTimeout(() => search.focus(), 0);
        return overlay;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.help = Object.freeze({ GUIDE_SECTIONS, stripHtml, searchGuide, openGuide });
}(typeof window !== 'undefined' ? window : globalThis));
