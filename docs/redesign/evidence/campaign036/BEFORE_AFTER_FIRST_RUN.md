# Campaign 036 before/after first-run evidence

## Capture conditions

The dedicated Android package `com.braintraining.app` was cleared with
`adb -s emulator-5554 shell pm clear com.braintraining.app` before the clean
baseline. Captures used the disposable `braintraining-ui35` AVD (Android 15 /
API 35, 1080x2400, density 420) with the repository Metro server on port 8081.
No account or network setup was added.

The baseline is retained outside Git at
`D:\Temp\campaign036-runtime-before-all`; the matching after matrix is at
`D:\Temp\campaign036-runtime-after`. The core requested matrix contains Home,
Games, Progress, Profile, Rewards, Data Management, and Game Detail in light
and dark: 14/14 baseline entries and 14/14 after entries were route-verified
and nonblank. The baseline directory also retains available extra
GameHost/Progress Activity/Progress Detail/Results captures.

## Observed state and bounded change

| Surface | Clean baseline observation | After observation |
| --- | --- | --- |
| Home | Today's Workout and Start workout were clear, but there was no explicit local/offline reassurance. | Existing CTA remains; the hero adds `Your training is ready on this device and works offline.` |
| Data Management | Hero said `Empty` when the byte metric was unavailable, while the same snapshot showed a profile, one workout instance, and quest rows. | Hero says `Ready` for initialized local state with unavailable/zero byte metrics; exact counts and safeguards remain. |
| Rewards | Collection showed `3/12 cosmetics collected (25%)` without explaining the included defaults. | Existing count remains and the Collection section explains the starter set and earned-coin path. |
| Progress / Game Detail | No sessions yet was shown honestly. | No-history state remains unchanged. |

The clean Home copy also contains the existing generic plan phrase
`balanced across your recent training` despite no history. It was observed and
left outside this narrowly bounded slice; it is a candidate for the Campaign
037 cross-surface copy audit, not a claim that all first-run copy is perfect.

## Pixel comparison

The following read-only Pillow comparison uses the matching before/after PNGs,
reports the percentage of pixels with any RGB change and RGB RMSE, and records
the exact SHA-256 for each image. The larger changes are localized to the three
observed seams; the remaining route differences are at the capture noise/
rendering level and were not treated as product changes.

| Theme/surface | Before SHA-256 | After SHA-256 | Changed pixels | RGB RMSE |
| --- | --- | --- | ---: | ---: |
| light/home | `E49EB64B50829376891F28DEAADD24AE22CE55FD32D396EE511E7E118BD0D35B` | `9B9ABBD0B8BA8C5675216FBDC2170521D87470E3F51D4069633829280DD6013E` | 12.88% | 43.46 |
| light/games | `791C157D9A4D75345CC0EE1738F3F8F73FA37F04F4F3C05B5DAE8AC59E2A490A` | `AA4D55AFD19E1139F9E471F82BC9A2BA2D4F04E03055B204D9A261E100C75D3D` | 0.02% | 1.63 |
| light/progress | `3BB125BF6718DADF7023139FB7A87EBC85BE53CEFA5DD7CAEA5C737907B3A94A` | `E006AD027E8C0D3754282E84D725E3A1FF5F9E2E0C8ADC5288F238ED24DF0164` | 0.01% | 1.13 |
| light/profile | `6EBFCD84FDA756FE823E315D9A4FEB95E82BF4F103BBCBFE2A05C16EA5FA9AC6` | `3CF524575360640BAE4596CC616698628A28D1FE534B65590D1CAA013812EFA9` | 0.02% | 1.38 |
| light/rewards | `C4FF39305823E4C320B2CAFFD7BBCFC143B0F46DF8DFB36B6274022027AD14AB` | `B59732B15E9B9E55C174701E3F4E06F850CE99B7D7B67361D4649DC14B82FBBE` | 10.54% | 27.86 |
| light/data-management | `B535AF1C5200AD799EF36FB6B0E88EF8EE040742C0B60B1BDEEAB7308EDAA23F` | `487A8B78A5DA1460BD7155349B5A50AE4A30CF1DAC9C1339BE8CD438213F8847` | 0.37% | 9.01 |
| light/game-detail | `4C42D6483247A9D4126E07B988C81E5993C6D2EF1A41FA14BAB85C7F3973A90E` | `D22A0BFF0CA4A772F2C4C20087B633003A0634E4371CD23916F655BEBAC803DF` | 0.03% | 1.78 |
| dark/home | `1DC410643250C7002B2DB51544ACB235E96243AA06C732F837FE54E66CFA42FE` | `775F1E8DB44122FC5B0E13711633DE39746E5BC5CE1145433AF25093F4131FB8` | 12.74% | 37.95 |
| dark/games | `EB160E086C7AC0429F8C46A788D4B5D891C0A7FC65F20E91272757536FDE8A11` | `9F95FEC8E022D269D7F4C40977C5DCFE9BED82004322E915D8D0858728BCE77C` | 0.01% | 2.02 |
| dark/progress | `D6DD542BEC737E873DB31BD08D91A7E6465BF04DB2950892CA0495CD291F1073` | `35770D3D9CD2ACBFF46ADC2011E079972EBBB222990867423DD23B4511C82F3C` | 0.01% | 2.02 |
| dark/profile | `0B218B88AF300712F371E72F16DFAC9A5C836D56A86F392941ABAF27BEAC5C45` | `6C939546D08BE7C8FCBDC5BEF676AC2BAF54C326D7DBA263DDB5F5369BB9EF65` | 0.01% | 1.44 |
| dark/rewards | `46314FF247C181D52E4E50F0AF778DAAEEFB03B5A1FA214CA4AAF8236292D7B2` | `7CA887262DDCBC47912A6B1840A4D9CA973EE202F3EF1ED04B32C8BDCCFC89C3` | 10.25% | 26.18 |
| dark/data-management | `C77B05E872C5683497C0D023E04A315EA75CC754FBA9DB7A64594E026D35674E` | `4A584A05007E943C4302A1EF68E8125098F0C09DB01EB9DA45CB8ABA31018246` | 0.38% | 7.93 |
| dark/game-detail | `7EEDC2AC9AFBF78FAAC7D0118F1558F81400E4D6E3CB906144C48F7FD8F1FFF0` | `AD931FF72D56DA20B366C332084B076BB7B5D3E728BD228635C4AD113908E6C6` | 0.02% | 2.54 |

