import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PLANNING_SHELL_METRICS,
  PlanningWorkspaceFrame,
} from "./planning-workspace-frame.ts";

function renderFrame(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanningWorkspaceFrame, {
      futureViewsCue: createElement("p", null, "More Planning views are coming soon."),
      globalLayer: null,
      inspector: null,
      mainContentLayout: "bounded",
      mainContent: createElement("div", null, "Daily content"),
      mainLabel: "Planning content",
      showFutureViewsCue: true,
      statusBar: createElement("button", { type: "button" }, "Settings"),
      toolbar: createElement("span", null, "Planning"),
      ...overrides,
    }),
  );
}

describe("Planning workspace frame", () => {
  it("renders the shell landmarks in visual order and omits an idle inspector", () => {
    const markup = renderFrame();

    const toolbar = markup.indexOf('aria-label="Planning toolbar"');
    const main = markup.indexOf('aria-label="Planning content"');
    const status = markup.indexOf('aria-label="Workspace status"');

    assert.ok(toolbar >= 0);
    assert.ok(main > toolbar);
    assert.ok(status > main);
    assert.doesNotMatch(markup, /Workspace inspector/);
    assert.match(markup, /More Planning views are coming soon\./);
  });

  it("renders one contextual inspector after the primary content", () => {
    const markup = renderFrame({
      inspector: createElement("form", null, "Task detail"),
    });

    assert.ok(markup.indexOf('aria-label="Workspace inspector"') > markup.indexOf('aria-label="Planning content"'));
    assert.match(markup, /Task detail/);
  });

  it("keeps the frame while Settings replaces Planning content", () => {
    const markup = renderFrame({
      mainContent: createElement("div", null, "Settings form"),
      mainLabel: "Settings content",
      showFutureViewsCue: false,
    });

    assert.match(markup, /Planning toolbar/);
    assert.match(markup, /Settings content/);
    assert.match(markup, /Workspace status/);
    assert.doesNotMatch(markup, /More Planning views are coming soon\./);
    assert.doesNotMatch(markup, /Workspace inspector/);
  });

  it("places global transient content inside the shell boundary", () => {
    const markup = renderFrame({
      globalLayer: createElement("section", { "data-onboarding": true }, "Welcome"),
    });

    assert.ok(markup.indexOf("data-onboarding") > markup.indexOf('aria-label="Workspace status"'));
  });

  it("exposes the approved compact and responsive geometry", () => {
    assert.deepEqual(PLANNING_SHELL_METRICS, {
      dailyMaxWidth: 720,
      dockedInspectorWidth: 410,
      statusBarHeight: 24,
      toolbarControlHeight: 24,
      toolbarHeight: 32,
    });
  });

  it("supports a full-width main-content slot for desktop placeholders", () => {
    const markup = renderFrame({ mainContentLayout: "full" });

    assert.match(markup, /planning-workspace-content-route/);
    assert.doesNotMatch(markup, /planning-workspace-content-daily/);
  });
});
