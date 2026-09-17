# Campaign 037 — Accessibility Validation

The repository accessibility audit was run against the clean after capture:

```text
node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign037-runtime-after-clean --density 420 --json
[PASS] 0 violation(s) across 22 surface(s)
```

Result: **PASS**, 0 automated violations across all 22 captured light/dark
surfaces. The audit is static/UIAutomator-based and does not establish manual
TalkBack focus order, VoiceOver behavior, large-text behavior, reduced-motion
behavior, or physical-device reachability. Existing clipped-but-tolerated
compact controls reported by the audit remain a Campaign 038 follow-up, not a
new Campaign 037 regression.

