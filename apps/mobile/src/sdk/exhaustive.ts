/**
 * Reducer exhaustiveness (Change 075, design D1/D2).
 *
 * WHAT THIS GUARANTEES
 * --------------------
 * A game reducer whose `default` branch calls {@link assertExhaustive} will not
 * COMPILE if an action is added to the union without a handler. That is the
 * whole point: the compiler is the check, and the failure message names the
 * member. Before this, a game could add an action, forget a branch, ship, and
 * silently drop the transition at runtime — and 27 reducers carried a comment
 * CLAIMING the guarantee their code did not provide.
 *
 * WHAT IT DOES NOT GUARANTEE
 * --------------------------
 * It does not make a reducer CORRECT, only COMPLETE. A `case` that exists and
 * returns the wrong thing still type-checks.
 *
 * WHY ONE HELPER
 * --------------
 * 42 copies of the same three lines is the duplication that produced this
 * problem in the first place. Expressed once it is a named concept with one
 * docstring, and the catalog guard can assert a uniform shape.
 *
 * HOW THE TWO FAILURE MODES STAY DISTINCT
 * ---------------------------------------
 * The single call covers two situations that need different reactions, and the
 * typing separates them:
 *
 * - A **declared action with no `case`** is a COMPILE error. The switch narrows
 *   `action` to the residual members, and those are not assignable to the
 *   `never` parameter. The error names the member, and the fix is a `case`.
 * - A value from **outside the declared union** (JSON, a bridge, an untyped
 *   caller) has no type to check, so it reaches the call at runtime with a
 *   `never`-typed but real value. The function then throws with a message that
 *   says exactly that — a construction bug at the call site, not a missing
 *   reducer branch.
 *
 * The runtime path deliberately THROWS rather than returning the current state.
 * Silently ignoring an action is how a reducer drops a transition with no symptom
 * at all: the player sees stale state and nothing appears in any log. A loud
 * failure at a construction bug is strictly better than a correct-looking wrong
 * state, and the compile-time path means this is never reached for a declared
 * action.
 */

/**
 * Assert a reducer handled every declared action, and fail loudly on input
 * outside the union.
 *
 * @param action The residual action, which the switch has narrowed to the
 *   members with no `case` above. Its type must be `never` — that IS the
 *   assertion, and the compiler is what enforces it.
 * @param context Game/phase prefix, so a failure names WHICH reducer lost
 *   coverage rather than just "unreachable".
 */
export function assertExhaustive(action: never, context: string): never {
  // Unreachable for well-typed input: `never` has no inhabitants. Reached at
  // runtime only for a value constructed outside the declared union, so the
  // message says so rather than blaming the reducer.
  const seen: unknown = action;
  throw new Error(
    `Unknown action reached the reducer fallback in ${context}: ${JSON.stringify(seen)}. ` +
      `This action is not part of the declared union, so a caller is constructing ` +
      `actions outside the reducer's type — a bug at the call site, not a missing case.`,
  );
}
