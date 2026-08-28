"use client";

import type { ChatStatus } from "ai";
import { useRef, useState } from "react";

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
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CrossSmallIcon,
  FileTextIcon,
  PaperclipIcon,
  SparklesIcon,
  StopIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";
import { LESSON_MODELS, type LessonModel } from "~/mastra/agents/lesson-shared";

const MODEL_LABEL = Object.fromEntries(
  LESSON_MODELS.map((m) => [m.id, m.label]),
) as Record<LessonModel, string>;

/** Mirrors ALLOWED_TYPES in the upload route — a chapter PDF, a sheet, an image. */
const ACCEPT = ".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp";
const MAX_FILES = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  onSubmit: (text: string, files: File[]) => void | Promise<void>;
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
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)].slice(0, MAX_FILES));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((!text && files.length === 0) || disabled || isGenerating) return;
    const attached = files;
    setFiles([]);
    return onSubmit(text, attached);
  };

  return (
    <PromptInput
      className={cn("border-border bg-card rounded-2xl shadow-sm", className)}
      onSubmit={handleSubmit}
    >
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {files.map((file, index) => (
            <span
              className="border-border bg-muted text-muted-foreground flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
              key={`${file.name}-${index}`}
            >
              <FileTextIcon className="size-3.5 shrink-0" />
              <span className="max-w-48 truncate">{file.name}</span>
              <span className="text-muted-foreground/60">
                {formatSize(file.size)}
              </span>
              <button
                aria-label={`Remove ${file.name}`}
                className="hover:text-foreground -mr-0.5 ml-0.5"
                disabled={disabled}
                onClick={() => removeFile(index)}
                type="button"
              >
                <CrossSmallIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

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
          <input
            accept={ACCEPT}
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <PromptInputButton
            aria-label="Attach files"
            disabled={disabled || files.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon className="size-4" />
          </PromptInputButton>

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
