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
import {
  Cancel01Icon,
  Loading03Icon,
  Search01Icon,
  TaskAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import { formatDueDate } from "@/lib/local-date";
import type { PlannerSnapshot, PlanningLaneId } from "@/lib/planner";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import { useCreateTask } from "@/lib/planner-query";
import {
  taskFinderResults,
  taskFinderTitleParts,
  type TaskFinderResult,
} from "@/lib/task-finder";
import {
  moveTaskFinderIndex,
  taskFinderCreateInput,
  taskFinderOptions,
  type TaskFinderOption as TaskFinderOptionModel,
} from "@/lib/task-finder-interaction";
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
  const createTask = useCreateTask();
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const createPendingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeOptionKey, setActiveOptionKey] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const results = useMemo(() => taskFinderResults(snapshot, query), [query, snapshot]);
  const options = useMemo(() => taskFinderOptions(results, query), [query, results]);
  const isOpen = query.trim().length > 0;
  const activeIndex = Math.max(0, options.findIndex((option) => option.key === activeOptionKey));
  const activeOption = options[activeIndex] ?? null;

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
      if (
        createPendingRef.current
        || createTask.isPending
        || inputRef.current?.parentElement?.contains(target)
        || popupRef.current?.contains(target)
      ) return;
      closeFinder();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [createTask.isPending, isOpen]);

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
    if (!activeOption) return;
    document.getElementById(optionId(activeOption.key))?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  function closeFinder() {
    setQuery("");
    setActiveOptionKey(null);
  }

  function openTask(result: TaskFinderResult) {
    if (createPendingRef.current || createTask.isPending) return;
    closeFinder();
    selectTask(result.id, "animate");
  }

  function createTaskFromQuery() {
    const input = taskFinderCreateInput(query);
    if (!input || createPendingRef.current || createTask.isPending) return;

    createPendingRef.current = true;
    createTask.mutate(input, {
      onSuccess: (created) => {
        createPendingRef.current = false;
        closeFinder();
        selectTask(created.id, "animate");
      },
      onError: (error) => {
        createPendingRef.current = false;
        toast.error(plannerMutationErrorMessage(error, "Could not create task."));
        window.requestAnimationFrame(() => inputRef.current?.focus());
      },
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      if (!createPendingRef.current && !createTask.isPending) closeFinder();
      return;
    }
    if (!isOpen || options.length === 0) return;

    if (createPendingRef.current || createTask.isPending) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = moveTaskFinderIndex(activeIndex, direction, options.length);
      setActiveOptionKey(options[nextIndex].key);
      return;
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      if (activeOption.kind === "create") createTaskFromQuery();
      else openTask(activeOption.result);
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
        aria-activedescendant={activeOption ? optionId(activeOption.key) : undefined}
        aria-autocomplete="list"
        aria-busy={createTask.isPending}
        aria-controls={isOpen ? "task-finder-results" : undefined}
        aria-expanded={isOpen}
        aria-label="Find or create a task"
        className="h-6 w-full appearance-none rounded-md border border-input bg-background py-0 pl-5 pr-8 text-composer text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveOptionKey(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsFocused(false)}
        onFocus={() => setIsFocused(true)}
        maxLength={500}
        placeholder="Find or create a task…"
        readOnly={createTask.isPending}
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
            if (createPendingRef.current || createTask.isPending) return;
            closeFinder();
            inputRef.current?.focus();
          }}
          disabled={createTask.isPending}
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
              activeOptionKey={activeOption?.key ?? null}
              creating={createTask.isPending}
              onCreateTask={createTaskFromQuery}
              onOpenTask={openTask}
              options={options}
              popupPosition={popupPosition}
              query={query}
              popupRef={popupRef}
              results={results}
            />,
            document.body,
          )
        : null}
      <span aria-live="polite" className="sr-only" role="status">
        {createTask.isPending ? `Creating task ${query.trim()}` : ""}
      </span>
    </div>
  );
}

function TaskFinderPopup({
  activeOptionKey,
  creating,
  onCreateTask,
  onOpenTask,
  options,
  popupPosition,
  popupRef,
  query,
  results,
}: {
  activeOptionKey: string | null;
  creating: boolean;
  onCreateTask: () => void;
  onOpenTask: (result: TaskFinderResult) => void;
  options: TaskFinderOptionModel[];
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
        <span>Find or create</span>
        <span aria-live="polite" role="status">
          {results.length} {results.length === 1 ? "task" : "tasks"}
        </span>
      </div>
      <div aria-label="Task finder results" className="max-h-[17.75rem] overflow-y-auto p-1" id="task-finder-results" role="listbox">
        {results.length === 0 ? (
          <div className="px-2.5 py-2 text-section-secondary text-muted-foreground" role="presentation">
            No matching tasks
          </div>
        ) : null}
        {options.map((option) => option.kind === "task" ? (
          <TaskFinderResultOption
            active={option.key === activeOptionKey}
            disabled={creating}
            key={option.key}
            onOpenTask={onOpenTask}
            optionKey={option.key}
            query={query}
            result={option.result}
          />
        ) : (
          <TaskFinderCreateOption
            active={option.key === activeOptionKey}
            creating={creating}
            key={option.key}
            onCreateTask={onCreateTask}
            title={option.title}
          />
        ))}
      </div>
    </div>
  );
}

function TaskFinderResultOption({
  active,
  disabled,
  onOpenTask,
  optionKey,
  query,
  result,
}: {
  active: boolean;
  disabled: boolean;
  onOpenTask: (result: TaskFinderResult) => void;
  optionKey: string;
  query: string;
  result: TaskFinderResult;
}) {
  const metadata = resultMetadata(result);

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-selected={active}
      className={cn(
        "cursor-default rounded-lg px-2.5 py-2 outline-none transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        disabled ? "opacity-50" : null,
      )}
      id={optionId(optionKey)}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!disabled) onOpenTask(result);
      }}
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

function TaskFinderCreateOption({
  active,
  creating,
  onCreateTask,
  title,
}: {
  active: boolean;
  creating: boolean;
  onCreateTask: () => void;
  title: string;
}) {
  return (
    <div
      aria-disabled={creating || undefined}
      aria-label={`${creating ? "Creating" : "Create"} task ${title}`}
      aria-selected={active}
      className={cn(
        "mt-1 flex cursor-default items-center gap-2 border-t border-border px-2.5 py-2.5 outline-none transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
      id={optionId("create")}
      onClick={() => {
        if (!creating) onCreateTask();
      }}
      onPointerDown={(event) => event.preventDefault()}
      role="option"
    >
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <HugeiconsIcon
          aria-hidden="true"
          className={creating ? "animate-spin motion-reduce:animate-none" : undefined}
          icon={creating ? Loading03Icon : TaskAdd01Icon}
          size={13}
          strokeWidth={1.8}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-menu font-medium">{creating ? "Creating task…" : "Create task"}</span>
        <span className="block truncate text-metadata text-muted-foreground">{title}</span>
      </span>
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

function optionId(optionKey: string) {
  return `task-finder-option-${optionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return element.matches("input, textarea, select, [contenteditable='true']");
}
