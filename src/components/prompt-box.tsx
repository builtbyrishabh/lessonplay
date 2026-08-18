"use client";

import type { ChatStatus } from "ai";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "~/components/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ArrowUpIcon, ChevronDownIcon, SparklesIcon, StopIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { LESSON_MODELS, type LessonModel } from "~/mastra/agents/lesson-shared";

const MODEL_LABEL = Object.fromEntries(
  LESSON_MODELS.map((m) => [m.id, m.label]),
) as Record<LessonModel, string>;

/** Composer used on the home page and inside a chat (ported from v0-clone). */
export function PromptBox({
  onSubmit,
  onStop,
  status = "ready",
  disabled = false,
  placeholder = "Describe the chapter, activity, or concept…",
  model,
  onModelChange,
  autoFocus = false,
  compact = false,
  className,
}: {
  onSubmit: (text: string) => void | Promise<void>;
  onStop?: () => void;
  status?: ChatStatus;
  disabled?: boolean;
  placeholder?: string;
  model: LessonModel;
  onModelChange: (model: LessonModel) => void;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const isGenerating = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || disabled || isGenerating) return;
    return onSubmit(text);
  };

  return (
    <PromptInput
      className={cn("border-border bg-card rounded-2xl shadow-sm", className)}
      onSubmit={handleSubmit}
    >
      <PromptInputBody>
        <PromptInputTextarea
          autoFocus={autoFocus}
          className={cn(
            "min-h-[52px] bg-transparent px-4 pt-3.5 text-base",
            compact && "min-h-[44px] px-3 pt-3 text-sm",
          )}
          disabled={disabled}
          placeholder={placeholder}
        />
      </PromptInputBody>
      <PromptInputFooter className="px-2 pb-2">
        <PromptInputTools>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PromptInputButton className="gap-1.5" disabled={disabled}>
                <SparklesIcon className="size-4" />
                <span>{MODEL_LABEL[model]}</span>
                <ChevronDownIcon className="text-muted-foreground size-3.5" />
              </PromptInputButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {LESSON_MODELS.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => onModelChange(m.id)}>
                  <SparklesIcon className="size-4" />
                  <div className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {m.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </PromptInputTools>

        <PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-lg"
            disabled={disabled || (isGenerating && !onStop)}
            onStop={onStop}
            status={status}
          >
            {isGenerating ? (
              <StopIcon className="size-4" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </PromptInputSubmit>
        </PromptInputTools>
      </PromptInputFooter>
    </PromptInput>
  );
}
