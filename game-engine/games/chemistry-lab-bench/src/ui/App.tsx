import { useState } from "react";
import { SandboxLabViewport } from "@learn-loop/core/ui";

import { chemistryLabTemplate } from "../content/missions";

/**
 * This is intentionally a thin adapter. The shared viewport owns the lab UI;
 * a generated game replaces only the data in content/missions.ts.
 */
export function App() {
  const [missionIndex, setMissionIndex] = useState(0);
  const mission = chemistryLabTemplate.missions[missionIndex];
  const missionTitles = chemistryLabTemplate.missions.map(
    (entry) => entry.scenario.title,
  );

  return (
    <SandboxLabViewport
      title={chemistryLabTemplate.title}
      eyebrow={chemistryLabTemplate.eyebrow}
      mission={mission}
      missionIndex={missionIndex}
      missionCount={chemistryLabTemplate.missions.length}
      missionTitles={missionTitles}
      onSelectMission={setMissionIndex}
      theme={{
        palette: "warm-lab",
        accent: "amber",
        intensity: "standard",
        headerDensity: "compact",
      }}
    />
  );
}
