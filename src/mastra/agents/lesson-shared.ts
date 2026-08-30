/**
 * Constants shared by the lesson agent factory and every route that drives it.
 * Model ids are AI Gateway strings ("vercel/<provider>/<model>").
 */

/**
 * The allow-list, and the only place a model is enabled. Everything else runs
 * through `resolveLessonModel`, so trimming this array is enough to lock the
 * app to one model — stored settings and request bodies naming a removed model
 * fall back to the default rather than erroring.
 *
 * Currently OpenAI GPT 5.6 Luna only, and the composer no longer offers a
 * picker. Re-enabling choice means adding entries here AND restoring the
 * dropdown in `prompt-box.tsx`; the request-body plumbing (`use-settings` →
 * `chat-provider` → `resolveLessonModel` in the chat route) is still intact.
 */
export const LESSON_MODELS = [
  {
    id: "vercel/openai/gpt-5.6-luna",
    label: "GPT 5.6 Luna",
    description: "Default. Thinks it through.",
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
