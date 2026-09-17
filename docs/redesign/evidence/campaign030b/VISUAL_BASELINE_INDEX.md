# Campaign 030B visual baseline index

Date: 2026-09-17

This is the current native baseline captured from the successfully assembled
APK on disposable `braintraining-c030b` (`emulator-5562`), at 1080 x 2400 and
density 420. The source/effective product baseline is Campaign 029's
`5c484a08083963439360cb06c229249029f90531`; the exact assembled APK installed
for this matrix is SHA-256
`80e9b29134fb70d7c45e30b7bb0fb6f6e90ee8d358b1880b9fa236e98a877d6a`.

## Matrix manifest

The authoritative machine-readable manifest is:

    D:\Temp\campaign030b-visual-baseline-verified\manifest.json

Capture command:

    node scripts/qa/ui-capture.mjs --device emulator-5562 --out D:\Temp\campaign030b-visual-baseline-verified --theme light,dark

Result: **22/22 captures PASS**. Each entry has `blank: false`,
`routeVerified: true`, a non-empty PNG, and a non-empty UIAutomator XML tree.
The pixel column below counts distinct RGB values in a 135 x 300 sample of the
PNG; it is a reproducible variance sanity check, not a claim about full-image
unique colors. Every value is well above the blank-frame threshold.

| Surface | Theme | Route | PNG outside Git | SHA-256 | Bytes | Dimensions | Sampled colors | Pixels | XML |
| --- | --- | --- | --- | --- | ---: | --- | ---: | --- | --- |
| Home / Today | light | `/` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\home.png` | `c2bbe244ccef1eee3ce9c12cf3a0b1bec21ea9eb23c2851e46f3741405d020a4` | 193049 | 1080x2400 | 1648 | PASS | route-verified |
| Games | light | `/games` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\games.png` | `6c46e802522392131c6214ceeb5f3fc209944460d671d06c83030ef1fd512d43` | 233998 | 1080x2400 | 2629 | PASS | route-verified |
| Game Detail | light | `/game-detail/memory` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\game-detail.png` | `44c793e11dbf946a06a15382b40756a3ad07a21f04ac8ccfc77a720a1a2dd807` | 217447 | 1080x2400 | 2087 | PASS | route-verified |
| Progress | light | `/progress` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\progress.png` | `0077d2eb82583a3dda0611666babda0060c062892de3fff833e392981319e101` | 239491 | 1080x2400 | 2026 | PASS | route-verified |
| Progress Activity | light | `/progress-activity` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\progress-activity.png` | `0067160acd29c4bd026f1871e2b186b94213e30b6a9cc38589c410be04c8c456` | 216257 | 1080x2400 | 1596 | PASS | route-verified |
| Progress Detail | light | `/progress-detail` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\progress-detail.png` | `fee2dacb75f30ab5f15894e7cceaebb74002724b8e1941b4e4da2ee24a3215b0` | 276986 | 1080x2400 | 2498 | PASS | route-verified |
| Profile | light | `/profile` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\profile.png` | `6f75ce3caa0dde4a593f89dc4fd17eeae0fcd7e2079a2d78e2b1bf10d73b2e1d` | 220773 | 1080x2400 | 2535 | PASS | route-verified |
| Rewards | light | `/rewards` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\rewards.png` | `0e9f1f4191391cb7344314ae9bad959f4c414c4bd43a61c38125b3cd02357e89` | 326863 | 1080x2400 | 3545 | PASS | route-verified |
| Data Management | light | `/data-management` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\data-management.png` | `97b91c0d1ab4eb32999b05a90511917f48e90e3dca6b6639ab9a87cec12d9eef` | 317667 | 1080x2400 | 2403 | PASS | route-verified |
| Results | light | `/results` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\results.png` | `57690b5c52a4cb73228fcf2fcf887f7b665349eb01857b3d75b021452929a692` | 192554 | 1080x2400 | 2445 | PASS | route-verified |
| Game intro/tutorial | light | `/game/memory` | `D:\Temp\campaign030b-visual-baseline-verified\default\light\game-intro.png` | `3872dc4f24ab9f48ce1679f47fd70a85982477d2dc36216e77008de68c76b092` | 183189 | 1080x2400 | 2098 | PASS | route-verified |
| Home / Today | dark | `/` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\home.png` | `02e1f96485620a6b2c5d77edf8246dc507387470260555053795e08573808f93` | 186039 | 1080x2400 | 1929 | PASS | route-verified |
| Games | dark | `/games` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\games.png` | `621df16c890cc63bb1851a6082339ae5795881f8cb341a532b936f214eadacc1` | 223404 | 1080x2400 | 2657 | PASS | route-verified |
| Game Detail | dark | `/game-detail/memory` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\game-detail.png` | `4e72433b701dabb2ba2f740ca24cbe9c839a6b5aec0187b43d1efead3e57bc0a` | 192211 | 1080x2400 | 1938 | PASS | route-verified |
| Progress | dark | `/progress` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\progress.png` | `366cd4ac95022b57c1a0134c6ea962a9b09d75b6520be81b8dfae01382c164c2` | 218205 | 1080x2400 | 2463 | PASS | route-verified |
| Progress Activity | dark | `/progress-activity` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\progress-activity.png` | `89b36c47fd3801a6b1c5373cec641f21b14a09fef373138c7784f12371bc6d49` | 198726 | 1080x2400 | 1803 | PASS | route-verified |
| Progress Detail | dark | `/progress-detail` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\progress-detail.png` | `36bcf6344cdb13f13130ae2e06e5aa5817ce204511400afe4f530b86a79bb885` | 250695 | 1080x2400 | 2946 | PASS | route-verified |
| Profile | dark | `/profile` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\profile.png` | `58f07811840e500d55237af9ba8c4c38ed3335b8a1bb63535835ad2f6ff4a9b5` | 208906 | 1080x2400 | 2859 | PASS | route-verified |
| Rewards | dark | `/rewards` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\rewards.png` | `8582ef4529c46a6ac50900ac6f86246e0190c0cf19fac8639d2d0a482a00eddb` | 300757 | 1080x2400 | 3614 | PASS | route-verified |
| Data Management | dark | `/data-management` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\data-management.png` | `770f36035a41d1e430e287657fd1a67d967dff379b0b2a365fc74b2a77a7cb1f` | 297499 | 1080x2400 | 2844 | PASS | route-verified |
| Results | dark | `/results` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\results.png` | `e26d9965c46490664250d53d5b18b6c9778bce391e593635a9cd70e2bbdc7f7b` | 173158 | 1080x2400 | 2608 | PASS | route-verified |
| Game intro/tutorial | dark | `/game/memory` | `D:\Temp\campaign030b-visual-baseline-verified\default\dark\game-intro.png` | `d812845141f93a1dcfb0936ee9565d3ffde325f5f9ef77125f36359816df6f7d` | 172894 | 1080x2400 | 2011 | PASS | route-verified |

## State-specific and dynamic screenshot evidence

The following files are also outside Git under `D:\Temp`. They are separate
from the static matrix and are not stale Campaign 029/030 images. The same
135 x 300 sampled-color check was applied.

| State | Screenshot | SHA-256 | Bytes | Sampled colors | Dimensions | Classification |
| --- | --- | --- | ---: | ---: | --- | --- |
| First hard-gate Home / Today | `D:\Temp\campaign030b-render-proof\screen-20260917-164456.png` | `f3597894ce55e1ed921362cfd3e44dbfaeba246b626140a4c3f9fb72e32a1bf4` | 193670 | 1757 full-image colors | 1080x2400 | rendered product pixels |
| Cue Keeper tutorial | `D:\Temp\campaign030b-flow\screen-20260917-164729.png` | `e02da7d8c5d9a582d645aad4edfcec77a2066824d18dffde681cbedb774174a3` | 248415 | 2144 | 1080x2400 | screenshot; tutorial XML alongside |
| Cue Keeper tutorial demo | `D:\Temp\campaign030b-flow\screen-20260917-164747.png` | `a0835d46ada8e1cb3b829fc8a1e0246a55d9724c5f235d5d119755f4d95dc988` | 240200 | 2211 | 1080x2400 | screenshot; tutorial XML alongside |
| Cue Keeper intro ready | `D:\Temp\campaign030b-flow\screen-20260917-164837.png` | `cbcd0cf0089d2a9d3e63e81294e82e63b3b8f7d35a746c33c1174e67763b248e` | 195397 | 1879 | 1080x2400 | screenshot; intro XML alongside |
| Cue Keeper active gameplay | `D:\Temp\campaign030b-flow\screen-20260917-164915.png` | `3d08ad62f06eaeeb2d3db7cd7ef59a0b63c7f49d6c0b87a5b61aca8fdd1ca221` | 110760 | 1726 | 1080x2400 | screenshot; active session XML |
| Cue Keeper pause overlay | `D:\Temp\campaign030b-flow\screen-20260917-164943.png` | `fd715df18395c41dd9dcef06d564d4a9c4de14abed0d1bf05d536b2cd3776ed9` | 51971 | 718 | 1080x2400 | screenshot; pause XML |
| Cue Keeper round/result transition | `D:\Temp\campaign030b-flow\screen-20260917-165008.png` | `ad572322097c0bed370f10e2a9975e52b3b37dba92db471f85fce7c9c6da5bdb` | 112239 | 1812 | 1080x2400 | screenshot; result XML |
| Cue Keeper completed Result | `D:\Temp\campaign030b-flow\screen-20260917-165031.png` | `759431c6b9c46a3566ef2d179ff42329321a5d1ba049192ac859a49c1ab5fb24` | 156396 | 1819 | 1080x2400 | screenshot; populated result XML |
| Context Fit next-game intro | `D:\Temp\campaign030b-flow\screen-20260917-165105.png` | `132e7e8acf7699f534776c5271293c251413defcb19d17a643b87d099c6c1a36` | 183800 | 2227 | 1080x2400 | screenshot; continuation XML |
| Context Fit active gameplay | `D:\Temp\campaign030b-flow\screen-20260917-165132.png` | `f7ad177c931383b5260cf268b02aac45184227bc94b803e52ef62174b8a5524f` | 115439 | 1103 | 1080x2400 | screenshot; session XML |
| Context Fit completed Result | `D:\Temp\campaign030b-flow\screen-20260917-165159.png` | `a53bc7e0e9912ae29e7f7a785bc798e56bce68875b2338c0bc93b7bbebb85b3a` | 144377 | 1716 | 1080x2400 | screenshot; result XML |
| Transform Match completed Result | `D:\Temp\campaign030b-flow\screen-20260917-165255.png` | `f44e91a2f30fc4854ea81718ef2cc3a3bd15bc04b92a725566d1a04ae6e82443` | 136443 | 1690 | 1080x2400 | screenshot; result XML |
| Fold Match Result / workout completion | `D:\Temp\campaign030b-flow\screen-20260917-165349.png` | `0a2bc580b2bf8ffb92f31da4b08b26324147600c375b3e8e11bb46b58e0c255a` | 140424 | 1766 | 1080x2400 | screenshot; workout-complete XML |
| Home after 4/4 completion | `D:\Temp\campaign030b-flow\home-complete-20260917-1655.png` | `ef8529e624148d49d2fa3cf91578bef944ae92e0090c7bc756b844513474e55f` | 186568 | 1799 | 1080x2400 | screenshot; home-complete XML |
| Profile after completion | `D:\Temp\campaign030b-flow\profile-complete-20260917-1700.png` | `0ddde66c2119c6184898e8085c2cdfc73440c3d9bc21046eb883b88c83eaaf8c` | 222414 | 2575 | 1080x2400 | screenshot; profile XML |
| Background interruption, pause restored | `D:\Temp\campaign030b-resume\pause-after-background-relaunch.png` | `ec3d174df5137f5cec9f6b29dc00875f1044e23591d4a756b3293f5146773454` | 54174 | 757 | 1080x2400 | screenshot; pause-overlay XML |
| Home after process kill | `D:\Temp\campaign030b-resume\home-after-process-kill.png` | `9670857a92e2ca4897db52842a655680012d9440ea87d10fea33ca648bfabbdc` | 187162 | 1933 | 1080x2400 | screenshot; Home XML |
| Home with 1/4 persisted | `D:\Temp\campaign030b-resume\home-persisted1.png` | `fb4885faf29f903e476e3696908244e16cb5ca6e5090001c786c140cbf6d187f` | 184201 | 1932 | 1080x2400 | screenshot; persisted Home XML |
| Storage unavailable error state | `D:\Temp\campaign030b-error\storage-unavailable.png` | `230cb8804a9b8fb9b4abe051ec924a06e0188ce10e6bf4e44b55f8fddaaab78d` | 116088 | 904 | 1080x2400 | screenshot; visible Retry action |

One delayed capture during the background experiment showed the launcher and
is intentionally excluded. One delayed “active” capture showed a round result
and is not used to claim an active state. The indexed active/pause/result files
above are the states supported by their corresponding XML and direct visual
inspection.

## Visual observations

- Light and dark routes both render actual product surfaces; they are not merely
  theme-switched copies of a blank frame.
- Games visibly combines a recommendation/featured area with search, browse
  chips, and the broad catalog.
- Game Detail visibly includes a meaningful no-history state (“play once to see
  records”) on the selected Memory route.
- Progress, Profile, Rewards, and Data Management show real current data. The
  exact assembled-APK matrix was captured with the persisted one-leg (1/4)
  fixture; completion-specific examples are listed separately in the dynamic
  table. Data Management also reports the caveat that its hero says `Empty`
  while table counters show persisted rows; see the golden-path and cross-check
  documents.
- The storage-error fixture visibly explains that local data is not lost and
  exposes Retry. One Retry tap did not recover within that attempt; a controlled
  force-stop/relaunch returned to the persisted Home screen.

## Accessibility and structure companion

The exact matrix audit is:

    node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign030b-visual-baseline-verified --density 420 --out D:\Temp\campaign030b-visual-baseline-verified\a11y.json

Result: all interactive nodes were labelled. Twenty of 22 surfaces had no
measured violation. Both light and dark `progress-detail` captures contain one
43dp interactive row (`Cue Keeper. Last played Sep 17`, 347 x 43dp), producing
two total under-44dp findings. The Games and Profile outputs also retain the
existing clipped-under-tab-bar notes: Color Stroop/Flexibility game/New and
Buy Shield for 150 coins respectively. These are follow-up accessibility/layout
findings, not silently removed from the audit. This automated audit is not a
WCAG certification.
