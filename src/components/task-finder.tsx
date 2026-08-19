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
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  CalendarAdd01Icon,
  Cancel01Icon,
  InboxIcon,
  Loading03Icon,
  MoreVerticalIcon,
  Search01Icon,
  SparklesIcon,
  TaskAdd01Icon,
  TaskDone01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAiReview } from "@/components/ai-review";
import { toast } from "sonner";
import { useTaskSelection } from "@/components/task-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

type TaskFinderProps = {
  onOpenSettings?: () => void;
  snapshot: PlannerSnapshot;
};

export function TaskFinder({ onOpenSettings, snapshot }: TaskFinderProps) {
  const { selectTask } = useTaskSelection();
  const aiReview = useAiReview();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const setTaskCompleted = useSetTaskCompleted();
  const setTaskScheduledDate = useSetTaskScheduledDate();
  const inputRef = useRef<HTMLInputElement>(null);
  const finderRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const actionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mutationPendingRef = useRef(false);
  const dateBeforeTodayRef = useRef<LocalDate | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFinderFilters>(emptyTaskFinderFilters);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [creationDraft, setCreationDraft] = useState<TaskFinderCreationDraft>(emptyTaskFinderCreationDraft);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [activeOptionKey, setActiveOptionKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const aiBusy =
    aiReview.state.kind === "assist-loading"
    || aiReview.state.kind === "plan-loading"
    || aiReview.state.kind === "plan-accepting";
  const filtersActive = hasTaskFinderFilters(filters);
  const titleResults = useMemo(
    () => taskFinderResults(snapshot, query, filtersActive),
    [filtersActive, query, snapshot],
  );
  const results = useMemo(
    () => filterTaskFinderResults(titleResults, filters),
    [filters, titleResults],
  );
  const options = useMemo(
    () => taskFinderOptions(results, query, filtersActive),
    [filtersActive, query, results],
  );
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
        || finderRef.current?.contains(target)
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
    setFiltersExpanded(false);
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

  function handleAiAction() {
    if (aiBusy) return;
    if (snapshot.aiAvailability !== "configured") {
      onOpenSettings?.();
      return;
    }

    const capture = query.trim();
    if (capture) {
      aiReview.startAssist(capture, null);
    } else {
      aiReview.startPlan();
    }
    resetFinderState();
    setIsOpen(false);
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1",
      )}
      data-task-finder
      ref={finderRef}
    >
      <div
        className={cn(
          "relative h-6 min-w-0 transition-[width] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "w-[min(28rem,calc(100vw-2rem))]" : "w-56",
        )}
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
          <Button
            aria-label="Clear task finder"
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            disabled={mutationPending}
            onClick={() => {
              if (mutationPending) return;
              resetFinderState();
              inputRef.current?.focus();
              setIsOpen(true);
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.8} />
          </Button>
        ) : (
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-metadata text-muted-foreground">⌘F</kbd>
        )}
      </div>
      <Button
        aria-label={
          snapshot.aiAvailability !== "configured"
            ? "Configure AI in Settings"
            : aiBusy
              ? "Generating AI review"
              : query.trim()
                ? "Use AI Assist"
                : "Plan my day with AI"
        }
        className="size-6 text-muted-foreground"
        disabled={aiBusy}
        onClick={handleAiAction}
        size="icon-xs"
        title={
          snapshot.aiAvailability !== "configured"
            ? "Configure AI in Settings"
            : aiBusy
              ? "Generating AI review"
              : query.trim()
                ? "Use AI Assist"
                : "Plan My Day"
        }
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          className={aiBusy ? "animate-pulse motion-reduce:animate-none" : undefined}
          icon={SparklesIcon}
          size={13}
          strokeWidth={1.8}
        />
      </Button>

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
              filtersExpanded={filtersExpanded}
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
              onToggleFilters={() => setFiltersExpanded((expanded) => !expanded)}
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
  filtersExpanded,
  inputRef,
  mutationPending,
  onAction,
  onClearFilters,
  onCreateTask,
  onOpenTask,
  onSelectCreate,
  onToggleAttentionFilter,
  onToggleFilters,
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
  filtersExpanded: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  mutationPending: boolean;
  onAction: (action: TaskFinderActionId) => void;
  onClearFilters: () => void;
  onCreateTask: () => void;
  onOpenTask: (result: TaskFinderResult) => void;
  onSelectCreate: () => void;
  onToggleAttentionFilter: (filter: "overdue" | "needsEstimate") => void;
  onToggleFilters: () => void;
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
  const taskOptions = options.filter((option) => option.kind === "task");
  const createOption = options.find((option) => option.kind === "create");

  return (
    <div
      className="fixed z-50 flex max-h-[min(20rem,calc(100vh-4rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      data-task-finder-popup
      ref={popupRef}
      style={style}
    >
      <TaskFinderFilters
        disabled={mutationPending}
        expanded={filtersExpanded}
        filters={filters}
        onClear={onClearFilters}
        onToggleExpanded={onToggleFilters}
        onToggleAttention={onToggleAttentionFilter}
        onToggleLane={onToggleLaneFilter}
        resultCount={resultCount}
      />

      {emptyState === "instructions" ? (
        <p className="flex h-8 shrink-0 items-center px-2.5 text-supporting text-muted-foreground">
          Type to find an existing task or create a new one.
        </p>
      ) : (
        <div
          aria-label="Task finder results"
          className="min-h-0 flex-1 overflow-y-auto"
          id="task-finder-results"
          role="listbox"
        >
          {emptyState ? (
            <p className="flex h-8 items-center px-2.5 text-supporting text-muted-foreground" role="presentation">
              {emptyState === "filtered-no-match" ? "No tasks match these filters" : "No matching tasks"}
            </p>
          ) : null}
          {taskOptions.map((option) => option.kind === "task" ? (
            <TaskFinderResultOption
              active={option.key === activeOptionKey}
              actionButtonRefs={actionButtonRefs}
              actions={option.key === activeOptionKey ? actions : []}
              disabled={mutationPending}
              key={option.key}
              inputRef={inputRef}
              onAction={onAction}
              onOpenTask={onOpenTask}
              optionKey={option.key}
              pendingAction={pendingAction}
              query={query}
              result={option.result}
            />
          ) : null)}
        </div>
      )}

      {createOption?.kind === "create" ? (
        <TaskFinderCreateOption
          active={createActive}
          creating={pendingAction === "create"}
          onSelect={onSelectCreate}
          title={createOption.title}
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
  expanded,
  filters,
  onClear,
  onToggleExpanded,
  onToggleAttention,
  onToggleLane,
  resultCount,
}: {
  disabled: boolean;
  expanded: boolean;
  filters: TaskFinderFilters;
  onClear: () => void;
  onToggleExpanded: () => void;
  onToggleAttention: (filter: "overdue" | "needsEstimate") => void;
  onToggleLane: (lane: PlanningLaneId) => void;
  resultCount: number;
}) {
  const attentionValues = [
    ...(filters.overdue ? ["overdue"] : []),
    ...(filters.needsEstimate ? ["needsEstimate"] : []),
  ];
  const activeFilters = [
    ...(filters.lane ? [laneLabels[filters.lane]] : []),
    ...(filters.overdue ? ["Overdue"] : []),
    ...(filters.needsEstimate ? ["Needs estimate"] : []),
  ];

  return (
    <div aria-label="Task filters" className="shrink-0 border-b border-border">
      <div className="flex h-8 items-center gap-1 px-2">
        <Button
          aria-expanded={expanded}
          className="h-6 px-1.5 text-label font-semibold"
          disabled={disabled}
          onClick={onToggleExpanded}
          size="xs"
          type="button"
          variant="ghost"
        >
          Filters
          <HugeiconsIcon
            aria-hidden="true"
            className={cn("transition-transform duration-150 motion-reduce:transition-none", expanded ? "rotate-180" : null)}
            icon={ArrowDown01Icon}
            size={10}
            strokeWidth={1.8}
          />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {activeFilters.length > 0 ? activeFilters.map((label) => (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-label font-semibold" key={label}>{label}</span>
          )) : <span className="truncate text-metadata text-muted-foreground">All tasks</span>}
        </div>
        {activeFilters.length > 0 ? (
          <Button className="h-6 px-1.5 text-label font-semibold" disabled={disabled} onClick={onClear} size="xs" type="button" variant="ghost">Clear</Button>
        ) : null}
        <span aria-live="polite" className="shrink-0 text-metadata tabular-nums text-muted-foreground" role="status">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>
      </div>

      {expanded ? (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          <ToggleGroup
            aria-label="Planning lane filter"
            disabled={disabled}
            onValueChange={(values) => {
              const nextLane = values[values.length - 1] as PlanningLaneId | undefined;
              if (nextLane && nextLane !== filters.lane) onToggleLane(nextLane);
              else if (!nextLane && filters.lane) onToggleLane(filters.lane);
            }}
            size="sm"
            spacing={1}
            value={filters.lane ? [filters.lane] : []}
            variant="outline"
          >
            {filterLanes.map((lane) => (
              <ToggleGroupItem className="h-6 min-w-0 px-2 text-label font-semibold" key={lane} value={lane}>{laneLabels[lane]}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            aria-label="Attention filters"
            disabled={disabled}
            onValueChange={(values) => {
              const overdue = values.includes("overdue");
              const needsEstimate = values.includes("needsEstimate");
              if (overdue !== filters.overdue) onToggleAttention("overdue");
              if (needsEstimate !== filters.needsEstimate) onToggleAttention("needsEstimate");
            }}
            size="sm"
            spacing={1}
            value={attentionValues}
            variant="outline"
          >
            <ToggleGroupItem className="h-6 min-w-0 px-2 text-label font-semibold" value="overdue">Overdue</ToggleGroupItem>
            <ToggleGroupItem className="h-6 min-w-0 px-2 text-label font-semibold" value="needsEstimate">Needs estimate</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}
    </div>
  );
}

function TaskFinderResultOption({
  active,
  actionButtonRefs,
  actions,
  disabled,
  inputRef,
  onAction,
  onOpenTask,
  optionKey,
  pendingAction,
  query,
  result,
}: {
  active: boolean;
  actionButtonRefs: RefObject<Array<HTMLButtonElement | null>>;
  actions: TaskFinderAction[];
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onAction: (action: TaskFinderActionId) => void;
  onOpenTask: (result: TaskFinderResult) => void;
  optionKey: string;
  pendingAction: string | null;
  query: string;
  result: TaskFinderResult;
}) {
  const metadata = resultMetadata(result);

  return (
    <div
      className={cn(
        "group flex h-8 cursor-default items-center gap-2 border-b border-border px-2.5 outline-none transition-colors last:border-b-0",
        active ? "bg-accent text-accent-foreground ring-1 ring-inset ring-foreground/25" : "hover:bg-muted",
        disabled ? "opacity-50" : null,
      )}
    >
      <div
        aria-disabled={disabled || undefined}
        aria-selected={active}
        className="flex min-w-0 flex-1 items-center gap-2 outline-none"
        id={optionId(optionKey)}
        onClick={() => {
          if (!disabled) onOpenTask(result);
        }}
        onPointerDown={(event) => event.preventDefault()}
        role="option"
      >
        <div className="min-w-0 flex-1 truncate text-menu">
          {taskFinderTitleParts(result.title, query).map((part, index) => part.matched ? (
            <mark
              className="bg-transparent font-semibold text-inherit"
              key={`${part.text}-${index}`}
            >
              {part.text}
            </mark>
          ) : <span key={`${part.text}-${index}`}>{part.text}</span>)}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-metadata tabular-nums text-muted-foreground">
          <span>{laneLabels[result.lane]}</span>
          {metadata.map((item) => <span key={item}>· {item}</span>)}
        </div>
      </div>
      {active ? (
        <TaskFinderInlineActions
          actionButtonRefs={actionButtonRefs}
          actions={actions}
          disabled={disabled}
          inputRef={inputRef}
          onAction={onAction}
          pendingAction={pendingAction}
          taskTitle={result.title}
        />
      ) : null}
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
        "flex h-8 shrink-0 cursor-default items-center gap-2 border-t border-border px-2.5 outline-none transition-colors",
        active ? "bg-accent text-accent-foreground ring-1 ring-inset ring-foreground/25" : "hover:bg-muted",
      )}
      id={optionId("create")}
      onClick={() => {
        if (!creating) onSelect();
      }}
      onPointerDown={(event) => event.preventDefault()}
      role="option"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={creating ? "animate-spin motion-reduce:animate-none" : "text-muted-foreground"}
        icon={creating ? Loading03Icon : TaskAdd01Icon}
        size={13}
        strokeWidth={1.8}
      />
      <span className="shrink-0 text-menu font-medium">{creating ? "Creating task…" : "Create task"}</span>
      <span className="min-w-0 flex-1 truncate text-metadata text-muted-foreground">{title}</span>
      {!creating ? <kbd className="font-mono text-metadata text-muted-foreground">⌘↵</kbd> : null}
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
      className="shrink-0 border-t border-border px-2 py-1.5"
      onKeyDown={handleNestedEscape}
      role="group"
    >
      <div className="flex items-center gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Estimate in minutes</span>
          <Input
            aria-invalid={Boolean(error)}
            className="h-7 px-2 text-supporting"
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
          <Input
            className="h-7 px-2 text-supporting"
            disabled={mutationPending || draft.addToToday}
            onChange={(event) => onUpdate({ scheduledDate: (event.target.value || null) as LocalDate | null })}
            type="date"
            value={draft.addToToday ? "" : draft.scheduledDate ?? ""}
          />
        </label>
        <Toggle
          aria-pressed={draft.addToToday}
          disabled={mutationPending}
          onClick={onToggleToday}
          pressed={draft.addToToday}
          size="sm"
          type="button"
          variant="outline"
          className="h-7 px-2 text-label font-semibold"
        >
          Today
        </Toggle>
        <Button
          disabled={mutationPending}
          onClick={onCreate}
          size="xs"
          type="button"
        >
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>
      {error ? <p className="mt-1 text-metadata text-destructive" role="alert">{error}</p> : null}
      <p className="mt-1 text-metadata text-muted-foreground">
        {draft.addToToday
          ? "Today commitment"
          : draft.estimate.trim()
            ? "Estimated Backlog · lane assigned automatically"
            : "Unestimated Backlog · Capture"}
      </p>
    </div>
  );
}

function TaskFinderInlineActions({
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
      className="flex shrink-0 items-center gap-0.5"
      role="toolbar"
    >
      {actions.map((action, index) => (
        <Button
          aria-label={action.description ? `${action.label}. ${action.description}` : action.label}
          disabled={disabled}
          key={action.id}
          onClick={(event) => {
            event.stopPropagation();
            onAction(action.id);
          }}
          onKeyDown={(event) => handleKeyDown(event, index)}
          ref={(element) => { actionButtonRefs.current[index] = element; }}
          size="icon-xs"
          title={action.description ? `${action.label} — ${action.description}` : action.label}
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className={pendingAction === action.id ? "animate-spin motion-reduce:animate-none" : undefined}
            icon={pendingAction === action.id ? Loading03Icon : taskActionIcon(action.id)}
            size={12}
            strokeWidth={1.8}
          />
        </Button>
      ))}
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
    <div aria-hidden="true" className="flex h-6 shrink-0 items-center gap-2 border-t border-border px-2.5 text-metadata text-muted-foreground">
      {activeTask || createActive ? <span><kbd className="font-mono">↑↓</kbd> Navigate</span> : <span>Type to find or create</span>}
      {activeTask ? <span><kbd className="font-mono">→</kbd> Actions</span> : null}
      <span className="ml-auto"><kbd className="font-mono">Esc</kbd> Close</span>
    </div>
  );
}

function taskActionIcon(action: TaskFinderActionId) {
  if (action === "move-today") return CalendarAdd01Icon;
  if (action === "complete") return TaskDone01Icon;
  if (action === "return-capture") return InboxIcon;
  if (action === "reopen") return Undo02Icon;
  if (action === "open") return ArrowUpRight01Icon;
  return MoreVerticalIcon;
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
