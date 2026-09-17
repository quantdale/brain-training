# Audit map — Campaign 038

| Surface / condition | Protected seam | Required proof |
| --- | --- | --- |
| Home/Games/Progress/Profile/Rewards/Data/Detail | semantic labels, primary actions, tab reachability | matching native XML/screenshots and a11y audit |
| Profile/Games clipped controls | fully reachable content above the native tab bar | settled scroll XML plus interaction or deterministic geometry evidence |
| Large text | copy wraps/grows without hiding actions | ADB font-scale capture and focused source/test review |
| Reduced motion | decorative motion can settle without blocking action | ADB accessibility setting/animation observation and existing motion tests |
| SFX/haptics off | visible toggles and persisted provider state | settings source/tests plus emulator relaunch observation |
| Light/dark/system | state meaning and contrast do not rely on hue alone | native matrix and contrast/a11y validators |
| Offline/local state | no network or persistence change | offline/provenance validators and clean logcat |

