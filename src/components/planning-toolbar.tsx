import { useRef } from "react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  Calendar01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskFinder } from "@/components/task-finder";
import type { PlanningBoardFilter, PlanningBoardSort } from "@/lib/planning-board";
import type { LocalDate, PlannerSnapshot } from "@/lib/planner";
import { dateFromLocalDate } from "@/lib/local-date";
import {
  closeMainWindow,
  minimizeMainWindow,
  toggleMainWindowFullscreen,
  useMainWindowFullscreen,
} from "@/lib/window-mode";

type PlanningToolbarProps = {
  date?: LocalDate;
  filter?: PlanningBoardFilter;
  onFilterChange?: (filter: PlanningBoardFilter) => void;
  onOpenSettings?: () => void;
  onSortChange?: (sort: PlanningBoardSort) => void;
  snapshot?: PlannerSnapshot;
  sort?: PlanningBoardSort;
};

export function PlanningToolbar({
  date,
  filter = "all",
  onFilterChange,
  onOpenSettings,
  onSortChange,
  snapshot,
  sort = "planning",
}: PlanningToolbarProps) {
  const isFullscreen = useMainWindowFullscreen();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isBoardToolbar = Boolean(onFilterChange && onSortChange);

  async function handleToggleFullscreen() {
    await toggleMainWindowFullscreen();
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  if (!isBoardToolbar) {
    return (
      <div className="grid h-full grid-cols-[minmax(5rem,1fr)_auto_minmax(5rem,1fr)] items-center px-2" {...(isFullscreen === false ? { "data-tauri-drag-region": "" } : {})}>
        <div className="justify-self-start">{isFullscreen === false ? <WindowControls onToggleFullscreen={handleToggleFullscreen} /> : null}</div>
        <h1 className="m-0 text-menu font-semibold tracking-tight outline-none" ref={titleRef} tabIndex={-1}>Planning</h1>
        <div aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2"
      {...(isFullscreen === false ? { "data-tauri-drag-region": "" } : {})}
    >
      <div className="flex min-w-0 items-center gap-1 justify-self-start">
        {isFullscreen === false ? <WindowControls onToggleFullscreen={handleToggleFullscreen} /> : null}
        <time className="flex min-w-0 items-center gap-1.5 text-section-secondary text-muted-foreground max-[639px]:hidden" dateTime={date}>
          <HugeiconsIcon aria-hidden="true" className="shrink-0" icon={Calendar01Icon} size={14} strokeWidth={1.7} />
          <span className="truncate max-[759px]:hidden">{date ? formatToolbarDate(date) : "Loading…"}</span>
          <span className="truncate min-[760px]:hidden">{date ? formatToolbarDateCompact(date) : "Loading…"}</span>
        </time>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="ml-1 h-6 min-w-20 justify-between px-2 text-section-secondary font-normal" size="xs" type="button" variant="outline" />}>
            Board
            <HugeiconsIcon aria-hidden="true" icon={ArrowDown01Icon} size={11} strokeWidth={1.8} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-32">
            <DropdownMenuItem disabled>Week <span className="ml-auto text-metadata text-muted-foreground">Soon</span></DropdownMenuItem>
            <DropdownMenuItem disabled>List <span className="ml-auto text-metadata text-muted-foreground">Soon</span></DropdownMenuItem>
            <DropdownMenuItem>Board</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="justify-self-center">
        {snapshot ? <TaskFinder snapshot={snapshot} /> : null}
      </div>

      <div className="flex items-center gap-1 justify-self-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-6 px-2 text-section-secondary font-normal text-muted-foreground hover:text-foreground" size="xs" type="button" variant={filter === "all" ? "ghost" : "secondary"} />}>
            Filter
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              <DropdownMenuRadioGroup onValueChange={(value) => onFilterChange?.(value as PlanningBoardFilter)} value={filter}>
                <DropdownMenuRadioItem value="all">All tasks</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="attention">Needs attention</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="scheduled">Scheduled</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unscheduled">Unscheduled</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-6 px-2 text-section-secondary font-normal text-muted-foreground hover:text-foreground max-[719px]:hidden" size="xs" type="button" variant={sort === "planning" ? "ghost" : "secondary"} />}>
            <HugeiconsIcon aria-hidden="true" icon={ArrowUp01Icon} size={12} strokeWidth={1.7} />
            Sort
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Order within lanes</DropdownMenuLabel>
              <SortOptions onSortChange={onSortChange} sort={sort} />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label="More planning options" className="h-6 w-6 text-base leading-none" size="icon-xs" title="More planning options" type="button" variant="ghost" />}>
            <span aria-hidden="true">•••</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Planning</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="min-[720px]:hidden">
                  <HugeiconsIcon aria-hidden="true" icon={ArrowUp01Icon} size={13} strokeWidth={1.7} />
                  Sort
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  <SortOptions onSortChange={onSortChange} sort={sort} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {onOpenSettings ? (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <HugeiconsIcon aria-hidden="true" icon={Settings01Icon} size={13} strokeWidth={1.7} />
                  Settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem disabled>Export board</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SortOptions({
  onSortChange,
  sort,
}: {
  onSortChange?: (sort: PlanningBoardSort) => void;
  sort: PlanningBoardSort;
}) {
  return (
    <DropdownMenuRadioGroup onValueChange={(value) => onSortChange?.(value as PlanningBoardSort)} value={sort}>
      <DropdownMenuRadioItem value="planning">Planning order</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="estimate">Estimate</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

type SettingsToolbarProps = {
  date?: LocalDate;
  onBackToBoard: () => void;
};

export function SettingsToolbar({ date, onBackToBoard }: SettingsToolbarProps) {
  const isFullscreen = useMainWindowFullscreen();
  const titleRef = useRef<HTMLSpanElement>(null);

  async function handleToggleFullscreen() {
    await toggleMainWindowFullscreen();
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  return (
    <div
      className="flex h-full min-w-0 items-center gap-1 px-2"
      {...(isFullscreen === false ? { "data-tauri-drag-region": "" } : {})}
    >
      {isFullscreen === false ? <WindowControls onToggleFullscreen={handleToggleFullscreen} /> : null}
      <time className="ml-1 flex min-w-0 items-center gap-1.5 text-section-secondary text-muted-foreground" dateTime={date}>
        <HugeiconsIcon aria-hidden="true" icon={Calendar01Icon} size={14} strokeWidth={1.7} />
        <span className="truncate">{date ? formatToolbarDate(date) : "Loading…"}</span>
      </time>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="ml-2 h-6 min-w-20 justify-between px-2 text-section-secondary font-normal" size="xs" type="button" variant="outline" />}>
          <span className="outline-none" ref={titleRef} tabIndex={-1}>Settings</span>
          <HugeiconsIcon aria-hidden="true" icon={ArrowDown01Icon} size={11} strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-32">
          <DropdownMenuItem onClick={onBackToBoard}>Board</DropdownMenuItem>
          <DropdownMenuItem disabled>Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        className="ml-2 h-6 px-2 text-section-secondary font-normal text-muted-foreground hover:text-foreground"
        onClick={onBackToBoard}
        size="xs"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} size={12} strokeWidth={1.8} />
        Back to board
      </Button>

      <div className="min-w-2 flex-1" />

      <div aria-hidden="true" className="flex items-center gap-1 opacity-40 max-[700px]:hidden">
        <span className="px-2 text-section-secondary text-muted-foreground">Filter</span>
        <span className="inline-flex items-center gap-1 px-2 text-section-secondary text-muted-foreground">
          <HugeiconsIcon icon={ArrowUp01Icon} size={12} strokeWidth={1.7} />
          Sort
        </span>
        <span className="px-1 text-base leading-none text-muted-foreground">•••</span>
      </div>
    </div>
  );
}

function formatToolbarDate(value: LocalDate) {
  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function formatToolbarDateCompact(value: LocalDate) {
  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function WindowControls({ onToggleFullscreen }: { onToggleFullscreen: () => Promise<void> }) {
  return (
    <div aria-label="Window controls" className="flex items-center" role="group">
      <WindowControl action={() => closeMainWindow()} label="Close Slate" tone="close" />
      <WindowControl action={() => minimizeMainWindow()} label="Minimize Slate" tone="minimize" />
      <WindowControl action={onToggleFullscreen} label="Enter full screen" tone="fullscreen" />
    </div>
  );
}

function WindowControl({ action, label, tone }: { action: () => Promise<void>; label: string; tone: "close" | "fullscreen" | "minimize" }) {
  return (
    <button aria-label={label} className="planning-window-control" data-tone={tone} onClick={() => void action()} title={label} type="button">
      <span aria-hidden="true" />
    </button>
  );
}
