const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

export const RECOMMENDED_QUICK_CAPTURE_SHORTCUT = "CommandOrControl+Shift+Space";

export function formatShortcut(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "CommandOrControl") return "⌘";
      if (part === "Command") return "⌘";
      if (part === "Control") return "⌃";
      if (part === "Alt" || part === "Option") return "⌥";
      if (part === "Shift") return "⇧";
      return part;
    })
    .join("");
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent) {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) modifiers.push("CommandOrControl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (modifiers.length === 0) return null;

  const key = normalizeShortcutKey(event.key);
  if (!key) return null;
  return [...modifiers, key].join("+");
}

function normalizeShortcutKey(key: string) {
  if (key === " ") return "Space";
  if (key.length === 1 && /[a-z0-9]/i.test(key)) return key.toUpperCase();
  if (/^F\d{1,2}$/.test(key)) return key;
  if (["Enter", "Tab", "Escape", "Backspace", "Delete", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
    return key.replace("Arrow", "");
  }
  return null;
}
