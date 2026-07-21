import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type WindowMode = "full" | "popover";

function isTauriWindow() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function currentWindowMode(): WindowMode {
  if (!isTauriWindow()) {
    return "full";
  }

  try {
    return getCurrentWindow().label === "popover" ? "popover" : "full";
  } catch {
    return "full";
  }
}

export function useWindowMode() {
  const [windowMode] = useState<WindowMode>(currentWindowMode);

  return windowMode;
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
