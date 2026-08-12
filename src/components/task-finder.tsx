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
import type { LocalDate, PlannerSnapshot, PlanningLaneId } from "@/lib/planner";
import { plannerMutationErrorMessage } from "@/lib/planner-errors";
import {
  useCreateTask,
  useSetTaskCompleted,
  useSetTaskScheduledDate,
  useUpdateTask,
} from "@/lib/planner-query";
import {
  taskFinderResults,
  taskFinderTitleParts,
  type TaskFinderResult,
} from "@/lib/task-finder";
import {
  emptyTaskFinderCreationDraft,
  emptyTaskFinderFilters,
  filterTaskFinderResults,
  hasTaskFinderFilters,
  moveTaskFinderIndex,
  taskFinderActionEffect,
  taskFinderActions,
  taskFinderCreateInput,
  taskFinderEmptyState,
  taskFinderOptions,
  type TaskFinderAction,
  type TaskFinderActionId,
  type TaskFinderCreationDraft,
  type TaskFinderEmptyState,
  type TaskFinderFilters,
  type TaskFinderOption as TaskFinderOptionModel,
} from "@/lib/task-finder-interaction";
import { cn } from "@/lib/utils";

const laneLabels: Record<PlanningLaneId, string> = {
  capture: "Capture",
  ready: "Ready",
  today: "Today",
  done: "Done",
};

const filterLanes: PlanningLaneId[] = ["capture", "ready", "today", "done"];

type PopupPosition = {
  left: number;
  top: number;
  width: number;
};

export function TaskFinder({ snapshot }: { snapshot: PlannerSnapshot }) {
  const { selectTask } = useTaskSelection();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const setTaskCompleted = useSetTaskCompleted();
  const setTaskScheduledDate = useSetTaskScheduledDate();
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const actionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mutationPendingRef = useRef(false);
  const dateBeforeTodayRef = useRef<LocalDate | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFinderFilters>(emptyTaskFinderFilters);
  const [creationDraft, setCreationDraft] = useState<TaskFinderCreationDraft>(emptyTaskFinderCreationDraft);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [activeOptionKey, setActiveOptionKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const titleResults = useMemo(() => taskFinderResults(snapshot, query), [query, snapshot]);
  const results = useMemo(
    () => filterTaskFinderResults(titleResults, filters),
    [filters, titleResults],
  );
  const options = useMemo(() => taskFinderOptions(results, query), [query, results]);
  const emptyState = taskFinderEmptyState(
    query,
    titleResults.length,
    results.length,
    filters,
  );
  const activeOption = options.find((option) => option.key === activeOptionKey) ?? options[0] ?? null;
  const activeIndex = activeOption ? options.findIndex((option) => option.key === activeOption.key) : -1;
  const activeTask = activeOption?.kind === "task" ? activeOption.result : null;
  const actions = activeTask ? taskFinderActions(activeTask) : [];
  const mutationPending = mutationPendingRef.current
    || createTask.isPending
    || updateTask.isPending
    || setTaskCompleted.isPending
    || setTaskScheduledDate.isPending;

  useEffect(() => {
    function handleGlobalShortcut(event: globalThis.KeyboardEvent) {
      const key = event.key.toLocaleLowerCase();
      if (
        event.metaKey
        && key === "f"
        && !event.altKey
        && !event.ctrlKey
        && !event.shiftKey
      ) {
        const activeElement = document.activeElement;
        if (activeElement !== inputRef.current && isEditableElement(activeElement)) return;

        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (!(event.metaKey && event.key === "Enter") || event.altKey || event.ctrlKey || event.shiftKey) return;
      const activeElement = document.activeElement;
      const finderOwnsFocus = activeElement instanceof Node && (
        inputRef.current?.parentElement?.contains(activeElement)
        || popupRef.current?.contains(activeElement)
      );
      if (!finderOwnsFocus) return;

      event.preventDefault();
      createTaskFromQuery();
    }

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  });

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        mutationPendingRef.current
        || inputRef.current?.parentElement?.contains(target)
        || popupRef.current?.contains(target)
      ) return;
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
        left: Math.min(
          Math.max(rect.left + rect.width / 2, halfWidth + 16),
          window.innerWidth - halfWidth - 16,
        ),
        top: rect.bottom + 6,
        width,
      });
    }

    positionPopup();
    window.addEventListener("resize", positionPopup);
    return () => window.removeEventListener("resize", positionPopup);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || options.length === 0) {
      if (activeOptionKey !== null) setActiveOptionKey(null);
      return;
    }
    if (!options.some((option) => option.key === activeOptionKey)) {
      setActiveOptionKey(options[0].key);
    }
  }, [activeOptionKey, isOpen, options]);

  useEffect(() => {
    if (!activeOption) return;
    document.getElementById(optionId(activeOption.key))?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  function resetFinderState() {
    setQuery("");
    setFilters(emptyTaskFinderFilters());
    setCreationDraft(emptyTaskFinderCreationDraft());
    dateBeforeTodayRef.current = null;
    setCreationError(null);
    setActiveOptionKey(null);
    setStatusMessage("");
  }

  function closeFinder() {
    if (mutationPendingRef.current) return;
    resetFinderState();
    setIsOpen(false);
  }

  function openTask(result: TaskFinderResult) {
    if (mutationPending) return;
    closeFinder();
    selectTask(result.id, "animate");
  }

  function createTaskFromQuery() {
    if (mutationPendingRef.current || mutationPending) return;
    const createResult = taskFinderCreateInput(query, creationDraft, snapshot.today);
    if (!createResult.ok) {
      if (createResult.error === "invalid-estimate") {
        setCreationError("Enter a positive whole-minute estimate.");
        setActiveOptionKey("create");
        setIsOpen(true);
      }
      return;
    }

    mutationPendingRef.current = true;
    setPendingAction("create");
    setStatusMessage(`Creating task ${createResult.input.title}`);
    createTask.mutate(createResult.input, {
      onSuccess: (created) => {
        mutationPendingRef.current = false;
        setPendingAction(null);
        resetFinderState();
        setIsOpen(false);
        selectTask(created.id, "animate");
      },
      onError: (error) => {
        mutationPendingRef.current = false;
        setPendingAction(null);
        const message = plannerMutationErrorMessage(error, "Could not create task.");
        setStatusMessage(message);
        toast.error(message);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      },
    });
  }

  function runTaskAction(action: TaskFinderActionId) {
    if (!activeTask || mutationPendingRef.current || mutationPending) return;
    const effect = taskFinderActionEffect(activeTask, action, snapshot.today);
    if (!effect) return;
    if (effect.type === "open") {
      openTask(activeTask);
      return;
    }

    mutationPendingRef.current = true;
    setPendingAction(action);
    setStatusMessage(`${actionLabel(action)} ${activeTask.title}`);
    const onSuccess = () => {
      mutationPendingRef.current = false;
      setPendingAction(null);
      setStatusMessage(`${actionSuccessMessage(action)} ${activeTask.title}`);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };
    const onError = (error: unknown) => {
      mutationPendingRef.current = false;
      setPendingAction(null);
      const message = plannerMutationErrorMessage(error, "Could not update task.");
      setStatusMessage(message);
      toast.error(message);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    if (effect.type === "set-completed") {
      setTaskCompleted.mutate(effect.input, { onError, onSuccess });
    } else if (effect.type === "set-scheduled-date") {
      setTaskScheduledDate.mutate(effect.input, { onError, onSuccess });
    } else {
      updateTask.mutate(effect.input, { onError, onSuccess });
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeFinder();
      return;
    }
    if (!isOpen || options.length === 0) return;

    if (mutationPending) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = moveTaskFinderIndex(Math.max(activeIndex, 0), direction, options.length);
      setActiveOptionKey(options[nextIndex].key);
      return;
    }
    if (
      event.key === "ArrowRight"
      && activeTask
      && event.currentTarget.selectionStart === query.length
      && event.currentTarget.selectionEnd === query.length
    ) {
      event.preventDefault();
      actionButtonRefs.current[0]?.focus();
      return;
    }
    if (event.key === "Enter" && !event.metaKey && activeOption) {
      event.preventDefault();
      if (activeOption.kind === "create") createTaskFromQuery();
      else openTask(activeOption.result);
    }
  }

  function updateLaneFilter(lane: PlanningLaneId) {
    if (mutationPending) return;
    setFilters((current) => ({ ...current, lane: current.lane === lane ? null : lane }));
    setActiveOptionKey(null);
  }

  function updateAttentionFilter(filter: "overdue" | "needsEstimate") {
    if (mutationPending) return;
    setFilters((current) => ({ ...current, [filter]: !current[filter] }));
    setActiveOptionKey(null);
  }

  function updateCreationDraft(patch: Partial<TaskFinderCreationDraft>) {
    setCreationDraft((current) => ({ ...current, ...patch }));
    setCreationError(null);
  }

  function toggleToday() {
    if (creationDraft.addToToday) {
      updateCreationDraft({
        addToToday: false,
        scheduledDate: dateBeforeTodayRef.current,
      });
      return;
    }
    dateBeforeTodayRef.current = creationDraft.scheduledDate;
    updateCreationDraft({ addToToday: true });
  }

  return (
    <div
      className={cn(
        "relative h-6 min-w-0 transition-[width] duration-200 ease-out motion-reduce:transition-none",
        isOpen ? "w-[clamp(14rem,38vw,28rem)]" : "w-56",
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
        aria-busy={mutationPending}
        aria-controls={options.length > 0 ? "task-finder-results" : undefined}
        aria-expanded={isOpen}
        aria-label="Find or create a task"
        className="h-6 w-full appearance-none rounded-md border border-input bg-background py-0 pl-5 pr-8 text-composer text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:appearance-none"
        maxLength={500}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveOptionKey(null);
          setCreationError(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleInputKeyDown}
        placeholder="Find or create a task…"
        readOnly={mutationPending}
        ref={inputRef}
        role="combobox"
        type="search"
        value={query}
      />
      {query || hasTaskFinderFilters(filters) ? (
        <button
          aria-label="Clear task finder"
          className="absolute right-0.5 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={mutationPending}
          onClick={() => {
            if (mutationPending) return;
            resetFinderState();
            inputRef.current?.focus();
            setIsOpen(true);
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
              actionButtonRefs={actionButtonRefs}
              actions={actions}
              activeOptionKey={activeOption?.key ?? null}
              activeTask={activeTask}
              creationDraft={creationDraft}
              creationError={creationError}
              emptyState={emptyState}
              filters={filters}
              mutationPending={mutationPending}
              onAction={runTaskAction}
              onClearFilters={() => {
                setFilters(emptyTaskFinderFilters());
                setActiveOptionKey(null);
              }}
              onCreateTask={createTaskFromQuery}
              onOpenTask={openTask}
              onSelectCreate={() => setActiveOptionKey("create")}
              onToggleAttentionFilter={updateAttentionFilter}
              onToggleLaneFilter={updateLaneFilter}
              onToggleToday={toggleToday}
              onUpdateCreationDraft={updateCreationDraft}
              options={options}
              pendingAction={pendingAction}
              popupPosition={popupPosition}
              popupRef={popupRef}
              query={query}
              resultCount={results.length}
              inputRef={inputRef}
            />,
            document.body,
          )
        : null}
      <span aria-live="polite" className="sr-only" role="status">{statusMessage}</span>
    </div>
  );
}

function TaskFinderPopup({
  actionButtonRefs,
  actions,
  activeOptionKey,
  activeTask,
  creationDraft,
  creationError,
  emptyState,
  filters,
  inputRef,
  mutationPending,
  onAction,
  onClearFilters,
  onCreateTask,
  onOpenTask,
  onSelectCreate,
  onToggleAttentionFilter,
  onToggleLaneFilter,
  onToggleToday,
  onUpdateCreationDraft,
  options,
  pendingAction,
  popupPosition,
  popupRef,
  query,
  resultCount,
}: {
  actionButtonRefs: RefObject<Array<HTMLButtonElement | null>>;
  actions: TaskFinderAction[];
  activeOptionKey: string | null;
  activeTask: TaskFinderResult | null;
  creationDraft: TaskFinderCreationDraft;
  creationError: string | null;
  emptyState: TaskFinderEmptyState;
  filters: TaskFinderFilters;
  inputRef: RefObject<HTMLInputElement | null>;
  mutationPending: boolean;
  onAction: (action: TaskFinderActionId) => void;
  onClearFilters: () => void;
  onCreateTask: () => void;
  onOpenTask: (result: TaskFinderResult) => void;
  onSelectCreate: () => void;
  onToggleAttentionFilter: (filter: "overdue" | "needsEstimate") => void;
  onToggleLaneFilter: (lane: PlanningLaneId) => void;
  onToggleToday: () => void;
  onUpdateCreationDraft: (patch: Partial<TaskFinderCreationDraft>) => void;
  options: TaskFinderOptionModel[];
  pendingAction: string | null;
  popupPosition: PopupPosition;
  popupRef: RefObject<HTMLDivElement | null>;
  query: string;
  resultCount: number;
}) {
  const style: CSSProperties = {
    left: popupPosition.left,
    top: popupPosition.top,
    width: popupPosition.width,
  };
  const createActive = activeOptionKey === "create";

  return (
    <div
      className="fixed z-50 flex max-h-[min(20rem,calc(100vh-4rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      data-task-finder-popup
      ref={popupRef}
      style={style}
    >
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-2.5 text-metadata text-muted-foreground">
        <span>Find or create</span>
        <span aria-live="polite" role="status">
          {resultCount} {resultCount === 1 ? "task" : "tasks"}
        </span>
      </div>

      <TaskFinderFilters
        disabled={mutationPending}
        filters={filters}
        onClear={onClearFilters}
        onToggleAttention={onToggleAttentionFilter}
        onToggleLane={onToggleLaneFilter}
      />

      {emptyState === "instructions" ? (
        <div className="min-h-0 flex-1 px-3 py-5 text-center text-section-secondary text-muted-foreground">
          Type to find an existing task or create new work.
        </div>
      ) : (
        <div
          aria-label="Task finder results"
          className="min-h-0 flex-1 overflow-y-auto p-1"
          id="task-finder-results"
          role="listbox"
        >
          {emptyState ? (
            <div className="px-2.5 py-2 text-section-secondary text-muted-foreground" role="presentation">
              {emptyState === "filtered-no-match" ? "No tasks match these filters" : "No matching tasks"}
            </div>
          ) : null}
          {options.map((option) => option.kind === "task" ? (
            <TaskFinderResultOption
              active={option.key === activeOptionKey}
              disabled={mutationPending}
              key={option.key}
              onOpenTask={onOpenTask}
              optionKey={option.key}
              query={query}
              result={option.result}
            />
          ) : (
            <TaskFinderCreateOption
              active={option.key === activeOptionKey}
              creating={pendingAction === "create"}
              key={option.key}
              onSelect={onSelectCreate}
              title={option.title}
            />
          ))}
        </div>
      )}

      {activeTask ? (
        <TaskFinderActionStrip
          actionButtonRefs={actionButtonRefs}
          actions={actions}
          disabled={mutationPending}
          inputRef={inputRef}
          onAction={onAction}
          pendingAction={pendingAction}
          taskTitle={activeTask.title}
        />
      ) : null}

      {createActive ? (
        <TaskFinderCreationDetails
          draft={creationDraft}
          error={creationError}
          inputRef={inputRef}
          mutationPending={mutationPending}
          onCreate={onCreateTask}
          onToggleToday={onToggleToday}
          onUpdate={onUpdateCreationDraft}
          pending={pendingAction === "create"}
        />
      ) : null}

      <TaskFinderShortcutFooter activeTask={activeTask} createActive={createActive} />
    </div>
  );
}

function TaskFinderFilters({
  disabled,
  filters,
  onClear,
  onToggleAttention,
  onToggleLane,
}: {
  disabled: boolean;
  filters: TaskFinderFilters;
  onClear: () => void;
  onToggleAttention: (filter: "overdue" | "needsEstimate") => void;
  onToggleLane: (lane: PlanningLaneId) => void;
}) {
  return (
    <div aria-label="Task filters" className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      {filterLanes.map((lane) => (
        <FilterChip
          active={filters.lane === lane}
          disabled={disabled}
          key={lane}
          label={laneLabels[lane]}
          onClick={() => onToggleLane(lane)}
        />
      ))}
      <FilterChip
        active={filters.overdue}
        disabled={disabled}
        label="Overdue"
        onClick={() => onToggleAttention("overdue")}
      />
      <FilterChip
        active={filters.needsEstimate}
        disabled={disabled}
        label="Needs estimate"
        onClick={() => onToggleAttention("needsEstimate")}
      />
      {hasTaskFinderFilters(filters) ? (
        <button
          className="ml-auto rounded px-1.5 py-0.5 text-metadata text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          disabled={disabled}
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-md px-1.5 py-0.5 text-metadata outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
      onClick={() => {
        if (!disabled) onOpenTask(result);
      }}
      onPointerDown={(event) => event.preventDefault()}
      role="option"
    >
      <div className="truncate text-menu">
        {taskFinderTitleParts(result.title, query).map((part, index) => part.matched ? (
          <mark
            className="bg-transparent font-semibold text-inherit underline decoration-foreground/30 underline-offset-2"
            key={`${part.text}-${index}`}
          >
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
  onSelect,
  title,
}: {
  active: boolean;
  creating: boolean;
  onSelect: () => void;
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
        if (!creating) onSelect();
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
      <span className="min-w-0 flex-1">
        <span className="block text-menu font-medium">{creating ? "Creating task…" : "Create task"}</span>
        <span className="block truncate text-metadata text-muted-foreground">{title}</span>
      </span>
      {!creating ? <kbd className="text-[9px] text-muted-foreground">⌘↵</kbd> : null}
    </div>
  );
}

function TaskFinderCreationDetails({
  draft,
  error,
  inputRef,
  mutationPending,
  onCreate,
  onToggleToday,
  onUpdate,
  pending,
}: {
  draft: TaskFinderCreationDraft;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  mutationPending: boolean;
  onCreate: () => void;
  onToggleToday: () => void;
  onUpdate: (patch: Partial<TaskFinderCreationDraft>) => void;
  pending: boolean;
}) {
  function handleNestedEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    inputRef.current?.focus();
  }

  return (
    <div
      aria-label="New task details"
      className="shrink-0 border-t border-border px-2.5 py-2"
      onKeyDown={handleNestedEscape}
      role="group"
    >
      <div className="flex items-center gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Estimate in minutes</span>
          <input
            aria-invalid={Boolean(error)}
            className="h-6 w-full rounded-md border border-input bg-background px-2 text-metadata outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            disabled={mutationPending}
            inputMode="numeric"
            min="1"
            onChange={(event) => onUpdate({ estimate: event.target.value })}
            placeholder="Estimate (min)"
            step="1"
            type="number"
            value={draft.estimate}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Scheduled date</span>
          <input
            className="h-6 w-full rounded-md border border-input bg-background px-2 text-metadata outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            disabled={mutationPending || draft.addToToday}
            onChange={(event) => onUpdate({ scheduledDate: (event.target.value || null) as LocalDate | null })}
            type="date"
            value={draft.addToToday ? "" : draft.scheduledDate ?? ""}
          />
        </label>
        <button
          aria-pressed={draft.addToToday}
          className={cn(
            "h-6 shrink-0 rounded-md px-2 text-metadata outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            draft.addToToday ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
          disabled={mutationPending}
          onClick={onToggleToday}
          type="button"
        >
          Today
        </button>
        <button
          className="h-6 shrink-0 rounded-md bg-primary px-2 text-metadata font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={mutationPending}
          onClick={onCreate}
          type="button"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {error ? <p className="mt-1 text-metadata text-destructive" role="alert">{error}</p> : null}
      <p className="mt-1 text-[9px] text-muted-foreground">
        {draft.addToToday
          ? "Creates an explicit Today commitment."
          : draft.estimate.trim()
            ? "Creates estimated Backlog work; Slate derives its Planning lane."
            : "Creates unestimated Backlog work in Capture."}
      </p>
    </div>
  );
}

function TaskFinderActionStrip({
  actionButtonRefs,
  actions,
  disabled,
  inputRef,
  onAction,
  pendingAction,
  taskTitle,
}: {
  actionButtonRefs: RefObject<Array<HTMLButtonElement | null>>;
  actions: TaskFinderAction[];
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onAction: (action: TaskFinderActionId) => void;
  pendingAction: string | null;
  taskTitle: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape" || (event.key === "ArrowLeft" && index === 0)) {
      event.preventDefault();
      event.stopPropagation();
      inputRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = Math.min(Math.max(index + direction, 0), actions.length - 1);
    actionButtonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      aria-label={`Actions for ${taskTitle}`}
      className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border px-2 py-1.5"
      role="toolbar"
    >
      {actions.map((action, index) => (
        <button
          aria-label={action.description ? `${action.label}. ${action.description}` : action.label}
          className={cn(
            "rounded-md px-2 py-1 text-metadata outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            action.id === "return-capture" ? "text-muted-foreground" : "text-foreground",
          )}
          disabled={disabled}
          key={action.id}
          onClick={() => onAction(action.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          ref={(element) => { actionButtonRefs.current[index] = element; }}
          title={action.description}
          type="button"
        >
          {pendingAction === action.id ? "Working…" : action.label}
        </button>
      ))}
      {actions.some((action) => action.id === "return-capture") ? (
        <span className="w-full px-2 text-[9px] text-muted-foreground">
          Return to Capture clears the estimate and date.
        </span>
      ) : null}
    </div>
  );
}

function TaskFinderShortcutFooter({
  activeTask,
  createActive,
}: {
  activeTask: TaskFinderResult | null;
  createActive: boolean;
}) {
  return (
    <div aria-hidden="true" className="flex h-6 shrink-0 items-center gap-2 border-t border-border px-2.5 text-[9px] text-muted-foreground">
      {activeTask || createActive ? <span><kbd>↑↓</kbd> Navigate</span> : <span>Type to find or create</span>}
      {activeTask ? <span><kbd>↵</kbd> Open</span> : null}
      {activeTask ? <span><kbd>→</kbd> Actions</span> : null}
      {createActive ? <span><kbd>↵</kbd> Create</span> : null}
      <span><kbd>⌘↵</kbd> Create</span>
      <span className="ml-auto"><kbd>Esc</kbd> Close</span>
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

function actionLabel(action: TaskFinderActionId) {
  if (action === "move-today") return "Moving to Today";
  if (action === "return-capture") return "Returning to Capture";
  if (action === "complete") return "Completing";
  if (action === "reopen") return "Reopening";
  return "Opening";
}

function actionSuccessMessage(action: TaskFinderActionId) {
  if (action === "move-today") return "Moved to Today:";
  if (action === "return-capture") return "Returned to Capture:";
  if (action === "complete") return "Completed:";
  if (action === "reopen") return "Reopened:";
  return "Opened:";
}

function optionId(optionKey: string) {
  return `task-finder-option-${optionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return element.matches("input, textarea, select, [contenteditable='true']");
}
