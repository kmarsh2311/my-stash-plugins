# FastTag User Guide

FastTag adds rapid scene-card metadata editing to Stash. This guide covers version 4.2.9 and is also available as a searchable offline guide from FastTag Settings.

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

Preview mode uses Stash preview media. Full Video uses the scene stream. With the pointer over Full Video, scroll to scrub. Slow, normal, and fast wheel movement use configurable skip distances; hold Shift for the fine freeze step. The pop-out control creates a draggable, resizable video HUD.

The scrubbing instruction overlay appears once per browser session and no more than five times until **Reset Defaults** is used in Video Settings.

## StashDB scraping

Scraping is restricted to Edit Everything so all returned fields can be reviewed. FastTag attempts Stash scene lookup, then cleaned title/filename keyword searches. A manual search phrase is available for difficult filenames.

- **Verified Fingerprint** means a returned fingerprint matched the local file.
- **Scene Lookup** is not automatically treated as fingerprint verification.
- **Keyword Search** identifies search-derived results.
- Performer, studio, duration, and title evidence contribute to ordering and assessment.
- **Limited Comparison** means local evidence was unavailable.
- **Review & Accept** warns about conflicting evidence without hiding the result.

Field checkboxes determine what is saved. Existing tags and performers are merged with selected scraped values. Covers save separately so a rejected image cannot prevent other metadata from saving.

## Gemini AI Parse

AI Parse sends the current filename/title and limited name context through FastTag's local bridge to Google Gemini. Configure and test the API key under AI Settings. Review all AI output: confidence is not proof that metadata is correct.

Apply individual fields or use Apply All. FastTag matches existing entities before offering creation. Empty responses are rejected, remain retryable, and cause the bridge to try fallback models.

## Cache and performance

FastTag caches entity lists in IndexedDB so popups open immediately. Page reloads retain this cache. Press the circular refresh button after changing an entity directly elsewhere in Stash. Use **Purge Cache** only when a normal refresh does not resolve stale information.

## Settings and troubleshooting

Display controls theme, IDs, suggestions, recents, pins, and card-icon actions. Video controls playback defaults and scrubbing. Workflow controls organisation and sequential scraping. AI controls Gemini. System provides layout reset, cache management, debug mode, and diagnostic log export.

If FastTag does not load, verify that it is enabled, choose **Reload Plugins**, and hard-refresh Stash. For reproducible errors, temporarily enable Debug Mode, reproduce the issue, export the log, and disable Debug Mode again.

## Privacy

Normal editing uses your Stash server and configured scraper sources. Gemini AI Parse sends scene parsing context to Google through the local bridge. The API key is kept in browser local storage and supplied to that bridge. Review logs before sharing them.
