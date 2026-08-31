"use client";

import type { ChatStatus, FileUIPart } from "ai";
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
  ArrowUpIcon,
  CrossSmallIcon,
  FileTextIcon,
  PaperclipIcon,
  SpinnerIcon,
  StopIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";
import { toFileParts, uploadFile } from "~/lib/upload";

/** Mirrors ALLOWED_TYPES in the upload route — a chapter PDF, a sheet, an image. */
const ACCEPT = ".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp";
const MAX_FILES = 5;

/** One attachment and where it is in its upload. */
type Attachment = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  /** Set once `status` is "done" — the part sent with the message. */
  part?: FileUIPart;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Composer used on the home page and inside a chat (ported from v0-clone). */
export function PromptBox({
  onSubmit,
  onStop,
  uploadThreadId,
  status = "ready",
  disabled = false,
  placeholder = "Describe the chapter, activity, or concept…",
  defaultValue,
  autoFocus = false,
  compact = false,
  className,
}: {
  onSubmit: (text: string, files: FileUIPart[]) => void | Promise<void>;
  onStop?: () => void;
  /** Thread prefix files upload into — known before send so attach can begin. */
  uploadThreadId: string;
  status?: ChatStatus;
  disabled?: boolean;
  placeholder?: string;
  /** Prefills the composer on mount — used to carry a prompt in from the
   *  landing page (`/chats?q=…`). The field stays uncontrolled after that. */
  defaultValue?: string;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Any attachment still in flight blocks send — the whole point is that the
  // upload finishes BEFORE the message goes, so the bubble appears instantly.
  const uploading = attachments.some((a) => a.status === "uploading");

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const room = Math.max(0, MAX_FILES - attachments.length);
    for (const file of Array.from(incoming).slice(0, room)) {
      const id = crypto.randomUUID();
      setAttachments((prev) => [
        ...prev,
        { id, name: file.name, size: file.size, status: "uploading" },
      ]);
      // Fire the upload now, while the teacher is still typing.
      uploadFile(uploadThreadId, file)
        .then((uploaded) => {
          const [part] = toFileParts([uploaded]);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "done", part } : a,
            ),
          );
        })
        .catch(() => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "error" } : a)),
          );
        });
    }
  };

  const removeFile = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (disabled || isGenerating || uploading) return;
    const parts = attachments
      .filter((a): a is Attachment & { part: FileUIPart } => Boolean(a.part))
      .map((a) => a.part);
    if (!text && parts.length === 0) return;
    setAttachments([]);
    return onSubmit(text, parts);
  };

  return (
    <PromptInput
      className={cn("border-border bg-card rounded-2xl shadow-sm", className)}
      onSubmit={handleSubmit}
    >
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachments.map((a) => (
            <span
              className={cn(
                "border-border bg-muted text-muted-foreground flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
                a.status === "error" &&
                  "border-destructive/50 text-destructive",
              )}
              key={a.id}
            >
              {a.status === "uploading" ? (
                <SpinnerIcon className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <FileTextIcon className="size-3.5 shrink-0" />
              )}
              <span className="max-w-48 truncate">{a.name}</span>
              <span
                className={cn(
                  "text-muted-foreground/60",
                  a.status === "error" && "text-destructive/70",
                )}
              >
                {a.status === "error" ? "failed" : formatSize(a.size)}
              </span>
              <button
                aria-label={`Remove ${a.name}`}
                className="hover:text-foreground -mr-0.5 ml-0.5"
                disabled={disabled}
                onClick={() => removeFile(a.id)}
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
          defaultValue={defaultValue}
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
            disabled={disabled || attachments.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon className="size-4" />
          </PromptInputButton>
        </PromptInputTools>

        <PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-lg"
            disabled={disabled || uploading || (isGenerating && !onStop)}
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
