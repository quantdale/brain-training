# App Store readiness

**Classification (2026-11-08): not yet a release candidate.** The app builds and
runs on the iOS Simulator. It has not run on a physical iPhone, been signed, or
been through TestFlight.

Requirements below were checked on 2026-11-08 against Apple's
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)
and [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
Recheck them before submitting.

## Requires the owner

1. Apple Developer Program membership, team ID, and acceptance of its agreements.
2. Final app name and bundle identifier. Branding is deferred by the constitution;
   `Brain Training` and `com.braintraining.app` are placeholders, and the
   identifier cannot change once a build is uploaded under it.
3. A hosted privacy policy URL. Guideline 5.1.1(i) requires a link in App Store
   Connect and inside the app. `src/app/about.tsx` holds the in-app statement and
   needs that link added. The policy must also explain retention and deletion.
4. Support URL, App Store description, keywords, category and age rating answers.
5. App Privacy answers. The code supports "Data Not Collected": no network APIs
   (enforced by `scripts/validate-offline.mjs`), analytics, ads or accounts.
6. A decision on the four open dependency advisories in `.agent/KNOWN_ISSUES.md`.
7. Testing on a physical iPhone and in TestFlight.

## Done and verified

| Item | Evidence |
|---|---|
| iOS 27 SDK launch | Scene life cycle adopted (ADR-0006); Release Simulator app runs |
| Upload SDK | Xcode 27.2 exceeds the current iOS 26 SDK minimum |
| Minimum iOS | 17.0 in the built app |
| Encryption declaration | `ITSAppUsesNonExemptEncryption=false`; only SHA-256 checksums are used |
| Privacy manifest | Declared in `app.json`; merged into the build |
| App icon | 1024x1024 with no alpha channel |
| Data deletion | Profile > Backups & data > Delete All Local Data |
| Health claims | None found in user-facing copy; About states it is not medical advice |
| QA controls | Gated by `isDevBuild()` / `__DEV__` |
| Large text | No clipped or undersized controls at maximum size on iPhone 17e |

## Building for upload

Set a build number that increases for each upload of a version, then archive
from Xcode with your team selected, or use EAS once `eas.json` exists:

```bash
cd apps/mobile
IOS_BUILD_NUMBER=2 npx expo prebuild --platform ios --clean --no-install
pod install --project-directory=ios
open ios/BrainTraining.xcworkspace   # Select the team, then Product > Archive
```

The app is iPhone-only (`supportsTablet` is unset). App Store Connect therefore
needs iPhone screenshots only: at least one at 1206x2622 or 1179x2556, which the
iPhone 18 Pro Simulator produces directly. Enabling iPad support would add
13-inch iPad screenshots and needs layout review.

## Known gaps before release

- Open-source license notices are not shown in the app.
- Device backups include `Documents`, so wiped data can return if an older device
  backup is restored. The app states this; it does not exclude the database.
- CI builds with the iOS 26.5 SDK, so it does not exercise iOS 27 behaviour.
- Performance has not been measured on physical hardware.
