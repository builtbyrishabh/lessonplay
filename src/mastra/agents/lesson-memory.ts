import { Memory } from "@mastra/memory";

import { storage } from "~/mastra";
import { DEFAULT_LESSON_MODEL } from "./lesson-shared";

/**
 * The single place that knows how conversation history is stored.
 * `resourceId` is always the Clerk userId; `threadId` is one chat.
 */
export function getLessonMemory() {
  return new Memory({
    storage,
    options: {
      lastMessages: 40,
      generateTitle: {
        model: DEFAULT_LESSON_MODEL,
        instructions:
          "Generate a short title (3-6 words) for this conversation about building a chemistry learning game. Specific, no quotes, no trailing punctuation.",
      },
    },
  });
}
