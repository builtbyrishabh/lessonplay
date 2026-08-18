/**
 * Hand-off from the home page to a freshly created chat: the home page creates
 * the thread, stashes the first prompt here, navigates, and the chat page sends
 * it once on mount. sessionStorage survives the navigation but not a new tab.
 */
const KEY = (threadId: string) => `lessonplay:pending-prompt:${threadId}`;

export function setPendingPrompt(threadId: string, text: string) {
  sessionStorage.setItem(KEY(threadId), text);
}

export function takePendingPrompt(threadId: string): string | null {
  const text = sessionStorage.getItem(KEY(threadId));
  if (text !== null) sessionStorage.removeItem(KEY(threadId));
  return text;
}
