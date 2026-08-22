# Release Notes

## 1.9.52 - Fix popup cleanup and GraphQL handling

This update fixes several regressions in the Stash Scene Manager userscript that were causing stale popup behavior and unreliable GraphQL operations.

### Fixed
- Prevented duplicate outside-click listeners from accumulating
- Ensured popup/menu cleanup removes the correct listeners and drag handlers
- Prevented multiple popup states from overlapping
- Hardened GraphQL fetch handling for non-OK HTTP responses and invalid JSON payloads
- Prevented broad removal of unrelated popup elements
- Kept popup drag cleanup tied to the active popup lifecycle

### Compatibility
- No Stash schema changes required
- Safe to install over the previous version with the provided update URL

### Install / Update
- Raw script URL: https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/a.js
