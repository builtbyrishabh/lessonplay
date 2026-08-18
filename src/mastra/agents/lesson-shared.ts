/**
 * Constants shared by the lesson agent factory and every route that drives it.
 * Model ids are AI Gateway strings ("vercel/<provider>/<model>").
 */
export const LESSON_MODELS = [
  {
    id: "vercel/anthropic/claude-sonnet-4.5",
    label: "Sonnet",
    description: "Default. Fast and capable.",
  },
  {
    id: "vercel/anthropic/claude-opus-4.5",
    label: "Opus",
    description: "Slower, more careful.",
  },
] as const;

export type LessonModel = (typeof LESSON_MODELS)[number]["id"];

export const DEFAULT_LESSON_MODEL: LessonModel = LESSON_MODELS[0].id;

/** Unknown / disabled models fall back to the default rather than erroring. */
export function resolveLessonModel(candidate: unknown): LessonModel {
  return LESSON_MODELS.some((m) => m.id === candidate)
    ? (candidate as LessonModel)
    : DEFAULT_LESSON_MODEL;
}

export const LESSON_MAX_STEPS = 20;
export const LESSON_MODEL_SETTINGS = { temperature: 0.5 } as const;

/** Trace hook passed through the factory so routes can time agent construction. */
export type LessonTrace = {
  id: string;
  log: (event: string, data?: Record<string, unknown>) => void;
};
