# Design — Campaign 032 Games discovery and identity

## Hierarchy

The Games route begins with page purpose and one Suggested Next decision. The
primary recommendation uses the existing personalization kernel and reason
evidence, while near-best and rusty signals become supporting candidate inputs
or compact alternatives rather than competing shelves. Browse controls are
visibly secondary, and Browse All labels the complete catalog and its current
count.

Search and filters operate over the complete registry-backed catalog. An active
query or filter compresses/hides Suggested Next, makes the active state and
reset action obvious, and gives a distinct favorites-empty state versus a
no-match state. Card content stays compact: identity mark, title, one mechanic
sentence, domain, favorite affordance, and one honest mastery/progress signal.

## Identity grammar

Identity is a shared presentational map keyed by stable game IDs. Each entry
has one of the eight primary mechanic families, a short mechanic verb, and one
plain-language interaction sentence. The mark is a small family motif using
existing domain color tokens; it is not a per-game logo or new persistence
field. The map is tested against the generated 42-entry registry so missing
identity coverage fails deterministically.

## Game Detail

The first viewport order is identity/domain, title, mechanic sentence, tutorial
hint when applicable, compact mastery/record context, and one dominant Play
button. Favorite remains available without competing with Play. Records and
recent history remain below the play decision and continue to read from the
existing aggregate/recent/mastery seams.

## Contracts

No new storage or navigation contract is introduced. Existing route IDs,
favorite writes, mastery derivation, tutorial/session behavior, GameHost entry,
scoring/generator metadata, workout eligibility, and offline reads remain the
source of truth.
