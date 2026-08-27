import { createContext, useContext } from "react";

import type { WorkoutSessionProvenance } from "./session-provenance";

const WorkoutSessionLaunchContext = createContext<WorkoutSessionProvenance | null>(
  null,
);

export function WorkoutSessionLaunchProvider({
  provenance,
  children,
}: {
  provenance: WorkoutSessionProvenance | null;
  children?: React.ReactNode;
}) {
  return (
    <WorkoutSessionLaunchContext.Provider value={provenance}>
      {children}
    </WorkoutSessionLaunchContext.Provider>
  );
}

/** Launch ownership for the current game route, or null for standalone play. */
export function useWorkoutSessionLaunch(): WorkoutSessionProvenance | null {
  return useContext(WorkoutSessionLaunchContext);
}
