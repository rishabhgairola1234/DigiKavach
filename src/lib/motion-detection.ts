// Shared between the live Camera Intelligence panel and the saved-recording
// timeline so both classify raw pixel-difference intensity into the same
// three bands with the same colors. This measures motion MAGNITUDE only --
// it says nothing about danger, violence, or threat level.

export type MotionLevel = "none" | "moderate" | "high";

export const MOTION_MODERATE_THRESHOLD = 0.04;
export const MOTION_HIGH_THRESHOLD = 0.12;

export function motionLevelForIntensity(intensity: number): MotionLevel {
  if (intensity > MOTION_HIGH_THRESHOLD) return "high";
  if (intensity > MOTION_MODERATE_THRESHOLD) return "moderate";
  return "none";
}

export const MOTION_LEVEL_BAR_CLASSES: Record<MotionLevel, string> = {
  none: "bg-border",
  moderate: "bg-priority-medium",
  high: "bg-priority-high",
};
