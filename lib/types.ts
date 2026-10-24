export type ToolId =
  | "class"
  | "er"
  | "flow"
  | "dataflow"
  | "sequence"
  | "usecase"
  | "module"
  | "architecture"
  | "deployment"
  | "environment"
  | "testcase"
  | "table"
  | "chart";

export type DiagramSettings = {
  fontSize: number;
  chineseFont: "SimSun" | "SimHei" | "Microsoft YaHei" | "KaiTi" | "FangSong";
  englishFont: "Times New Roman" | "Arial" | "Georgia" | "Courier New";
  fontBold: boolean;
  uniformFontSize: boolean;
  lineWidth: number;
  borderScale: number;
  overallScale: number;
  spacingScale: number;
  showTitle: boolean;
  showPrimaryKeys: boolean;
  showRelations: boolean;
  showTableNote: boolean;
  monochrome: boolean;
  chartType: "bar" | "line";
  printWidthCm: number;
  targetFontPt: number;
};

export const DEFAULT_DIAGRAM_SETTINGS: DiagramSettings = {
  fontSize: 14,
  chineseFont: "SimSun",
  englishFont: "Times New Roman",
  fontBold: false,
  uniformFontSize: false,
  lineWidth: 2,
  borderScale: 100,
  overallScale: 100,
  spacingScale: 100,
  showTitle: true,
  showPrimaryKeys: true,
  showRelations: true,
  showTableNote: true,
  monochrome: true,
  chartType: "bar",
  printWidthCm: 15,
  targetFontPt: 9,
};

export const CHINESE_FONT_OPTIONS: Array<{ value: DiagramSettings["chineseFont"]; label: string }> = [
  { value: "SimSun", label: "宋体" },
  { value: "SimHei", label: "黑体" },
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "KaiTi", label: "楷体" },
  { value: "FangSong", label: "仿宋" },
];

export const ENGLISH_FONT_OPTIONS: Array<{ value: DiagramSettings["englishFont"]; label: string }> = [
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
];

export type ToolConfig = {
  id: ToolId;
  name: string;
  short: string;
  symbol: string;
  description: string;
  hint: string;
};

export type DiagnosticLevel = "error" | "warning";

export type ParseDiagnostic = {
  level: DiagnosticLevel;
  message: string;
};

export type DragPoint = { x: number; y: number };
export type DragOffsets = Record<string, DragPoint>;

export type InlineTextEdit = {
  original: string;
  value: string;
  sourceLine?: string;
  scope: "line" | "all" | "title";
  x: number;
  y: number;
};

export type RelationKind =
  | "association"
  | "navigable"
  | "dependency"
  | "generalization"
  | "realization"
  | "aggregation"
  | "composition";

export type Relation = {
  from: string;
  to: string;
  fromMany?: string;
  toMany?: string;
  arrow: string;
  kind: RelationKind;
  label: string;
};

export const RELATION_LABELS: Record<RelationKind, string> = {
  association: "关联",
  navigable: "定向关联",
  dependency: "依赖",
  generalization: "泛化",
  realization: "实现",
  aggregation: "聚合",
  composition: "组合",
};
