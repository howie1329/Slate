import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type WindowMode = "full" | "popover" | "quick-capture";

export function isTauriWindow() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function currentWindowMode(): WindowMode {
  if (!isTauriWindow()) {
    return "full";
  }

  try {
    const label = getCurrentWindow().label;
    if (label === "popover" || label === "quick-capture") {
      return label;
    }
    return "full";
  } catch {
    return "full";
  }
}

export function useWindowMode() {
  const [windowMode] = useState<WindowMode>(currentWindowMode);

  return windowMode;
}

export function useMainWindowFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean | null>(() =>
    isTauriWindow() ? null : false,
  );

  useEffect(() => {
    if (!isTauriWindow()) {
      return;
    }

    const currentWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    async function refreshFullscreenState() {
      const nextIsFullscreen = await currentWindow.isFullscreen();
      if (!disposed) {
        setIsFullscreen(nextIsFullscreen);
      }
    }

    void refreshFullscreenState();
    void currentWindow.onResized(() => {
      void refreshFullscreenState();
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

  return isFullscreen;
}

export async function closeMainWindow() {
  if (isTauriWindow()) {
    await getCurrentWindow().close();
  }
}

export async function minimizeMainWindow() {
  if (isTauriWindow()) {
    await getCurrentWindow().minimize();
  }
}

export async function toggleMainWindowFullscreen() {
  if (!isTauriWindow()) {
    return;
  }

  const currentWindow = getCurrentWindow();
  await currentWindow.setFullscreen(!(await currentWindow.isFullscreen()));
}

export async function openFullApp() {
  if (!isTauriWindow()) {
    return;
  }

  await invoke("open_full_app");
}

export async function hidePopover() {
  if (!isTauriWindow()) {
    return;
  }

  await invoke("hide_popover");
}

export async function hideQuickCapture() {
  if (!isTauriWindow()) {
    return;
  }

  await invoke("hide_quick_capture");
}
