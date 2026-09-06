# FastTag 4.3.0 refactor baseline

This is the frozen reference for work on `feature/runtime-refactor`. The public
`main` branch and the live Stash plugin must not be updated from this branch
until the refactor has passed automated and manual regression testing.

## Source reference

- Branch point and published package commit: `4e0e08d0931188bb5d4d553533d327fa6ef7859a`
- Plugin version: `4.3.0`
- `fasttag.js`: 15,529 lines / 839,005 bytes
- `fasttag.js` SHA-256: `ef8c0f846ed05db4c9c3d723b70950185dea44889c7531f515a90487394b8d97`
- Total first-party FastTag JavaScript: 1,020,426 bytes, including the optional help module

The size target is maintainability, not a smaller total download. Code should
move only when the destination has a clear ownership boundary and testable API.

## Critical script load order

1. `tabulator.min.js`
2. `fasttag-core.js`
3. `fasttag-entities.js`
4. `fasttag-storage.js`
5. `fasttag-integrations.js`
6. `fasttag-gemini.js`
7. `fasttag-scraper.js`
8. `fasttag-scraper-ui.js`
9. `fasttag-preview.js`
10. `fasttag-cover-editor.js`
11. `fasttag-ui.js`
12. `fasttag-editors.js`
13. `fasttag-workflows.js`
14. `fasttag.js`

`fasttag-help.js` remains an optional, lazily loaded asset and must not become a
critical startup dependency.

## Published module APIs

The coordinator consumes these frozen namespaces under `window.FastTag`:

- `core`
- `entities`
- `storage`
- `integrations`
- `gemini`
- `scraper`
- `scraperUi`
- `preview`
- `coverEditor`
- `ui`
- `editors`
- `workflows`

An extraction may extend a module deliberately, but it must not silently remove
or rename an existing member. API and load-order changes require a matching
contract-test update in the same commit.

## Automated baseline

Run from the repository root:

```sh
node tests/run-all.js
```

Baseline result on 2026-09-06:

- 14 JavaScript syntax checks passed
- 2 Python syntax checks passed
- 14 test suites passed

The module-contract suite also verifies exact critical load order, module file
presence, the coordinator's module dependencies, lazy help loading, and the
`__fastTagRuntimeInitialized` duplicate-startup guard.

## Manual baseline status

The released 4.3.0 build is the user-tested behavioural reference. A separate
test-plugin installation and the full checklist in `REFACTOR_PLAN.md` are still
required before any refactored build may be merged or published.
