import assert from "node:assert/strict";
import test from "node:test";

import { parseWorkspaceBackup, serializeWorkspaceBackup } from "../lib/backup.ts";
import { createDefaultSettingsByTool, SAMPLES, TOOLS } from "../lib/catalog.ts";
import { STORAGE_VERSION, type Workspace } from "../lib/storage.ts";
import type { ToolId } from "../lib/types.ts";

const defaults = (): Workspace => ({
  homeOpen: false,
  tool: "er",
  sources: Object.fromEntries(TOOLS.map(({ id }) => [id, SAMPLES[id] ?? ""])) as Record<ToolId, string>,
  settingsByTool: createDefaultSettingsByTool(),
  dragOffsets: Object.fromEntries(TOOLS.map(({ id }) => [id, {}])) as Workspace["dragOffsets"],
  canvasZoom: 100,
  editorWidth: null,
  editorCollapsed: false,
});

test("workspace backup round-trips sources and layout", () => {
  const workspace: Workspace = {
    ...defaults(),
    tool: "testcase",
    canvasZoom: 135,
    editorWidth: 420,
    editorCollapsed: true,
    dragOffsets: { ...defaults().dragOffsets, testcase: { "testcase-row:1": { x: 12, y: -6 } } },
  };
  const restored = parseWorkspaceBackup(serializeWorkspaceBackup(workspace), defaults());

  assert.equal(restored.tool, "testcase");
  assert.equal(restored.canvasZoom, 135);
  assert.equal(restored.editorWidth, 420);
  assert.equal(restored.editorCollapsed, true);
  assert.deepEqual(restored.dragOffsets.testcase, { "testcase-row:1": { x: 12, y: -6 } });
  assert.equal(restored.sources.testcase, SAMPLES.testcase);
});

test("workspace backup rejects foreign or incomplete files", () => {
  const valid = JSON.parse(serializeWorkspaceBackup(defaults()));

  assert.throws(() => parseWorkspaceBackup("not json", defaults()), /JSON/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({ ...valid, format: "other" }), defaults()), /无法识别/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({ ...valid, version: 99 }), defaults()), /备份版本/);
  assert.throws(
    () => parseWorkspaceBackup(JSON.stringify({ ...valid, workspace: { ...valid.workspace, sources: { er: "x" } } }), defaults()),
    /源文本不完整/,
  );
});

test("workspace backup ignores legacy screenshot payloads", () => {
  const valid = JSON.parse(serializeWorkspaceBackup(defaults()));
  const legacy = JSON.stringify({
    ...valid,
    workspace: { ...valid.workspace, sources: { ...valid.workspace.sources, screenshot: "图 5-1 登录界面" } },
    screenshots: [{ id: "shot-1", name: "登录界面", dataUrl: "data:image/png;base64,iVBORw0KGgo=", width: 1280, height: 720 }],
  });
  const restored = parseWorkspaceBackup(legacy, defaults());
  assert.equal(restored.sources.er, SAMPLES.er);
  assert.equal("screenshot" in restored.sources, false);
});

test("workspace backup keeps the current storage version", () => {
  const backup = JSON.parse(serializeWorkspaceBackup(defaults()));
  assert.equal(backup.storageVersion, STORAGE_VERSION);
});
