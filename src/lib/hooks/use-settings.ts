"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_LESSON_MODEL,
  type LessonModel,
  resolveLessonModel,
} from "~/mastra/agents/lesson-shared";

export interface Settings {
  model: LessonModel;
}

const DEFAULT_SETTINGS: Settings = { model: DEFAULT_LESSON_MODEL };
const STORAGE_KEY = "lessonplay-settings";
const UPDATE_EVENT = "lessonplay-settings-updated";

// Cached snapshot so getSnapshot returns a stable reference between reads.
let cachedRaw: string | null = null;
let cachedSettings: Settings = DEFAULT_SETTINGS;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(UPDATE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(UPDATE_EVENT, callback);
  };
}

function getSnapshot(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSettings;
  cachedRaw = raw;
  cachedSettings = parse(raw);
  return cachedSettings;
}

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as { model?: unknown };
    return { model: resolveLessonModel(parsed.model) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Client-side preferences (model). Persisted in localStorage. */
export function useSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_SETTINGS,
  );

  const updateSettings = (next: Partial<Settings>) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...settings, ...next }),
      );
      window.dispatchEvent(new Event(UPDATE_EVENT));
    } catch (error) {
      console.warn("Failed to save settings", error);
    }
  };

  return { settings, updateSettings };
}
