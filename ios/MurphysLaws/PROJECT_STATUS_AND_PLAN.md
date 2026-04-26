# Murphy's Laws App - Project Status & Action Plan

**Last Updated:** April 26, 2026
**Current Status:** Stable Locally - Build Green, Tests Discoverable and Executing

---

## Verified Local State

- Build succeeds (`BuildProject` green)
- Test discovery works (`GetTestList` returns 95 tests)
- Test execution works (`RunAllTests` executes 95 tests)
- No failing tests in current local run

### Latest Test Run (April 26, 2026)
- **Total:** 95
- **Passed:** 64
- **Failed:** 0
- **Skipped:** 31
- **Expected Failures:** 0
- **Not Run:** 0

---

## What Was Fixed

1. Restored active project test target wiring so tests are discoverable/executable.
2. Removed recursive project self-reference from active `project.pbxproj` to reduce navigator path confusion.
3. Re-validated build and full test run after project-file changes.

---

## Current UI Test Policy

- UI test target is included and discoverable.
- A subset of UI tests is currently skipped by test code/runtime conditions.
- This is intentional for now while active UI development continues.

Recommended next step for UI tests:
1. Re-enable a small smoke subset first (navigation + one happy path per tab).
2. Keep broader UI suite gated until selectors and launch setup stabilize.

---

## Remaining Risks

1. CI environment may still differ from local (scheme/workspace/path differences).
2. There are unrelated pre-existing workspace changes outside this fix.

---

## Next Actions

1. Run CI with this exact project-file state and confirm parity with local test counts.
2. If CI differs, capture scheme/test plan and workspace path from CI logs.
3. Commit project-file stabilization changes in a dedicated commit.
4. Optionally remove obsolete top-level project artifacts to prevent future workspace mismatch.

---

## Definition of Done for This Stabilization

- [x] Build succeeds locally
- [x] Non-zero test discovery
- [x] Full test run executes
- [x] Zero local test failures
- [ ] CI parity confirmed
- [ ] Stabilization commit merged
