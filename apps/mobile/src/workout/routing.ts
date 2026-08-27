import type { Href } from "expo-router";
import type { WorkoutSessionProvenance } from "./session-provenance";

/** Build a game route, carrying exact workout-leg ownership when applicable. */
export function gameHref(
  gameId: string,
  provenance?: WorkoutSessionProvenance | null,
): Href {
  const base = `/game/${gameId}`;
  if (!provenance || provenance.gameId !== gameId) {
    return base as Href;
  }
  return `${base}?workoutKey=${encodeURIComponent(
    provenance.instanceKey,
  )}&workoutIndex=${provenance.legIndex}` as Href;
}
