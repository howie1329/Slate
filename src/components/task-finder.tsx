import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTaskSelection } from "@/components/task-selection";
import { formatDueDate } from "@/lib/local-date";
import type { PlannerSnapshot, PlanningLaneId } from "@/lib/planner";
import {
  taskFinderResults,
  taskFinderTitleParts,
  type TaskFinderResult,
} from "@/lib/task-finder";
import { cn } from "@/lib/utils";

const laneLabels: Record<PlanningLaneId, string> = {
  capture: "Capture",
  ready: "Ready",
  today: "Today",
  done: "Done",
};

type PopupPosition = {
  left: number;
  top: number;
  width: number;
};

export function TaskFinder({ snapshot }: { snapshot: PlannerSnapshot }) {
  const { selectTask } = useTaskSelection();
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const results = useMemo(() => taskFinderResults(snapshot, query), [query, snapshot]);
  const isOpen = query.trim().length > 0;
  const activeIndex = Math.max(0, results.findIndex((result) => result.id === activeTaskId));
  const activeResult = results[activeIndex] ?? null;

  useEffect(() => {
    function handleFindShortcut(event: globalThis.KeyboardEvent) {
      if (
        !(event.metaKey && event.key.toLocaleLowerCase() === "f")
        || event.altKey
        || event.ctrlKey
        || event.shiftKey
      ) return;

      const activeElement = document.activeElement;
      if (activeElement !== inputRef.current && isEditableElement(activeElement)) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    window.addEventListener("keydown", handleFindShortcut);
    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (inputRef.current?.parentElement?.contains(target) || popupRef.current?.contains(target)) return;
      closeFinder();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPopupPosition(null);
      return;
    }

    function positionPopup() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const width = Math.min(448, window.innerWidth - 32);
      const halfWidth = width / 2;
      setPopupPosition({
        left: Math.min(Math.max(rect.left + rect.width / 2, halfWidth + 16), window.innerWidth - halfWidth - 16),
        top: rect.bottom + 6,
        width,
      });
    }

    positionPopup();
    window.addEventListener("resize", positionPopup);
    return () => window.removeEventListener("resize", positionPopup);
  }, [isOpen]);

  useEffect(() => {
    if (!activeResult) return;
    document.getElementById(optionId(activeResult.id))?.scrollIntoView({ block: "nearest" });
  }, [activeResult]);

  function closeFinder() {
    setQuery("");
    setActiveTaskId(null);
  }

  function openTask(result: TaskFinderResult) {
    closeFinder();
    selectTask(result.id, "animate");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeFinder();
      return;
    }
    if (!isOpen || results.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(Math.max(activeIndex + direction, 0), results.length - 1);
      setActiveTaskId(results[nextIndex].id);
      return;
    }
    if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      openTask(activeResult);
    }
  }

  return (
    <div
      className={cn(
        "relative h-6 min-w-0 transition-[width] duration-200 ease-out motion-reduce:transition-none",
        isFocused || isOpen ? "w-[clamp(14rem,38vw,28rem)]" : "w-56",
      )}
      data-task-finder
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        icon={Search01Icon}
        size={11}
        strokeWidth={1.8}
      />
      <input
        aria-activedescendant={activeResult ? optionId(activeResult.id) : undefined}
        aria-autocomplete="list"
        aria-controls={isOpen ? "task-finder-results" : undefined}
        aria-expanded={isOpen}
        aria-label="Find a task"
        className="h-6 w-full appearance-none rounded-md border border-input bg-background py-0 pl-5 pr-8 text-composer text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveTaskId(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsFocused(false)}
        onFocus={() => setIsFocused(true)}
        placeholder="Find a task…"
        ref={inputRef}
        role="combobox"
        type="search"
        value={query}
      />
      {query ? (
        <button
          aria-label="Clear task finder"
          className="absolute right-0.5 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            closeFinder();
            inputRef.current?.focus();
          }}
          type="button"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} size={10} strokeWidth={1.8} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-sans text-[9px] text-muted-foreground">⌘F</kbd>
      )}

      {isOpen && popupPosition && typeof document !== "undefined"
        ? createPortal(
            <TaskFinderPopup
              activeTaskId={activeResult?.id ?? null}
              onOpenTask={openTask}
              popupPosition={popupPosition}
              query={query}
              popupRef={popupRef}
              results={results}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function TaskFinderPopup({
  activeTaskId,
  onOpenTask,
  popupPosition,
  popupRef,
  query,
  results,
}: {
  activeTaskId: string | null;
  onOpenTask: (result: TaskFinderResult) => void;
  popupPosition: PopupPosition;
  popupRef: RefObject<HTMLDivElement | null>;
  query: string;
  results: TaskFinderResult[];
}) {
  const style: CSSProperties = {
    left: popupPosition.left,
    top: popupPosition.top,
    width: popupPosition.width,
  };

  return (
    <div
      className="fixed z-50 max-h-80 -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      data-task-finder-popup
      ref={popupRef}
      style={style}
    >
      <div className="flex h-7 items-center justify-between border-b border-border px-2.5 text-metadata text-muted-foreground">
        <span>Search tasks</span>
        <span aria-live="polite" role="status">
          {results.length} {results.length === 1 ? "task" : "tasks"}
        </span>
      </div>
      {results.length > 0 ? (
        <div aria-label="Task finder results" className="max-h-[17.75rem] overflow-y-auto p-1" id="task-finder-results" role="listbox">
          {results.map((result) => (
            <TaskFinderOption
              active={result.id === activeTaskId}
              key={result.id}
              onOpenTask={onOpenTask}
              query={query}
              result={result}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-6 text-center text-section-secondary text-muted-foreground" id="task-finder-results" role="status">
          No matching tasks
        </div>
      )}
    </div>
  );
}

function TaskFinderOption({
  active,
  onOpenTask,
  query,
  result,
}: {
  active: boolean;
  onOpenTask: (result: TaskFinderResult) => void;
  query: string;
  result: TaskFinderResult;
}) {
  const metadata = resultMetadata(result);

  return (
    <div
      aria-selected={active}
      className={cn(
        "cursor-default rounded-lg px-2.5 py-2 outline-none transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
      id={optionId(result.id)}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => onOpenTask(result)}
      role="option"
    >
      <div className="truncate text-menu">
        {taskFinderTitleParts(result.title, query).map((part, index) => part.matched ? (
          <mark className="bg-transparent font-semibold text-inherit underline decoration-foreground/30 underline-offset-2" key={`${part.text}-${index}`}>
            {part.text}
          </mark>
        ) : <span key={`${part.text}-${index}`}>{part.text}</span>)}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1 text-metadata text-muted-foreground">
        <span>{laneLabels[result.lane]}</span>
        {metadata.map((item) => <span key={item}>· {item}</span>)}
      </div>
    </div>
  );
}

function resultMetadata(result: TaskFinderResult) {
  const metadata: string[] = [];
  if (result.estimateMinutes !== null) metadata.push(`${result.estimateMinutes}m`);

  if (result.badges.includes("overdue")) metadata.push("Overdue");
  else if (result.badges.includes("needs-estimate")) metadata.push("Needs estimate");
  else if (result.completedAt) metadata.push("Completed");
  else if (result.scheduledDate) metadata.push(formatDueDate(result.scheduledDate));

  return metadata;
}

function optionId(taskId: string) {
  return `task-finder-option-${taskId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return element.matches("input, textarea, select, [contenteditable='true']");
}
