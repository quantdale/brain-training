# Design — Campaign 045

Use `expo-doctor` as the supported compatibility authority. Align only the
reported Expo SDK57 patch family (`expo`, `expo-asset`, `expo-constants`,
`expo-router`, `expo-sharing`) through Expo tooling so package.json and the npm
lockfile remain coherent. If post-update runtime or build checks regress, back
out only this campaign's package changes and preserve the evidence.
