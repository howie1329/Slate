import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShortcut,
  RECOMMENDED_QUICK_CAPTURE_SHORTCUT,
  shortcutFromKeyboardEvent,
} from "./quick-capture.ts";

describe("Quick capture shortcut helpers", () => {
  it("displays the recommended macOS shortcut compactly", () => {
    assert.equal(formatShortcut(RECOMMENDED_QUICK_CAPTURE_SHORTCUT), "⌘⇧Space");
  });

  it("ignores modifier-only input and records a complete shortcut", () => {
    assert.equal(
      shortcutFromKeyboardEvent({ key: "Shift", shiftKey: true }),
      null,
    );
    assert.equal(
      shortcutFromKeyboardEvent({
        key: " ",
        metaKey: true,
        shiftKey: true,
      }),
      RECOMMENDED_QUICK_CAPTURE_SHORTCUT,
    );
  });

  it("does not record an unmodified key", () => {
    assert.equal(
      shortcutFromKeyboardEvent({ key: "K" }),
      null,
    );
  });
});
