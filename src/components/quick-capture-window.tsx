import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearQuickCaptureDraft,
  getQuickCaptureDraft,
  isTauriWindow,
  setQuickCaptureDraft,
  type QuickCaptureDraft,
} from "@/lib/planner";
import { hideQuickCapture } from "@/lib/window-mode";
import { useCreateTask, usePlannerState, useUndoQuickCapture } from "@/lib/planner-query";

type QuickCaptureConfirmation = {
  id: string;
  revision: number;
};

export function QuickCaptureWindow() {
  const planner = usePlannerState();
  const createTask = useCreateTask();
  const undoQuickCapture = useUndoQuickCapture();
  const inputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<number | undefined>(undefined);
  const confirmationTimerRef = useRef<number | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [confirmation, setConfirmation] = useState<QuickCaptureConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriWindow()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void listen("quick-capture://opened", () => {
      void restoreDraft();
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => () => {
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    if (confirmationTimerRef.current !== undefined) {
      window.clearTimeout(confirmationTimerRef.current);
    }
  }, []);

  async function restoreDraft() {
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    if (confirmationTimerRef.current !== undefined) {
      window.clearTimeout(confirmationTimerRef.current);
    }

    setConfirmation(null);
    setError(null);

    let draft: QuickCaptureDraft | null = null;
    try {
      draft = await getQuickCaptureDraft();
    } catch {
      draft = null;
    }

    setTitle(draft?.title ?? "");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    setError(null);

    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = window.setTimeout(() => {
      void setQuickCaptureDraft(nextTitle);
    }, 250);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle || createTask.isPending || undoQuickCapture.isPending) {
      return;
    }

    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }

    setError(null);
    createTask.mutate(
      {
        title: trimmedTitle,
        estimateMinutes: null,
        scheduledDate: null,
        source: "manual-quick-capture",
      },
      {
        onSuccess: (created) => {
          setTitle("");
          void clearQuickCaptureDraft();
          setConfirmation({ id: created.id, revision: created.revision });
          confirmationTimerRef.current = window.setTimeout(() => {
            void hideQuickCapture();
          }, 5000);
        },
        onError: (mutationError) => {
          setError(mutationError instanceof Error ? mutationError.message : "Could not save capture.");
        },
      },
    );
  }

  function handleDiscard() {
    if (draftTimerRef.current !== undefined) {
      window.clearTimeout(draftTimerRef.current);
    }
    if (confirmationTimerRef.current !== undefined) {
      window.clearTimeout(confirmationTimerRef.current);
    }

    setTitle("");
    setConfirmation(null);
    setError(null);
    void clearQuickCaptureDraft();
    void hideQuickCapture();
  }

  function handleUndo() {
    if (!confirmation || undoQuickCapture.isPending) {
      return;
    }

    if (confirmationTimerRef.current !== undefined) {
      window.clearTimeout(confirmationTimerRef.current);
    }

    undoQuickCapture.mutate(
      { id: confirmation.id, expectedRevision: confirmation.revision },
      {
        onSuccess: () => {
          setConfirmation(null);
          void planner.refetch();
          void hideQuickCapture();
        },
        onError: async (mutationError) => {
          await planner.refetch();
          setConfirmation(null);
          setError(
            String(mutationError).includes("stale-quick-capture")
              ? "This capture changed and can’t be undone."
              : "This capture can’t be undone.",
          );
        },
      },
    );
  }

  return (
    <main
      aria-label="Quick capture"
      className="flex h-dvh min-h-0 flex-col overflow-hidden rounded-[14px] bg-background px-3 py-3 text-foreground ring-1 ring-border/70"
      data-window-mode="quick-capture"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          void hideQuickCapture();
        }
      }}
    >
      <form className="flex min-h-10 items-center gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="quick-capture-title">
          Quick capture title
        </label>
        <Input
          ref={inputRef}
          aria-describedby="quick-capture-status"
          aria-invalid={Boolean(error)}
          className="h-10 flex-1 text-menu"
          disabled={createTask.isPending || undoQuickCapture.isPending}
          id="quick-capture-title"
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Capture a thought"
          value={title}
        />
        <Button
          className="h-10 px-3 text-menu"
          disabled={!title.trim() || createTask.isPending || undoQuickCapture.isPending}
          type="submit"
        >
          {createTask.isPending ? (
            <HugeiconsIcon className="animate-spin motion-reduce:animate-none" icon={Loading03Icon} strokeWidth={1.8} />
          ) : (
            "Add"
          )}
        </Button>
      </form>

      <div
        aria-live="polite"
        className="flex min-h-6 items-center justify-between gap-2 pt-2 text-menu-label"
        id="quick-capture-status"
        role={error ? "alert" : "status"}
      >
        {error ? (
          <span className="min-w-0 truncate text-destructive">{error}</span>
        ) : confirmation ? (
          <span className="flex min-w-0 items-center gap-2 truncate text-primary">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate">Added to Backlog</span>
            <Button
              className="h-6 shrink-0 px-1.5 text-menu-label text-primary"
              disabled={undoQuickCapture.isPending}
              onClick={handleUndo}
              type="button"
              variant="link"
            >
              Undo
            </Button>
          </span>
        ) : (
          <span className="truncate text-muted-foreground">Backlog · no estimate or date</span>
        )}
        {title.trim() && !createTask.isPending && !undoQuickCapture.isPending ? (
          <Button
            className="h-6 shrink-0 px-1.5 text-menu-label text-muted-foreground"
            onClick={handleDiscard}
            type="button"
            variant="ghost"
          >
            Discard
          </Button>
        ) : null}
      </div>
    </main>
  );
}
