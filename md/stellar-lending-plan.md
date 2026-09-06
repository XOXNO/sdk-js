# Stellar lending SDK improvement plan

Goal: an integrator can discover markets and positions with complete types, build unsigned lending XDR, prepare it, and hand it to their wallet and RPC using documented, checked examples.

## Implementation

- [x] Generate complete Stellar read response types from committed OpenAPI, including nested fields and descriptions. Use those contracts in generated endpoints and handwritten readers. Keep the SDK build independent of unreleased adjacent packages.
- [x] Fix browser environment access, generated request-init forwarding, undefined query values, query cursor handling, and empty reserve-filter request options.
- [x] Require valid spoke IDs, forward quote referral IDs, accept supported decoded LP strategies, and make preparation's network domain explicit while retaining the existing unsigned-XDR API.
- [x] Complete the typed read factory for supported Stellar endpoints, including asset pages and detailed markets. Include wallet-balance and exact activity-page definitions as coordinated additions from the current API working tree; document deployment dependency. Remove the five helpers for routes absent from the API rather than invent backend services.
- [x] Add TypeDoc categories, parameter/unit/lifecycle documentation, and a checked market-listing and XDR integration example. Keep signing and submission under the host application's control.
- [x] Make `XOXNOClient` require and normalize the host-provided `apiUrl`; remove the legacy hardcoded API URL constants so deployment selection stays outside the SDK.
- [x] Export the canonical XOXNO Stellar deployment manifest from the SDK; keep API/SEP-10 host settings in the application and have xoxno-ui consume the SDK manifest.
- [x] Validate generated reproducibility, type contracts, request behavior, existing/new tests, ESM/CJS/browser imports, built declarations and TypeDoc. Obtain independent review of transaction and integration changes; resolve actionable feedback.

## Scope and constraints

Work in `sdk-js`; read adjacent API/types/contracts as evidence. Preserve existing API changes and SDK `.serena/`. No automatic live transactions, commits, package publication, or deployments. Add named advanced operations only where required to resolve reviewed defects; document generic composition for specialist keepers.

The canonical read contract will be OpenAPI-derived rather than a second hand-maintained copy of the incomplete `@xoxno/types` API DTOs. Existing exported reader type names remain aliases where possible. Requiring a spoke ID and removing nonexistent-route readers are deliberate API corrections and will be recorded in migration notes.

## Acceptance

- Supported committed Stellar read routes and the two pending API additions have typed, discoverable calls.
- No `unknown[]` placeholders for concrete API DTOs; response wrappers match the wire.
- All eleven reviewed integration defects have a concrete fix and suitable regression evidence.
- Examples use explicit network/controller/spoke selection, correct amount units, fresh source sequence, unsigned build, preparation, wallet signing, submission and confirmation.
- Source, tests, distribution bundles, declarations and TypeDoc validate; unrelated failures or deployment limits are recorded.

## Validation evidence

- Full Jest suite: 14 suites, 294 tests, 43 snapshots passed.
- Full package build, TypeScript declarations, ESM/CJS imports and package dry-run passed.
- NodeNext ESM and CommonJS consumer examples passed against built package exports. Fixed relative ESM declaration specifiers and prevented webpack from overwriting them.
- Browser-realm import and supply/strategy construction passed with the actual Stellar browser distribution, without global process or Buffer.
- Lint and focused TypeDoc: no errors or warnings.
- Offline generation is reproducible across swagger JSON/TS, read types and README artifacts.
- Independent transaction, read-contract and consumer/documentation reviews completed. Tuple/enum compatibility and the documented participants factory name were corrected; no outstanding verified findings.

Additional integration correction: lending account IDs accept decimal strings throughout the user builders and renewal/threshold helpers. Shared u64 encoding rejects unsafe numbers; full-width u64 string regression passed.

Limits: no live API, wallet signing or on-chain submission was performed. The balance and exact activity-page reads still require the coordinated API deployment. Stellar peer runtime tested at installed v16.0.0; v15 remains within the declared peer range but was not exercised. Existing unrelated liquid/bridge OpenAPI response omissions remain generator notices; ts-jest emits its existing configuration deprecation notice.
