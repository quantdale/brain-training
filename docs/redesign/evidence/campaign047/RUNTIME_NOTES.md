# Campaign 047 Runtime and Safety Notes

All device actions used emulator-local ADB/UIAutomator input on
`emulator-5554`; no host mouse/keyboard injection and no second emulator were
used. The release package ran without Metro during the relaunch and
Data Management checks.

The Data Management screen explicitly states that previews never write data,
and the experiment followed that boundary. Replace preview was collected for
risk disclosure but not applied to the retained 44-session database. The
repository's disposable-fixture tests provide the applied replace and
mid-import rollback coverage.

The release artifact intentionally rejects `run-as` because it is signed as a
non-debuggable APK. This is an expected release boundary, not a persistence
failure. The UI count readback and earlier debug database pull were used
instead of weakening the artifact or clearing user data.

No source files under the database, portability, game, or SDK modules changed
for this campaign.
