import assert from "node:assert/strict";
import test from "node:test";

import { SAMPLES, TOOLS, createDefaultSettingsByTool, defaultSettingsForTool } from "../lib/catalog.ts";
import { STORAGE_VERSION, readWorkspace, writeWorkspace } from "../lib/storage.ts";
import { DEFAULT_DIAGRAM_SETTINGS, type DiagramSettings, type ToolId } from "../lib/types.ts";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

function throwingStorage(): Storage {
  return {
    length: 0,
    clear: () => {},
    key: () => null,
    getItem: () => null,
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: () => {},
  };
}

const defaults = () => ({
  homeOpen: true,
  tool: "er" as ToolId,
  sources: Object.fromEntries(TOOLS.map(({ id }) => [id, ""])) as Record<ToolId, string>,
  settingsByTool: createDefaultSettingsByTool(),
  dragOffsets: Object.fromEntries(TOOLS.map(({ id }) => [id, {}])) as Record<ToolId, Record<string, { x: number; y: number }>>,
  canvasZoom: 100,
  editorWidth: null,
  editorCollapsed: false,
});

test("catalog covers every roadmap tool and owns defaults per tool", () => {
  const ids = new Set(TOOLS.map((tool) => tool.id));
  assert.equal(TOOLS.length, 13);
  assert.equal(ids.has("dataflow"), true);
  assert.equal(ids.has("deployment"), true);
  assert.equal((ids as Set<string>).has("screenshot"), false);
  assert.equal(defaultSettingsForTool("architecture").spacingScale, 115);
  assert.equal(defaultSettingsForTool("table").showTableNote, true);
  assert.equal(defaultSettingsForTool("environment").showTableNote, false);
});

test("readWorkspace returns defaults when storage is empty or corrupt", () => {
  globalThis.localStorage = memoryStorage();
  assert.deepEqual(readWorkspace(defaults()).sources, defaults().sources);

  globalThis.localStorage = memoryStorage({ "thesis-figure-lab-v1": "{not json" });
  assert.equal(readWorkspace(defaults()).tool, "er");
  assert.equal(globalThis.localStorage.getItem("thesis-figure-lab-v1"), null);
});

test("readWorkspace clamps hostile values and keeps unknown tools out", () => {
  globalThis.localStorage = memoryStorage({
    "thesis-figure-lab-v1": JSON.stringify({
      version: STORAGE_VERSION,
      tool: "mystery",
      canvasZoom: 9000,
      sources: { er: "实体: 字段", ghost: "ignored" },
      settingsByTool: { er: { fontSize: 5000, monochrome: "yes", chineseFont: "Comic Sans", spacingScale: -20, lineWidth: 0.5 } },
      dragOffsets: { er: { "a:b": { x: 3.4, y: Number.NaN }, ok: { x: -12, y: 8 } } },
      layout: { editorWidth: 99999, editorCollapsed: true },
    }),
  });
  const workspace = readWorkspace(defaults());
  assert.equal(workspace.tool, "er");
  assert.equal(workspace.canvasZoom, 200);
  assert.equal(workspace.settingsByTool.er.fontSize, 96);
  assert.equal(workspace.settingsByTool.er.monochrome, DEFAULT_DIAGRAM_SETTINGS.monochrome);
  assert.equal(workspace.settingsByTool.er.chineseFont, "SimSun");
  assert.equal(workspace.settingsByTool.er.spacingScale, 30);
  assert.equal(workspace.settingsByTool.er.lineWidth, 2);
  assert.equal(workspace.sources.er, "实体: 字段");
  assert.equal("ghost" in workspace.sources, false);
  assert.deepEqual(workspace.dragOffsets.er, { ok: { x: -12, y: 8 } });
  assert.equal(workspace.editorWidth, 680);
  assert.equal(workspace.editorCollapsed, true);
});

test("readWorkspace migrates a single legacy settings object", () => {
  globalThis.localStorage = memoryStorage({
    "thesis-figure-lab-v1": JSON.stringify({ version: 1, settings: { fontSize: 10, lineWidth: 1, monochrome: false } }),
  });
  const workspace = readWorkspace(defaults());
  assert.equal(workspace.settingsByTool.chart.monochrome, true);
  assert.equal(workspace.settingsByTool.chart.fontSize, 14);
  assert.equal(workspace.settingsByTool.architecture.spacingScale, 115);
});

test("readWorkspace replaces legacy placeholder samples with real samples", () => {
  const legacy = {
    dataflow: "@title 系统数据流图\n待完善：后续将支持外部实体、处理过程、数据存储和数据流关系。",
    deployment: "@title 系统部署图\n待完善：后续将支持服务器节点、运行环境、组件和网络连接关系。",
    testcase: "@title 表 5.1 软件测试用例表\n待完善：后续将支持测试编号、测试步骤、输入数据、预期结果与实际结果。",
  };
  globalThis.localStorage = memoryStorage({
    "thesis-figure-lab-v1": JSON.stringify({ version: 5, sources: { ...legacy, er: "学生: 学号" } }),
  });
  const workspace = readWorkspace({ ...defaults(), sources: SAMPLES });
  assert.equal(workspace.sources.dataflow, SAMPLES.dataflow);
  assert.equal(workspace.sources.deployment, SAMPLES.deployment);
  assert.equal(workspace.sources.testcase, SAMPLES.testcase);
  assert.equal(workspace.sources.er, "学生: 学号");
});

test("writeWorkspace round-trips and reports storage failures", () => {
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const state: ReturnType<typeof defaults> = defaults();
  state.sources = { ...state.sources, flow: "开始 [start]" };
  state.settingsByTool = { ...state.settingsByTool, flow: { ...DEFAULT_DIAGRAM_SETTINGS, fontSize: 16 } as DiagramSettings };
  assert.equal(writeWorkspace(state), "ok");
  const restored = readWorkspace(defaults());
  assert.equal(restored.sources.flow, "开始 [start]");
  assert.equal(restored.settingsByTool.flow.fontSize, 16);

  globalThis.localStorage = throwingStorage();
  assert.equal(writeWorkspace(state), "unavailable");
});
