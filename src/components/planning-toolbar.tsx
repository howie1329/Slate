import { useRef } from "react";
import {
  closeMainWindow,
  minimizeMainWindow,
  toggleMainWindowFullscreen,
  useMainWindowFullscreen,
} from "@/lib/window-mode";

export function PlanningToolbar() {
  const isFullscreen = useMainWindowFullscreen();
  const titleRef = useRef<HTMLHeadingElement>(null);

  async function handleToggleFullscreen() {
    await toggleMainWindowFullscreen();
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  return (
    <div
      className="grid h-full grid-cols-[minmax(5rem,1fr)_auto_minmax(5rem,1fr)] items-center px-2"
      {...(isFullscreen === false ? { "data-tauri-drag-region": "" } : {})}
    >
      <div className="justify-self-start">
        {isFullscreen === false ? (
          <WindowControls onToggleFullscreen={handleToggleFullscreen} />
        ) : null}
      </div>
      <h1
        className="m-0 text-menu font-semibold tracking-tight outline-none"
        ref={titleRef}
        tabIndex={-1}
      >
        Planning
      </h1>
      <div aria-hidden="true" />
    </div>
  );
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

function WindowControl({
  action,
  label,
  tone,
}: {
  action: () => Promise<void>;
  label: string;
  tone: "close" | "fullscreen" | "minimize";
}) {
  return (
    <button
      aria-label={label}
      className="planning-window-control"
      data-tone={tone}
      onClick={() => void action()}
      title={label}
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}
