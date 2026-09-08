# FastTag User Guide

FastTag adds rapid scene-card metadata editing to Stash. This guide covers version 4.4.1 and is also available as a searchable offline guide from FastTag Settings.

## Opening FastTag

Right-click the information area of a scene card to open the FastTag menu. Right-clicking the preview image or video retains the browser's normal media menu. When **Enable Card Icon Clicks** is active, left-click a card's tag, performer, studio, gallery, or group indicator to open that focused editor directly.

Use **Edit Everything** for the complete scene workflow, including video, all primary entity types, suggestions, sequential navigation, StashDB scraping, and Gemini AI Parse.

## Editing and saving

Single-field editors concentrate on one metadata type. Search, select or deselect rows, and save. Edit Everything combines studio, group, tag, and performer selection. Highlighted rows and selected pills represent the values that will be retained.

FastTag serialises rapid saves and snapshots the scene being edited. Bulk operations report complete, partial, or total failure rather than treating every attempted operation as successful.

## Search, creation, suggestions, recent items, and pins

The shared search filters entity lists. New tags, performers, studios, and other supported entities can be created from the entered text. Items created through FastTag invalidate the relevant cache and are available on following scenes.

Smart suggestions compare scene title, filename, and details against database names. Exact primary performer names are preferred. Ambiguous single-word aliases are excluded from automatic suggestions, but genuine single-name primary performers remain supported.

Suggestion and recent pills use `+` when available to add and `✓` when already selected. Clicking a selected pill removes it. Right-click or Alt-click items to pin or unpin them.

## Keyboard and sequential navigation

Use arrow keys to move through suggestions, recent items, tables, and actions; press Enter to activate and Escape to close. `Alt/Option + Right Arrow` advances sequential editing, `Alt/Option + V` toggles Full Video, and `Alt/Option + O` toggles Organised/Organized status.

Sequential mode works through the scenes represented by the active Stash page or workflow. Random untagged mode chooses from applicable untagged scenes. Auto-Scrape can run when advancing if enabled.

## Video and mouse-wheel scrubbing

Preview mode uses Stash preview media. Full Video uses the scene stream. With the pointer over Full Video, scroll to scrub. Slow, normal, and fast wheel movement use configurable skip distances; hold Shift for the fine freeze step. The progress bar along the bottom also works as a normal timeline: click a position or drag along it to seek. Dragging pauses temporarily and resumes only when the video was playing beforehand. The pop-out control creates a draggable, resizable video HUD.

The scrubbing instruction overlay appears once per browser session and no more than five times until **Reset Defaults** is used in Video Settings.

### Editing a scene cover

In Edit Everything, select the picture button in the video controls to open the Cover Editor HUD. The existing player temporarily moves into the cover workspace and switches to Full Video when possible. Use the persistent **Play/Pause** and arrow controls to select a frame: an ordinary arrow click moves one second, while `Shift` plus an arrow click moves one frame. Hold an arrow briefly to repeat that movement automatically; releasing it, moving away or leaving the window stops immediately. Moving the pointer away does not resume a deliberately paused video. **Capture Frame** pauses automatically before capturing the displayed frame. The current Stash cover and proposed replacement remain visible below the player.

Alternatively, select **Upload** for a JPEG, PNG, or WebP image, drag an image file onto **New Cover**, or select **Paste** to read an image from the clipboard. On localhost or an HTTPS connection, the browser can normally read the clipboard directly after permission is granted. On an HTTP network address, such as a LAN IP or hostname, browser security blocks direct clipboard reading: select **Paste** and then press `Ctrl+V` or `Cmd+V` when FastTag prompts you. This fallback applies to any HTTP LAN address and is not tied to a particular IP address or port. Large images are scaled to a maximum dimension of 1920 pixels and prepared as JPEG covers. Review the proposed image and select **Set Cover** to save it through Stash. Saving updates Current Cover without closing the editor, allowing immediate next/previous navigation. If a proposed cover has not been saved, closing the editor—including through its parent popup—asks before discarding it.

The Cover Editor keeps playback, capture, upload, paste, and save controls visible together. Enable **Compact Cover Editor** in Display settings to remove secondary guidance, tighten spacing, and combine Cancel, Upload, Paste, and Set Cover in one footer row without covering or reducing either cover image. Resize either layout from the bottom-right corner; FastTag remembers separate normal and compact dimensions while keeping the editor inside the available screen. Closing it returns the existing player to its previous location—embedded in Edit Everything or in the floating video HUD—and restores its previous Preview or Full Video mode.

When Stash has a Studio Code saved for the scene, the Cover Editor displays it in the header as a read-only reference and updates it during Previous/Next navigation. Hold the eye button on an editor or floating HUD to make that window temporarily transparent; releasing the pointer or key restores it immediately.

When the Edit Everything next/previous controls move to another scene, an open Cover Editor stays open in the same position and size and loads the incoming scene’s video and covers. If a proposed cover has not been saved, FastTag asks before discarding it; cancelling that warning also cancels navigation.

FastTag prefers the full-video stream for the highest-quality frame capture. If that stream is unavailable or the browser cannot play its format, an MP4 preview becomes the fallback player with Play/Pause, frame stepping, timeline and wheel scrubbing, and **Capture Preview Frame**. If the fallback is an animated WebP image, it cannot be paused or scrubbed, but **Capture Preview Frame** captures the animation frame visible when the button is pressed. Preview captures are identified in the proposed-cover status and can be lower resolution. Upload, Paste and Drop remain available when no preview can be captured.

## StashDB scraping

Scraping is restricted to Edit Everything so all returned fields can be reviewed. FastTag attempts Stash scene lookup, then cleaned title/filename and contextual keyword searches. When a studio or performers are linked, the editable search box is prefilled with the studio and all linked performer names; individual-performer searches remain automatic fallbacks.

Use the scraper header's **Dock** control to move the results between the editor and a draggable, resizable HUD. The detached scraper HUD belongs to the open Edit Everything popup: closing that popup also closes its scraper HUD, including when a search is still running. Reopen Edit Everything and scrape again if you want to resume reviewing the session's cached results.

While the scraper is open, the circular refresh button first waits for pending automatic scene saves and then searches again using the scene's current title, studio, and linked performers. This lets newly selected or deselected metadata influence the next scrape without closing the editor. When the scraper is closed, the same button retains its normal cache-refresh behaviour.

- **Verified Fingerprint** means a returned fingerprint matched the local file.
- **Scene Lookup** is not automatically treated as fingerprint verification.
- **Keyword Search** identifies search-derived results.
- Performer, studio, duration, and title evidence contribute to ordering and assessment.
- **Limited Comparison** means local evidence was unavailable.
- **Review & Accept** warns about conflicting evidence without hiding the result.

With **Hide false positives** enabled in Match settings, FastTag hides only keyword results that conflict according to the selected matching preset or custom criteria. A close duration can protect a result when that option is enabled. Direct scene lookups and verified fingerprints are never hidden, at least one result always remains visible, and **Show hidden** reveals the filtered results at any time.

Exact stored performer IDs, full names, and multi-word aliases count as confirmed performer evidence. Ambiguous single-word aliases are labelled **Possible Alias Match** and contribute only weak supporting evidence. Completely different multi-performer casts are treated as a major conflict that normally outweighs studio and duration matches. Large combined searches initially show the top 25 ranked results; **Show all** reveals every remaining candidate. Possible matches use an amber acceptance control; green is reserved for likely or strong matches.

Title-confidence scoring ignores linked performer names, the known local studio name, connecting words, technical filename markers, and this deliberately short generic descriptor list: `sex`, `porn`, `fuck`, `fucks`, `fucked`, `fucking`, `raw`, `twink`, and `xxx`. These words are removed only from confidence analysis and remain in the actual scraper search.

Field checkboxes determine what is saved. Existing tags and performers are merged with selected scraped values. Covers save separately so a rejected image cannot prevent other metadata from saving.

When a selected scraped performer does not yet exist locally, FastTag creates the performer with the first available source image and source-specific performer ID when provided. With **Fill missing performer images** enabled in Match settings, a confidently resolved existing performer also receives the scraped image and missing source ID when their local image is blank. Existing images are never replaced. If enrichment is rejected, scene acceptance continues and new-performer creation ultimately falls back to the name alone.

Hover over any performer pill in the scraper HUD to preview the performer. FastTag prioritises the matched local profile and link; if the local profile has no image, the available scraped image is shown instead. Performers not yet in the local library use the scraper image and source profile link when provided. A short grace period lets you move the pointer from the performer pill onto the preview and click its profile link.

## Gemini AI Parse

AI Parse sends the current filename/title and limited name context through FastTag's local bridge to Google Gemini. Configure and test the API key under AI Settings. Review all AI output: confidence is not proof that metadata is correct.

Apply individual fields or use Apply All. FastTag matches existing entities before offering creation. Empty responses are rejected, remain retryable, and cause the bridge to try fallback models.

## Cache and performance

FastTag caches entity lists in IndexedDB so popups open immediately. Page reloads retain this cache. Press the circular refresh button after changing an entity directly elsewhere in Stash. Use **Purge Cache** only when a normal refresh does not resolve stale information.

## Settings and troubleshooting

Display controls theme, IDs, suggestions, recents, pins, card-icon actions, and the optional compact Cover Editor. Video controls playback defaults and scrubbing. Workflow controls organisation and sequential scraping. **Match** provides Conservative, Balanced, and Strict scraper-analysis templates; changing any template value automatically marks it **Custom (modified)**. **Restore Defaults** resets only those criteria to Balanced—the behaviour shipped by FastTag—without changing scene metadata, AI, scraper-source, or other plugin settings. AI controls Gemini. System provides layout reset, cache management, debug mode, and diagnostic log export.

If FastTag does not load, verify that it is enabled, choose **Reload Plugins**, and hard-refresh Stash. For reproducible errors, temporarily enable Debug Mode, reproduce the issue, export the log, and disable Debug Mode again.

## Privacy

Normal editing uses your Stash server and configured scraper sources. Gemini AI Parse sends scene parsing context to Google through the local bridge. The API key is kept in browser local storage and supplied to that bridge. Review logs before sharing them.
