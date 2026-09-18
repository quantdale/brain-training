# Campaign 046 Real-Mechanic Coverage

This packet records representative ordinary interaction separately from the
full-catalog QA-completion pass. The objective was to put each domain's game
surface into a real, observable mechanic state before using deterministic QA
assistance for a terminal result.

| Domain | Representative mechanic observations | Result boundary |
| --- | --- | --- |
| Attention | Sustained Vigilance reached its natural timeout/target-count state; the observed timeout result was score 480, 0/26 Go hits, and 4/4 stop numbers. Other attention games exposed their live target/search/tracker boards. | Natural timeout for the canary; QA completion for the catalog pass. |
| Flexibility | Rule Flip displayed its live card board and rule-transition interaction before completion. | QA completion after the mechanic state was observed. |
| Language | Word/context/sentence game canaries exposed their selectable prompts and live answer states during the catalog pass. | QA completion for terminal coverage. |
| Logic | Order/deduction/sequence canaries exposed their live choices and rule/sequence prompts before completion. | QA completion for terminal coverage. |
| Math | Equation Builder and the arithmetic/order canaries exposed live equations, options, and answer controls. | QA completion for terminal coverage. |
| Memory | Pattern Tap Back and Running Order showed their memory board/sequence states; the existing Memory canary also completed an ordinary session. | QA completion for terminal coverage; ordinary interaction retained as a separate canary. |
| Spatial | Coordinate Turn, Grid Nav, Mental Rotation, and Transform Match showed live grids, orientation/turn prompts, or transformed-pattern choices. | QA completion after the mechanic state was observed. |
| Speed | Order Sweep showed a live smallest-number ordering task; Quick Compare showed timed larger-number choices including a timeout state; Reaction Time showed the HOLD/“DON’T TAP” signal state. | QA completion after the mechanic state was observed. |

Representative raw screenshots are retained outside Git under
`D:\Temp\campaign046-runtime`, including:

- `rule-session.png`, `pattern-session.png`, `running-session.png`, and
  `equation-session.png`;
- `coord-session.png`, `grid-session.png`, `rotation-session.png`, and
  `spatial-transform-play.png`; and
- `speed-order-session.png`, `speed-quick-session.png`, and
  `reaction-session.png`.

The distinction matters: the QA panel proves that the result/persistence path
can be exercised deterministically, while the screenshots and canary outcomes
prove that the game modules reached meaningful interactive states.
