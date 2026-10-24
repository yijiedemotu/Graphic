import { TOOLS } from "./catalog.ts";
import { CHINESE_FONT_OPTIONS, DEFAULT_DIAGRAM_SETTINGS, ENGLISH_FONT_OPTIONS, type DiagramSettings, type DragOffsets, type DragPoint, type ToolId } from "./types.ts";

export const STORAGE_KEY = "thesis-figure-lab-v1";
export const STORAGE_VERSION = 6;
const MAX_OFFSETS_PER_TOOL = 200;

const LEGACY_PLACEHOLDER_SOURCES: Partial<Record<ToolId, string[]>> = {
  dataflow: ["@title 系统数据流图\n待完善：后续将支持外部实体、处理过程、数据存储和数据流关系。"],
  deployment: ["@title 系统部署图\n待完善：后续将支持服务器节点、运行环境、组件和网络连接关系。"],
  testcase: ["@title 表 5.1 软件测试用例表\n待完善：后续将支持测试编号、测试步骤、输入数据、预期结果与实际结果。"],
};

function isLegacyPlaceholder(id: ToolId, source: string) {
  const candidates = LEGACY_PLACEHOLDER_SOURCES[id];
  if (!candidates) return false;
  const normalized = source.replace(/\r\n/g, "\n").trim();
  return candidates.some((candidate) => candidate === normalized);
}

export type Workspace = {
  homeOpen: boolean;
  tool: ToolId;
  sources: Record<ToolId, string>;
  settingsByTool: Record<ToolId, DiagramSettings>;
  dragOffsets: Record<ToolId, DragOffsets>;
  canvasZoom: number;
  editorWidth: number | null;
  editorCollapsed: boolean;
};

const toolIds = TOOLS.map((tool) => tool.id);
const chineseFonts = CHINESE_FONT_OPTIONS.map((font) => font.value);
const englishFonts = ENGLISH_FONT_OPTIONS.map((font) => font.value);

function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && toolIds.includes(value as ToolId);
}

function numberOr(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeSettings(raw: unknown): DiagramSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = DEFAULT_DIAGRAM_SETTINGS;
  const monochrome = typeof value.monochrome === "boolean" ? value.monochrome : base.monochrome;
  const lineWidth = numberOr(value.lineWidth, base.lineWidth, 0.5, 20);
  return {
    fontSize: numberOr(value.fontSize, base.fontSize, 8, 96),
    chineseFont: chineseFonts.includes(value.chineseFont as never) ? value.chineseFont as DiagramSettings["chineseFont"] : base.chineseFont,
    englishFont: englishFonts.includes(value.englishFont as never) ? value.englishFont as DiagramSettings["englishFont"] : base.englishFont,
    fontBold: typeof value.fontBold === "boolean" ? value.fontBold : base.fontBold,
    uniformFontSize: typeof value.uniformFontSize === "boolean" ? value.uniformFontSize : base.uniformFontSize,
    lineWidth: monochrome ? Math.max(2, lineWidth) : lineWidth,
    borderScale: numberOr(value.borderScale, base.borderScale, 40, 260),
    overallScale: numberOr(value.overallScale, base.overallScale, 20, 250),
    spacingScale: numberOr(value.spacingScale, base.spacingScale, 30, 300),
    showTitle: typeof value.showTitle === "boolean" ? value.showTitle : base.showTitle,
    showPrimaryKeys: typeof value.showPrimaryKeys === "boolean" ? value.showPrimaryKeys : base.showPrimaryKeys,
    showRelations: typeof value.showRelations === "boolean" ? value.showRelations : base.showRelations,
    showTableNote: typeof value.showTableNote === "boolean" ? value.showTableNote : base.showTableNote,
    monochrome,
    chartType: value.chartType === "line" ? "line" : "bar",
    printWidthCm: numberOr(value.printWidthCm, base.printWidthCm, 8, 22),
    targetFontPt: numberOr(value.targetFontPt, base.targetFontPt, 5, 16),
  };
}

function sanitizeOffsets(raw: unknown): DragOffsets {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>).filter(([, point]) => {
    if (!point || typeof point !== "object") return false;
    const { x, y } = point as Partial<DragPoint>;
    return Number.isFinite(x) && Number.isFinite(y);
  }).slice(0, MAX_OFFSETS_PER_TOOL);
  return Object.fromEntries(entries.map(([key, point]) => {
    const { x, y } = point as DragPoint;
    return [key, { x: Math.round(x), y: Math.round(y) }];
  }));
}

function toToolMap<T>(raw: unknown, fallback: (id: ToolId) => T, sanitize: (value: unknown, id: ToolId) => T): Record<ToolId, T> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(toolIds.map((id) => [id, id in source ? sanitize(source[id], id) : fallback(id)])) as Record<ToolId, T>;
}

export function normalizeWorkspace(raw: unknown, defaults: Workspace): Workspace {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const parsed = raw as Record<string, unknown>;
  const version = numberOr(parsed.version, STORAGE_VERSION, 0, STORAGE_VERSION);
  const settingsByTool = toToolMap(parsed.settingsByTool, (id) => defaults.settingsByTool[id], sanitizeSettings);
  if (version < 4) {
    const architecture = settingsByTool.architecture;
    if (architecture.spacingScale === DEFAULT_DIAGRAM_SETTINGS.spacingScale) {
      settingsByTool.architecture = { ...architecture, spacingScale: 115 };
    }
  }
  const legacySettings = parsed.settings;
  if (!parsed.settingsByTool && legacySettings && typeof legacySettings === "object") {
    const legacy = sanitizeSettings(legacySettings);
    const hardened: DiagramSettings = version === 2
      ? legacy
      : { ...legacy, monochrome: true, fontSize: Math.max(14, legacy.fontSize), lineWidth: Math.max(2, legacy.lineWidth) };
    toolIds.forEach((id) => {
      settingsByTool[id] = id === "architecture" ? { ...hardened, spacingScale: 115 } : { ...hardened };
    });
  }

  const sources = toToolMap(parsed.sources, (id) => defaults.sources[id], (value, id) => (typeof value === "string" ? value : defaults.sources[id]));
  if (version < 6) {
    toolIds.forEach((id) => {
      if (isLegacyPlaceholder(id, sources[id])) sources[id] = defaults.sources[id];
    });
  }

  const layout = (parsed.layout && typeof parsed.layout === "object" ? parsed.layout : {}) as Record<string, unknown>;
  return {
    homeOpen: typeof parsed.homeOpen === "boolean" ? parsed.homeOpen : defaults.homeOpen,
    tool: isToolId(parsed.tool) ? parsed.tool : defaults.tool,
    sources,
    settingsByTool,
    dragOffsets: toToolMap(parsed.dragOffsets, () => ({}), sanitizeOffsets),
    canvasZoom: numberOr(parsed.canvasZoom, defaults.canvasZoom, 35, 200),
    editorWidth: typeof layout.editorWidth === "number" ? numberOr(layout.editorWidth, 380, 240, 680) : null,
    editorCollapsed: typeof layout.editorCollapsed === "boolean" ? layout.editorCollapsed : defaults.editorCollapsed,
  };
}

export function readWorkspace(defaults: Workspace): Workspace {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaults;
  }
  if (!saved) return defaults;

  try {
    return normalizeWorkspace(JSON.parse(saved), defaults);
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is unavailable; the in-memory defaults still work.
    }
    return defaults;
  }
}

export type WriteOutcome = "ok" | "unavailable" | "quota";

export function writeWorkspace(state: Workspace): WriteOutcome {
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    homeOpen: state.homeOpen,
    tool: state.tool,
    sources: state.sources,
    settingsByTool: state.settingsByTool,
    dragOffsets: state.dragOffsets,
    canvasZoom: state.canvasZoom,
    layout: { editorWidth: state.editorWidth, editorCollapsed: state.editorCollapsed },
  });
  try {
    localStorage.setItem(STORAGE_KEY, payload);
    return "ok";
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, sources: state.sources, settingsByTool: state.settingsByTool }));
      return "quota";
    } catch {
      return "unavailable";
    }
  }
}
