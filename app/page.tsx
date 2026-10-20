"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

type ToolId =
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
  | "screenshot"
  | "testcase"
  | "table"
  | "chart";

type DiagramSettings = {
  fontSize: number;
  chineseFont: "SimSun" | "SimHei" | "Microsoft YaHei" | "KaiTi" | "FangSong";
  englishFont: "Times New Roman" | "Arial" | "Georgia" | "Courier New";
  lineWidth: number;
  borderScale: number;
  overallScale: number;
  spacingScale: number;
  showTitle: boolean;
  showPrimaryKeys: boolean;
  monochrome: boolean;
  chartType: "bar" | "line";
};

const DEFAULT_DIAGRAM_SETTINGS: DiagramSettings = {
  fontSize: 14,
  chineseFont: "SimSun",
  englishFont: "Times New Roman",
  lineWidth: 2,
  borderScale: 100,
  overallScale: 100,
  spacingScale: 100,
  showTitle: true,
  showPrimaryKeys: true,
  monochrome: true,
  chartType: "bar",
};

const CHINESE_FONT_OPTIONS: Array<{ value: DiagramSettings["chineseFont"]; label: string }> = [
  { value: "SimSun", label: "宋体" },
  { value: "SimHei", label: "黑体" },
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "KaiTi", label: "楷体" },
  { value: "FangSong", label: "仿宋" },
];

const ENGLISH_FONT_OPTIONS: Array<{ value: DiagramSettings["englishFont"]; label: string }> = [
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
];

type ToolConfig = {
  id: ToolId;
  name: string;
  short: string;
  symbol: string;
  description: string;
  hint: string;
};

const TOOLS: ToolConfig[] = [
  { id: "usecase", name: "系统用例图", short: "用例图", symbol: "UC", description: "角色、系统边界与功能用例", hint: "actor 角色；角色 -> 用例；主用例 -> 子用例: include / extend" },
  { id: "dataflow", name: "系统数据流图", short: "数据流图", symbol: "DF", description: "待完善 · 外部实体、处理与数据流", hint: "该图表功能正在规划中，敬请期待" },
  { id: "architecture", name: "系统架构图", short: "系统架构图", symbol: "AR", description: "表现层、服务层与数据层", hint: "层名: 模块1; 模块2" },
  { id: "module", name: "系统功能模块图", short: "功能模块图", symbol: "FM", description: "系统、角色分组与功能模块层级", hint: "system 系统名；分组名: 功能1; 功能2" },
  { id: "deployment", name: "UML 部署图", short: "部署图", symbol: "DP", description: "待完善 · 节点、组件与部署关系", hint: "该图表功能正在规划中，敬请期待" },
  { id: "er", name: "ER 属性图", short: "E-R 图", symbol: "ER", description: "实体矩形、属性椭圆与关系菱形", hint: "支持简洁文本或 MySQL CREATE TABLE；自动识别主键、外键与字段注释" },
  { id: "table", name: "数据库物理表结构", short: "三线表", symbol: "TB", description: "数据库表结构的规范三线表", hint: "首行为表头，逗号分隔" },
  { id: "class", name: "UML 类图", short: "类图", symbol: "CL", description: "类、属性、方法与六类关系", hint: "每个 class 一行，关系单独一行" },
  { id: "sequence", name: "UML 时序图", short: "时序图", symbol: "SQ", description: "参与者、调用与返回消息", hint: "participant 参与者；A -> B: 消息" },
  { id: "flow", name: "系统流程图", short: "流程图", symbol: "FL", description: "开始、处理、判断与分支", hint: "先定义节点，再用箭头连接" },
  { id: "environment", name: "环境配置表", short: "环境配置表", symbol: "EC", description: "开发部署环境的规范三线表", hint: "首行为表头；每行填写环境类型,配置详情" },
  { id: "screenshot", name: "核心功能运行截图", short: "界面图", symbol: "UI", description: "待完善 · 截图编排、编号与论文题注", hint: "该图表功能正在规划中，敬请期待" },
  { id: "testcase", name: "软件测试用例表", short: "测试用例表", symbol: "TC", description: "待完善 · 测试步骤、输入与预期结果", hint: "该图表功能正在规划中，敬请期待" },
  { id: "chart", name: "实验数据图", short: "实验数据图", symbol: "DT", description: "柱状图、折线图与多组数据", hint: "第一列为横轴，其余列为数据系列" },
];

const THESIS_ROADMAP: Array<{ chapter: string; title: string; note: string; tools: Array<{ id: ToolId; order: number; label: string }> }> = [
  { chapter: "第二章", title: "需求分析", note: "先明确参与者与功能边界，再描述系统内部的数据流动。", tools: [{ id: "usecase", order: 1, label: "用例图" }, { id: "dataflow", order: 2, label: "数据流图（DFD）" }] },
  { chapter: "第三章", title: "总体设计", note: "从整体技术结构进入功能划分，最后交代系统部署方式。", tools: [{ id: "architecture", order: 3, label: "系统架构图" }, { id: "module", order: 4, label: "功能模块图" }, { id: "deployment", order: 5, label: "部署图" }] },
  { chapter: "第四章", title: "详细设计", note: "依次呈现数据模型、物理表、静态结构、交互过程和关键流程。", tools: [{ id: "er", order: 6, label: "E-R 图" }, { id: "table", order: 7, label: "数据库物理表结构" }, { id: "class", order: 8, label: "类图" }, { id: "sequence", order: 9, label: "时序图" }, { id: "flow", order: 10, label: "流程图" }] },
  { chapter: "第五章", title: "系统实现", note: "说明开发运行条件，并通过核心界面展示功能实现结果。", tools: [{ id: "environment", order: 11, label: "环境配置表" }, { id: "screenshot", order: 12, label: "核心功能运行截图" }] },
  { chapter: "第六章", title: "系统测试", note: "先用测试用例验证功能，再用性能图表总结实验结果。", tools: [{ id: "testcase", order: 13, label: "测试用例表" }, { id: "chart", order: 14, label: "实验性能数据图" }] },
];

const defaultSettingsForTool = (id: ToolId): DiagramSettings => ({
  ...DEFAULT_DIAGRAM_SETTINGS,
  spacingScale: id === "architecture" ? 115 : DEFAULT_DIAGRAM_SETTINGS.spacingScale,
});

const createDefaultSettingsByTool = (): Record<ToolId, DiagramSettings> => Object.fromEntries(
  TOOLS.map(({ id }) => [id, defaultSettingsForTool(id)]),
) as Record<ToolId, DiagramSettings>;

const SAMPLES: Record<ToolId, string> = {
  class: `@title 在线选课系统核心类图
class 学生 | +学号: String; +姓名: String; +专业: String | +选课(): Boolean; +退课(): Boolean
class 课程 | +课程号: String; +课程名: String; +学分: Integer | +更新容量(): void
class 选课记录 | +记录ID: Long; +选课时间: DateTime; +成绩: Float | +录入成绩(): void
class 用户服务 | -学生仓储: Repository | +身份验证(): Boolean
学生 1 --> n 选课记录 : 发起
课程 1 --> n 选课记录 : 包含
用户服务 1 ..> n 学生 : 管理`,
  er: `@title 在线选课系统 E-R 图
学生: 学号(PK), 姓名, 专业, 班级, 手机号
课程: 课程号(PK), 课程名, 学分, 课程容量
教师: 工号(PK), 姓名, 职称
选课记录: 记录ID(PK), 学号(FK), 课程号(FK), 成绩
学生 1 -- n 选课记录 : 选修
课程 1 -- n 选课记录 : 对应
教师 1 -- n 课程 : 授课`,
  flow: `@title 用户登录业务流程
开始 [start]
输入账号密码 [process]
校验登录信息 [decision]
记录登录日志 [process]
进入系统首页 [end]
显示错误提示 [end]
开始 -> 输入账号密码
输入账号密码 -> 校验登录信息
校验登录信息 -通过-> 记录登录日志
记录登录日志 -> 进入系统首页
校验登录信息 -失败-> 显示错误提示`,
  dataflow: `@title 系统数据流图
待完善：后续将支持外部实体、处理过程、数据存储和数据流关系。`,
  sequence: `@title 用户登录时序图
participant 用户
participant Web 前端
participant 认证服务
participant 数据库
用户 -> Web 前端: 输入账号密码
Web 前端 -> 认证服务: POST /api/login
认证服务 -> 数据库: 查询用户信息
数据库 --> 认证服务: 返回用户记录
认证服务 -> 认证服务: 校验密码并签发 Token
认证服务 --> Web 前端: 登录结果与 Token
Web 前端 --> 用户: 展示系统首页`,
  usecase: `@title 校园二手交易平台用例图
system 校园二手交易平台
actor 学生用户
actor 管理员
# 用户端主要用例
学生用户 -> 用户登录
学生用户 -> 商品浏览与搜索
学生用户 -> 发布商品
学生用户 -> 交易管理
# 管理端主要用例
管理员 -> 用户管理
管理员 -> 商品审核
管理员 -> 订单管理
# 少量包含与扩展关系
商品浏览与搜索 -> 查看商品详情: include
用户管理 -> 查看用户资料: include
订单管理 -> 查询订单详情: include
用户登录 -> 找回密码: extend
交易管理 -> 申请退款: extend
商品审核 -> 下架违规商品: extend`,
  architecture: `@title 校园二手交易平台系统架构
表现层: 移动端小程序; Web 管理后台
接口层: REST API; WebSocket; 权限拦截器
业务层: 用户服务; 商品服务; 订单服务; 消息服务
数据层: MySQL; Redis; 对象存储
基础设施: 日志中心; 定时任务; Docker`,
  deployment: `@title 系统部署图
待完善：后续将支持服务器节点、运行环境、组件和网络连接关系。`,
  module: `@title 图 4.2 系统功能模块图
system 二手交易平台
学生用户: 浏览搜索商品; 发布管理商品; 注册登录; 个人信息管理; AI客服; 商品留言评论
管理员用户: 商品管理; 用户管理; 订单管理; 公告管理; 数据统计`,
  table: `@title 表 4-2 用户信息表
字段名,数据类型,长度,允许为空,说明
user_id,BIGINT,20,否,用户主键
username,VARCHAR,50,否,登录用户名
password,VARCHAR,255,否,加密密码
email,VARCHAR,100,是,电子邮箱
created_at,DATETIME,—,否,创建时间`,
  environment: `@title 表 2.1 系统开发与部署环境配置表
环境类型,配置详情
操作系统,Windows 11 专业版 x64
CPU,Intel(R) Core(TM) i7-12700H CPU @ 2.30GHz
运行内存,16 GB
后端开发工具,IntelliJ IDEA 2024.1
后端运行环境,JDK 17.0.8
后端构建工具,Maven 3.8.1
前端开发工具,Visual Studio Code 1.85
前端运行环境,Node.js 18.16.0
前端构建工具,Vite 4.4.0
数据库,MySQL 8.0.33
接口测试工具,Apifox 2.5.0
版本控制,Git 2.40.0`,
  screenshot: `@title 核心功能运行界面
待完善：后续将支持界面截图上传、裁剪、统一尺寸、编号与图题排版。`,
  testcase: `@title 表 5.1 软件测试用例表
待完善：后续将支持测试编号、测试步骤、输入数据、预期结果与实际结果。`,
  chart: `@title 不同并发量下的平均响应时间
并发用户数,优化前,优化后
50,126,82
100,238,141
150,387,224
200,562,318
250,741,426`,
};

const ER_SQL_SAMPLE = `@title 在线选课系统数据库 E-R 图
CREATE TABLE \`student\` (
  \`student_id\` BIGINT NOT NULL COMMENT '学号',
  \`name\` VARCHAR(50) NOT NULL COMMENT '姓名',
  \`major\` VARCHAR(80) COMMENT '专业',
  PRIMARY KEY (\`student_id\`)
) COMMENT='学生';

CREATE TABLE \`course\` (
  \`course_id\` BIGINT NOT NULL COMMENT '课程号',
  \`course_name\` VARCHAR(100) NOT NULL COMMENT '课程名',
  \`credit\` DECIMAL(3,1) COMMENT '学分',
  PRIMARY KEY (\`course_id\`)
) COMMENT='课程';

CREATE TABLE \`enrollment\` (
  \`record_id\` BIGINT NOT NULL COMMENT '记录ID',
  \`student_id\` BIGINT NOT NULL COMMENT '学号',
  \`course_id\` BIGINT NOT NULL COMMENT '课程号',
  \`score\` DECIMAL(5,2) COMMENT '成绩',
  PRIMARY KEY (\`record_id\`),
  CONSTRAINT \`fk_enrollment_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`student\` (\`student_id\`),
  CONSTRAINT \`fk_enrollment_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`course\` (\`course_id\`)
) COMMENT='选课记录';`;

const PALETTE = ["#3157d5", "#ef8b4b", "#2f8f74", "#aa67c7", "#d1a52b"];

function titleFrom(source: string, fallback: string) {
  const line = source.split("\n").find((item) => item.trim().startsWith("@title"));
  return line?.replace("@title", "").trim() || fallback;
}

function dataLines(source: string) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@title") && !line.startsWith("#"));
}

type ErEntityDefinition = { name: string; fields: string[] };
type ErInputDefinition = { entities: ErEntityDefinition[]; relations: Relation[]; sqlMode: boolean };
type SqlColumnDefinition = { sqlName: string; displayName: string; primaryKey: boolean };
type SqlForeignKeyDefinition = { localColumns: string[]; targetTable: string; targetColumns: string[] };
type SqlTableDefinition = {
  sqlName: string;
  displayName: string;
  columns: SqlColumnDefinition[];
  primaryKeys: Set<string>;
  uniqueKeys: string[][];
  foreignKeys: SqlForeignKeyDefinition[];
};

function isSqlErSource(source: string) {
  return /\bCREATE\s+TABLE\b/i.test(source);
}

function sqlIdentifier(value: string) {
  const last = value.trim().split(/\s*\.\s*/).pop() || value;
  return last.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "");
}

function sqlIdentifierList(value: string) {
  return value.split(",").map((item) => sqlIdentifier(item.replace(/\s+(?:ASC|DESC)\b/gi, ""))).filter(Boolean);
}

function splitSqlDefinitionList(body: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote && body[index - 1] !== "\\") {
        if (body[index + 1] === quote) index += 1;
        else quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function sqlComment(value: string) {
  const single = value.match(/\bCOMMENT\s*=?\s*'((?:''|\\.|[^'])*)'/i);
  const double = value.match(/\bCOMMENT\s*=?\s*"((?:""|\\.|[^"])*)"/i);
  const raw = single?.[1] ?? double?.[1] ?? "";
  return raw.replace(/''/g, "'").replace(/""/g, '"').replace(/\\(['"])/g, "$1").trim();
}

function parseSqlTables(source: string): SqlTableDefinition[] {
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*(?:--|#).*$/gm, " ");
  const identifierPattern = '(?:`[^`]+`|"[^"]+"|[A-Za-z_$][\\w$]*)';
  const createPattern = new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${identifierPattern}(?:\\s*\\.\\s*${identifierPattern})?)`, "gi");
  const foreignPattern = new RegExp(`\\bFOREIGN\\s+KEY\\s*\\(([^)]+)\\)\\s*REFERENCES\\s+(${identifierPattern}(?:\\s*\\.\\s*${identifierPattern})?)\\s*\\(([^)]+)\\)`, "i");
  const inlineReferencePattern = new RegExp(`\\bREFERENCES\\s+(${identifierPattern}(?:\\s*\\.\\s*${identifierPattern})?)\\s*\\(([^)]+)\\)`, "i");
  const tables: SqlTableDefinition[] = [];
  let match: RegExpExecArray | null;

  while ((match = createPattern.exec(cleaned))) {
    const openIndex = cleaned.indexOf("(", createPattern.lastIndex);
    if (openIndex < 0) break;
    let closeIndex = -1;
    let depth = 0;
    let quote = "";
    for (let index = openIndex; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      if (quote) {
        if (char === quote && cleaned[index - 1] !== "\\") {
          if (cleaned[index + 1] === quote) index += 1;
          else quote = "";
        }
        continue;
      }
      if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) { closeIndex = index; break; }
      }
    }
    if (closeIndex < 0) break;

    const sqlName = sqlIdentifier(match[1]);
    const body = cleaned.slice(openIndex + 1, closeIndex);
    const tailEnd = cleaned.indexOf(";", closeIndex);
    const tail = cleaned.slice(closeIndex + 1, tailEnd < 0 ? cleaned.length : tailEnd);
    const parts = splitSqlDefinitionList(body);
    const primaryKeys = new Set<string>();
    const uniqueKeys: string[][] = [];
    const foreignKeys: SqlForeignKeyDefinition[] = [];

    parts.forEach((part) => {
      const primary = part.match(/\bPRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (primary) sqlIdentifierList(primary[1]).forEach((column) => primaryKeys.add(column.toLowerCase()));
      const unique = part.match(/\bUNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+`?[^\s(]+`?)?\s*\(([^)]+)\)/i);
      if (unique) uniqueKeys.push(sqlIdentifierList(unique[1]).map((column) => column.toLowerCase()));
      const foreign = part.match(foreignPattern);
      if (foreign) foreignKeys.push({ localColumns: sqlIdentifierList(foreign[1]), targetTable: sqlIdentifier(foreign[2]), targetColumns: sqlIdentifierList(foreign[3]) });
    });

    const columns: SqlColumnDefinition[] = [];
    parts.forEach((part) => {
      if (/^(?:CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|KEY|INDEX|CHECK|FULLTEXT|SPATIAL)\b/i.test(part)) return;
      const column = part.match(/^(`[^`]+`|"[^"]+"|[A-Za-z_$][\w$]*)\s+([\s\S]+)$/);
      if (!column) return;
      const columnName = sqlIdentifier(column[1]);
      const definition = column[2];
      if (/\bPRIMARY\s+KEY\b/i.test(definition)) primaryKeys.add(columnName.toLowerCase());
      if (/\bUNIQUE\b/i.test(definition)) uniqueKeys.push([columnName.toLowerCase()]);
      const reference = definition.match(inlineReferencePattern);
      if (reference) foreignKeys.push({ localColumns: [columnName], targetTable: sqlIdentifier(reference[1]), targetColumns: sqlIdentifierList(reference[2]) });
      columns.push({
        sqlName: columnName,
        displayName: sqlComment(definition) || columnName,
        primaryKey: primaryKeys.has(columnName.toLowerCase()) || /\bPRIMARY\s+KEY\b/i.test(definition),
      });
    });

    columns.forEach((column) => { column.primaryKey = primaryKeys.has(column.sqlName.toLowerCase()); });
    tables.push({ sqlName, displayName: sqlComment(tail) || sqlName, columns, primaryKeys, uniqueKeys, foreignKeys });
    createPattern.lastIndex = closeIndex + 1;
  }

  return tables;
}

function parseErInput(source: string): ErInputDefinition {
  if (!isSqlErSource(source)) {
    const lines = dataLines(source);
    const relationLines = lines.filter((line) => /\s--\s/.test(line));
    return {
      entities: lines
        .filter((line) => line.includes(":") && !relationLines.includes(line))
        .map((line) => {
          const split = line.indexOf(":");
          return { name: line.slice(0, split).trim(), fields: line.slice(split + 1).split(",").map((field) => field.trim()) };
        }),
      relations: parseRelations(relationLines, "--"),
      sqlMode: false,
    };
  }

  const tables = parseSqlTables(source);
  const usedDisplayNames = new Set<string>();
  tables.forEach((table) => {
    if (usedDisplayNames.has(table.displayName)) table.displayName = `${table.displayName}（${table.sqlName}）`;
    usedDisplayNames.add(table.displayName);
  });
  const tableMap = new Map(tables.map((table) => [table.sqlName.toLowerCase(), table]));
  const relations: Relation[] = [];
  const relationKeys = new Set<string>();
  tables.forEach((table) => table.foreignKeys.forEach((foreignKey) => {
    const target = tableMap.get(foreignKey.targetTable.toLowerCase());
    if (!target) return;
    const localColumns = foreignKey.localColumns.map((column) => column.toLowerCase());
    const oneToOne = (localColumns.length === table.primaryKeys.size && localColumns.every((column) => table.primaryKeys.has(column)))
      || table.uniqueKeys.some((columns) => columns.length === localColumns.length && columns.every((column) => localColumns.includes(column)));
    const key = `${target.sqlName}->${table.sqlName}:${localColumns.join(",")}`;
    if (relationKeys.has(key)) return;
    relationKeys.add(key);
    relations.push({ from: target.displayName, to: table.displayName, fromMany: "1", toMany: oneToOne ? "1" : "n", arrow: "--", label: "关联" });
  }));

  return {
    entities: tables.map((table) => ({
      name: table.displayName,
      fields: table.columns.map((column) => `${column.displayName}${column.primaryKey ? "(PK)" : ""}`),
    })),
    relations,
    sqlMode: true,
  };
}

type InlineTextEdit = {
  original: string;
  value: string;
  sourceLine?: string;
  scope: "line" | "all" | "title";
  x: number;
  y: number;
};

function resolveTextEdit(tool: ToolId, source: string, dragId: string, visibleText: string) {
  const lines = dataLines(source);
  if (tool === "chart" && !dragId) return { sourceLine: undefined, scope: "line" as const };
  if (dragId.startsWith("er-attribute:")) {
    const entityName = dragId.slice("er-attribute:".length).split(":")[0];
    return { sourceLine: lines.find((line) => line.startsWith(`${entityName}:`)), scope: "line" as const };
  }
  if (dragId.startsWith("er-entity:")) {
    return { scope: "all" as const };
  }
  if (dragId.startsWith("er-relation:")) {
    const index = Number(dragId.slice("er-relation:".length));
    return { sourceLine: lines.filter((line) => /\s--\s/.test(line))[index], scope: "line" as const };
  }
  if (dragId.startsWith("class:")) {
    const className = dragId.slice("class:".length);
    return visibleText === className
      ? { scope: "all" as const }
      : { sourceLine: lines.find((line) => line.startsWith(`class ${className} `) || line === `class ${className}`), scope: "line" as const };
  }
  if (dragId.startsWith("flow:")) return { scope: "all" as const };
  if (dragId.startsWith("sequence-participant:")) return { scope: "all" as const };
  if (dragId.startsWith("sequence-message:")) {
    const index = Number(dragId.slice("sequence-message:".length));
    return { sourceLine: lines.filter((line) => /\s--?>\s/.test(line))[index], scope: "line" as const };
  }
  if (dragId === "usecase:boundary") {
    return { sourceLine: lines.find((line) => line.startsWith("system ")), scope: "line" as const };
  }
  if (dragId.startsWith("usecase-actor:") || dragId.startsWith("usecase-item:")) return { scope: "all" as const };
  if (dragId === "module:root") {
    return { sourceLine: lines.find((line) => line.startsWith("system ")), scope: "line" as const };
  }
  if (dragId.startsWith("module-group:") || dragId.startsWith("module-item:")) return { scope: "all" as const };
  if (dragId.startsWith("architecture:")) {
    const index = Number(dragId.slice("architecture:".length));
    return { sourceLine: lines[index], scope: "line" as const };
  }
  if (dragId.startsWith("table-row:")) {
    const index = Number(dragId.slice("table-row:".length));
    return { sourceLine: lines[index], scope: "line" as const };
  }
  if (dragId.startsWith("chart-label:")) {
    const index = Number(dragId.slice("chart-label:".length));
    return { sourceLine: lines[index + 1], scope: "line" as const };
  }
  if (dragId.startsWith("chart-legend:") || dragId === "chart-axis-title") {
    return { sourceLine: lines[0], scope: "line" as const };
  }
  const matchingLines = lines.filter((line) => line.includes(visibleText));
  return { sourceLine: matchingLines[0], scope: "line" as const };
}

function replaceIdentifier(source: string, original: string, replacement: string) {
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu"), replacement);
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "论文图表";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

async function copyRichText(html: string, plainText: string) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      })]);
      return;
    }
  } catch {
    // Word-compatible selection fallback below.
  }
  const staging = document.createElement("div");
  staging.contentEditable = "true";
  staging.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;background:#fff;";
  staging.innerHTML = html;
  document.body.appendChild(staging);
  const range = document.createRange();
  range.selectNodeContents(staging);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  staging.remove();
  if (!copied) await navigator.clipboard.writeText(plainText);
}

function downloadFile(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DiagramDefs({ lineWidth, monochrome }: { lineWidth: number; monochrome: boolean }) {
  return (
    <defs>
      {monochrome && <style>{`
        .bw { shape-rendering: geometricPrecision; text-rendering: optimizeLegibility; }
        .bw path, .bw line, .bw polyline, .bw polygon, .bw rect, .bw circle, .bw ellipse { shape-rendering: geometricPrecision; stroke-linejoin: miter; stroke-linecap: square; }
        .bw #arrow path { fill: #000 !important; stroke: #000 !important; }
        .bw #open-arrow path { fill: #fff !important; stroke: #000 !important; }
        .bw [filter] { filter: none !important; }
      `}</style>}
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#26303a" />
      </marker>
      <marker id="open-arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto">
        <path d="M 1 1 L 11 6 L 1 11 z" fill="#fff" stroke="#26303a" strokeWidth={lineWidth} />
      </marker>
      <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#26303a" floodOpacity="0.12" />
      </filter>
      <pattern id="bw-black" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect data-bw-preserve="true" width="8" height="8" fill="#000" />
      </pattern>
      <pattern id="bw-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect data-bw-preserve="true" width="8" height="8" fill="#fff" />
        <line data-bw-preserve="true" x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="2" />
      </pattern>
      <pattern id="bw-dots" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect data-bw-preserve="true" width="8" height="8" fill="#fff" />
        <circle data-bw-preserve="true" cx="4" cy="4" r="1.7" fill="#000" />
      </pattern>
      <pattern id="bw-cross" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect data-bw-preserve="true" width="9" height="9" fill="#fff" />
        <path data-bw-preserve="true" d="M0 0L9 9M9 0L0 9" stroke="#000" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

function CanvasFrame({
  title,
  settings,
  width,
  height,
  children,
}: {
  title: string;
  settings: DiagramSettings;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const top = settings.showTitle ? 58 : 24;
  const contentScale = Math.min(2.5, Math.max(.2, settings.overallScale / 100));
  const diagramFontFamily = `"${settings.englishFont}", "${settings.chineseFont}", "Songti SC", serif`;
  return (
    <svg id="diagram-canvas" className={`diagram-svg ${settings.monochrome ? "bw" : ""}`} viewBox={`0 0 ${width} ${height}`} data-base-view-box={`0 0 ${width} ${height}`} fontFamily={diagramFontFamily} shapeRendering="geometricPrecision" textRendering={settings.monochrome ? "optimizeLegibility" : "geometricPrecision"} role="img" aria-label={title}>
      <rect data-canvas-background="true" width={width} height={height} fill="#ffffff" />
      <DiagramDefs lineWidth={settings.lineWidth} monochrome={settings.monochrome} />
      {settings.showTitle && (
        <>
          <text data-canvas-title="true" x={width / 2} y="31" textAnchor="middle" fontSize="19" fontWeight="700" fill="#17212b">
            {title}
          </text>
          <line data-canvas-separator="true" x1="32" y1="47" x2={width - 32} y2="47" stroke="#d9dde2" strokeWidth="1" />
        </>
      )}
      <g data-canvas-content="true" transform={`translate(${width / 2} ${top}) scale(${contentScale}) translate(${-width / 2} 0)`}>{children}</g>
    </svg>
  );
}

type DragPoint = { x: number; y: number };
type CanvasView = { x: number; y: number; width: number; height: number };
type DragBindOptions = { verticalSnap?: { offsetX: number; guideX: number; threshold?: number } };
const canvasAnimations = new WeakMap<SVGSVGElement, number>();

function applySvgCanvasView(svg: SVGSVGElement, view: CanvasView) {
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
  const background = svg.querySelector<SVGRectElement>("[data-canvas-background]");
  background?.setAttribute("x", String(view.x));
  background?.setAttribute("y", String(view.y));
  background?.setAttribute("width", String(view.width));
  background?.setAttribute("height", String(view.height));
  const title = svg.querySelector<SVGTextElement>("[data-canvas-title]");
  title?.setAttribute("x", String(view.x + view.width / 2));
  const separator = svg.querySelector<SVGLineElement>("[data-canvas-separator]");
  separator?.setAttribute("x1", String(view.x + 32));
  separator?.setAttribute("x2", String(view.x + view.width - 32));
}

function fitSvgCanvasToContent(svg: SVGSVGElement) {
  if (!svg.isConnected) return;
  const content = svg.querySelector<SVGGElement>("[data-canvas-content]");
  const svgRect = svg.getBoundingClientRect();
  const contentRect = content?.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const baseParts = (svg.dataset.baseViewBox || "").split(/\s+/).map(Number);
  if (!contentRect || !svgRect.width || !svgRect.height || baseParts.length !== 4) return;

  const [baseX, baseY, baseWidth, baseHeight] = baseParts;
  const scaleX = viewBox.width / svgRect.width;
  const scaleY = viewBox.height / svgRect.height;
  const contentLeft = viewBox.x + (contentRect.left - svgRect.left) * scaleX;
  const contentTop = viewBox.y + (contentRect.top - svgRect.top) * scaleY;
  const contentRight = viewBox.x + (contentRect.right - svgRect.left) * scaleX;
  const contentBottom = viewBox.y + (contentRect.bottom - svgRect.top) * scaleY;
  const margin = 44;
  const targetX = Math.min(baseX, contentLeft - margin);
  const targetY = Math.min(baseY, contentTop - margin);
  const targetRight = Math.max(baseX + baseWidth, contentRight + margin);
  const targetBottom = Math.max(baseY + baseHeight, contentBottom + margin);
  const start: CanvasView = { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
  const target: CanvasView = { x: targetX, y: targetY, width: targetRight - targetX, height: targetBottom - targetY };
  const previous = canvasAnimations.get(svg);
  if (previous) window.cancelAnimationFrame(previous);
  const startedAt = performance.now();
  const duration = 280;

  const animate = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    applySvgCanvasView(svg, {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
      width: start.width + (target.width - start.width) * eased,
      height: start.height + (target.height - start.height) * eased,
    });
    if (progress < 1) canvasAnimations.set(svg, window.requestAnimationFrame(animate));
    else canvasAnimations.delete(svg);
  };
  canvasAnimations.set(svg, window.requestAnimationFrame(animate));
}

function expandSvgCanvasToContain(element: SVGGElement, clientX: number, clientY: number) {
  const svg = element.ownerSVGElement;
  if (!svg || !element.isConnected) return;
  const svgRect = svg.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  if (!svgRect.width || !svgRect.height || !viewBox.width || !viewBox.height) return;

  const scaleX = viewBox.width / svgRect.width;
  const scaleY = viewBox.height / svgRect.height;
  const elementLeft = viewBox.x + (elementRect.left - svgRect.left) * scaleX;
  const elementTop = viewBox.y + (elementRect.top - svgRect.top) * scaleY;
  const elementRight = viewBox.x + (elementRect.right - svgRect.left) * scaleX;
  const elementBottom = viewBox.y + (elementRect.bottom - svgRect.top) * scaleY;
  const previous = canvasAnimations.get(svg);
  if (previous) {
    window.cancelAnimationFrame(previous);
    canvasAnimations.delete(svg);
  }
  const margin = 40;
  const step = 7;
  const currentRight = viewBox.x + viewBox.width;
  const currentBottom = viewBox.y + viewBox.height;
  const desiredX = Math.min(viewBox.x, elementLeft - margin);
  const desiredY = Math.min(viewBox.y, elementTop - margin);
  const desiredRight = Math.max(currentRight, elementRight + margin);
  const desiredBottom = Math.max(currentBottom, elementBottom + margin);
  const nextX = desiredX < viewBox.x ? Math.max(desiredX, viewBox.x - step) : viewBox.x;
  const nextY = desiredY < viewBox.y ? Math.max(desiredY, viewBox.y - step) : viewBox.y;
  const nextRight = desiredRight > currentRight ? Math.min(desiredRight, currentRight + step) : currentRight;
  const nextBottom = desiredBottom > currentBottom ? Math.min(desiredBottom, currentBottom + step) : currentBottom;

  if (nextX < viewBox.x || nextY < viewBox.y || nextRight > currentRight || nextBottom > currentBottom) {
    const nextWidth = nextRight - nextX;
    const nextHeight = nextBottom - nextY;
    applySvgCanvasView(svg, { x: nextX, y: nextY, width: nextWidth, height: nextHeight });
  }

  const wrap = svg.closest(".canvas-wrap");
  if (wrap instanceof HTMLElement) {
    const wrapRect = wrap.getBoundingClientRect();
    const edge = 34;
    const speed = 7;
    const left = clientX < wrapRect.left + edge ? -speed : clientX > wrapRect.right - edge ? speed : 0;
    const top = clientY < wrapRect.top + edge ? -speed : clientY > wrapRect.bottom - edge ? speed : 0;
    if (left || top) wrap.scrollBy({ left, top, behavior: "auto" });
  }
}

function useSvgDragPositions() {
  const [offsets, setOffsets] = useState<Record<string, DragPoint>>({});
  const [verticalGuideX, setVerticalGuideX] = useState<number | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; origin: DragPoint; start: DragPoint } | null>(null);

  const getOffset = (id: string): DragPoint => offsets[id] || { x: 0, y: 0 };

  const svgPoint = (element: SVGGElement, clientX: number, clientY: number): DragPoint => {
    const svg = element.ownerSVGElement;
    const parent = element.parentElement as unknown as SVGGraphicsElement | null;
    const matrix = parent?.getScreenCTM() || svg?.getScreenCTM();
    if (!svg || !matrix) return { x: clientX, y: clientY };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const result = point.matrixTransform(matrix.inverse());
    return { x: result.x, y: result.y };
  };

  const bind = (id: string, label: string, options?: DragBindOptions) => {
    const offset = getOffset(id);
    return {
      className: "draggable-group",
      "data-drag-id": id,
      role: "group",
      tabIndex: 0,
      "aria-label": `${label}，可拖动`,
      transform: `translate(${offset.x} ${offset.y})`,
      onPointerDown: (event: ReactPointerEvent<SVGGElement>) => {
        if (event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest("text")) return;
        event.stopPropagation();
        const start = svgPoint(event.currentTarget, event.clientX, event.clientY);
        dragRef.current = { id, pointerId: event.pointerId, origin: offset, start };
        setVerticalGuideX(null);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("is-dragging");
      },
      onPointerMove: (event: ReactPointerEvent<SVGGElement>) => {
        const active = dragRef.current;
        if (!active || active.id !== id || active.pointerId !== event.pointerId) return;
        const current = svgPoint(event.currentTarget, event.clientX, event.clientY);
        const next = { x: active.origin.x + current.x - active.start.x, y: active.origin.y + current.y - active.start.y };
        const verticalSnap = options?.verticalSnap;
        if (verticalSnap && Math.abs(next.x - verticalSnap.offsetX) <= (verticalSnap.threshold ?? 12)) {
          next.x = verticalSnap.offsetX;
          setVerticalGuideX(verticalSnap.guideX);
        } else {
          setVerticalGuideX(null);
        }
        setOffsets((values) => ({ ...values, [id]: next }));
        const target = event.currentTarget;
        const clientX = event.clientX;
        const clientY = event.clientY;
        window.requestAnimationFrame(() => expandSvgCanvasToContain(target, clientX, clientY));
      },
      onPointerUp: (event: ReactPointerEvent<SVGGElement>) => {
        if (dragRef.current?.id !== id) return;
        dragRef.current = null;
        setVerticalGuideX(null);
        event.currentTarget.classList.remove("is-dragging");
        const svg = event.currentTarget.ownerSVGElement;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (svg) window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitSvgCanvasToContent(svg)));
      },
      onPointerCancel: (event: ReactPointerEvent<SVGGElement>) => {
        dragRef.current = null;
        setVerticalGuideX(null);
        event.currentTarget.classList.remove("is-dragging");
        const svg = event.currentTarget.ownerSVGElement;
        if (svg) window.requestAnimationFrame(() => fitSvgCanvasToContent(svg));
      },
      onDoubleClick: (event: ReactPointerEvent<SVGGElement>) => {
        if (event.target instanceof Element && event.target.closest("text")) return;
        setOffsets((values) => ({ ...values, [id]: { x: 0, y: 0 } }));
        const svg = event.currentTarget.ownerSVGElement;
        if (svg) window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitSvgCanvasToContent(svg)));
      },
      onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => {
        const directions: Record<string, DragPoint> = {
          ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        setOffsets((values) => {
          const current = values[id] || { x: 0, y: 0 };
          return { ...values, [id]: { x: current.x + direction.x * step, y: current.y + direction.y * step } };
        });
      },
    };
  };

  const movePoint = (id: string, point: DragPoint): DragPoint => {
    const offset = getOffset(id);
    return { x: point.x + offset.x, y: point.y + offset.y };
  };

  return { bind, getOffset, movePoint, verticalGuideX };
}

type ClassNode = { name: string; attributes: string[]; methods: string[]; kind?: string };
type Relation = { from: string; to: string; fromMany: string; toMany: string; arrow: string; label: string };

function parseRelations(lines: string[], allowedArrow = "-->|<\\|--|o--|\\*--|\\.\\.>|--") {
  const relations: Relation[] = [];
  const expression = new RegExp(`^(\\S+)\\s+(\\S+)\\s+(${allowedArrow})\\s+(\\S+)\\s+(\\S+)(?:\\s*:\\s*(.+))?$`);
  for (const line of lines) {
    const match = line.match(expression);
    if (match) relations.push({ from: match[1], fromMany: match[2], arrow: match[3], toMany: match[4], to: match[5], label: match[6] || "" });
  }
  return relations;
}

function ClassDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const lines = dataLines(source);
  const nodes: ClassNode[] = lines
    .filter((line) => line.startsWith("class "))
    .map((line) => {
      const parts = line.replace(/^class\s+/, "").split("|").map((part) => part.trim());
      return { name: parts[0], attributes: (parts[1] || "").split(";").filter(Boolean), methods: (parts[2] || "").split(";").filter(Boolean) };
    });
  const relations = parseRelations(lines);
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const cardW = 210 * borderScale;
  const titleH = Math.max(settings.fontSize + 18, 42 * borderScale);
  const rowStep = Math.max(19, settings.fontSize + 6);
  const attributeRows = Math.max(1, ...nodes.map((node) => Math.min(3, node.attributes.length)));
  const methodRows = Math.max(1, ...nodes.map((node) => Math.min(3, node.methods.length)));
  const dividerY = titleH + attributeRows * rowStep + 8;
  const cardH = dividerY + methodRows * rowStep + 12;
  const gapX = 84 * spacing;
  const gapY = 70 * spacing;
  const width = Math.max(760, cols * cardW + (cols - 1) * gapX + 100);
  const rows = Math.ceil(nodes.length / cols);
  const height = Math.max(520, rows * cardH + (rows - 1) * gapY + 120);
  const positions = new Map(nodes.map((node, index) => [node.name, { x: 50 + (index % cols) * (cardW + gapX), y: 28 + Math.floor(index / cols) * (cardH + gapY) }]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const accent = settings.monochrome ? "#ffffff" : "#eef2ff";

  return (
    <CanvasFrame title={titleFrom(source, "UML 类图")} settings={settings} width={width} height={height}>
      {relations.map((relation, index) => {
        const fromBase = positions.get(relation.from);
        const toBase = positions.get(relation.to);
        if (!fromBase || !toBase) return null;
        const from = drag.movePoint(`class:${relation.from}`, fromBase);
        const to = drag.movePoint(`class:${relation.to}`, toBase);
        const x1 = from.x + cardW / 2;
        const y1 = from.y + cardH / 2;
        const x2 = to.x + cardW / 2;
        const y2 = to.y + cardH / 2;
        return (
          <g key={`${relation.from}-${relation.to}-${index}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth={settings.lineWidth} strokeDasharray={relation.arrow.includes(".") ? "7 5" : undefined} markerEnd="url(#open-arrow)" />
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 7} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#59636e" paintOrder="stroke" stroke="#fff" strokeWidth="5">{relation.label}</text>
            <text x={x1 + (x2 > x1 ? 14 : -14)} y={y1 - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill={ink}>{relation.fromMany}</text>
            <text x={x2 + (x2 > x1 ? -14 : 14)} y={y2 - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill={ink}>{relation.toMany}</text>
          </g>
        );
      })}
      {nodes.map((node) => {
        const point = positions.get(node.name)!;
        return (
          <g key={node.name} {...drag.bind(`class:${node.name}`, `${node.name}类`)}>
            <g transform={`translate(${point.x} ${point.y})`} filter="url(#soft-shadow)">
              <rect width={cardW} height={cardH} rx="5" fill="#fff" stroke={ink} strokeWidth={settings.lineWidth} />
              <rect width={cardW} height={titleH} rx="5" fill={accent} stroke={ink} strokeWidth={settings.lineWidth} />
              <rect y={titleH - 5} width={cardW} height="5" fill={accent} />
              <text x={cardW / 2} y="27" textAnchor="middle" fontSize={settings.fontSize + 1} fontWeight="700" fill={ink}>{node.name}</text>
              <line x1="0" y1={dividerY} x2={cardW} y2={dividerY} stroke={ink} strokeWidth={settings.lineWidth} />
              {node.attributes.slice(0, 3).map((item, i) => <text key={item} x="12" y={titleH + rowStep - 5 + i * rowStep} fontSize={settings.fontSize - 2} fill={ink}>{item.trim()}</text>)}
              {node.methods.slice(0, 3).map((item, i) => <text key={item} x="12" y={dividerY + rowStep - 5 + i * rowStep} fontSize={settings.fontSize - 2} fill={ink}>{item.trim()}</text>)}
            </g>
          </g>
        );
      })}
    </CanvasFrame>
  );
}

function ERDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const parsedInput = parseErInput(source);
  const entities = parsedInput.entities;
  const relations = parsedInput.relations;
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const cols = Math.min(2, Math.max(1, entities.length));
  const rows = Math.max(1, Math.ceil(entities.length / cols));
  const clusterW = 580 * spacing;
  const clusterH = 390 * spacing;
  const width = Math.max(720, cols * clusterW + 40);
  const height = Math.max(470, rows * clusterH + 70);
  const longestEntityName = Math.max(1, ...entities.map((entity) => entity.name.length));
  const entityW = Math.max(longestEntityName * settings.fontSize * .7 + 36, 190 * borderScale);
  const entityH = Math.max(settings.fontSize + 24, 62 * borderScale);
  const gridStartX = (width - cols * clusterW) / 2;
  const positions = new Map(entities.map((entity, index) => [entity.name, {
    x: gridStartX + clusterW / 2 + (index % cols) * clusterW,
    y: 20 + clusterH / 2 + Math.floor(index / cols) * clusterH,
  }]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const entityFill = settings.monochrome ? "#ffffff" : "#eaf3ff";
  const relationFill = settings.monochrome ? "#ffffff" : "#f1f7ff";

  const cleanField = (field: string) => field.replace(/\((PK|FK)\)/g, "").trim();
  const attributePoints = (count: number) => Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, count);
    return { x: Math.cos(angle) * 185 * spacing, y: Math.sin(angle) * 132 * spacing };
  });

  const pointOnEntityEdge = (center: DragPoint, target: DragPoint) => {
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    const divisor = Math.max(Math.abs(dx) / (entityW / 2), Math.abs(dy) / (entityH / 2), .001);
    return { x: center.x + dx / divisor, y: center.y + dy / divisor };
  };

  return (
    <CanvasFrame title={titleFrom(source, "E-R 图")} settings={settings} width={width} height={height}>
      {relations.map((relation, index) => {
        const aBase = positions.get(relation.from);
        const bBase = positions.get(relation.to);
        if (!aBase || !bBase) return null;
        const a = drag.movePoint(`er-entity:${relation.from}`, aBase);
        const b = drag.movePoint(`er-entity:${relation.to}`, bBase);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const laneDirection = index % 2 === 0 ? 1 : -1;
        const vertical = Math.abs(dx) < clusterW * .28;
        const horizontal = Math.abs(dy) < clusterH * .28;
        const lane = 66 * spacing;
        const middleBase = {
          x: (a.x + b.x) / 2 + (vertical ? laneDirection * 110 * spacing : !horizontal ? (-dy / distance) * lane * laneDirection : 0),
          y: (a.y + b.y) / 2 + (horizontal ? laneDirection * 90 * spacing : !vertical ? (dx / distance) * lane * laneDirection : 0),
        };
        const relationOffset = drag.getOffset(`er-relation:${index}`);
        const middleX = middleBase.x + relationOffset.x;
        const middleY = middleBase.y + relationOffset.y;
        const middle = { x: middleX, y: middleY };
        const fromEdge = pointOnEntityEdge(a, middle);
        const toEdge = pointOnEntityEdge(b, middle);
        const fromDistance = Math.max(1, Math.hypot(middleX - a.x, middleY - a.y));
        const toDistance = Math.max(1, Math.hypot(middleX - b.x, middleY - b.y));
        const fromUx = (middleX - a.x) / fromDistance;
        const fromUy = (middleY - a.y) / fromDistance;
        const toUx = (middleX - b.x) / toDistance;
        const toUy = (middleY - b.y) / toDistance;
        const x1 = fromEdge.x;
        const y1 = fromEdge.y;
        const x2 = toEdge.x;
        const y2 = toEdge.y;
        const relationName = relation.label || "关联";
        const diamondW = Math.max(relationName.length * settings.fontSize + 30, Math.min(112, Math.max(72, relationName.length * settings.fontSize + 30)) * borderScale);
        const diamondH = Math.max(settings.fontSize + 18, 48 * borderScale);
        const fromLabelX = (x1 + middleX) / 2;
        const fromLabelY = (y1 + middleY) / 2;
        const toLabelX = (x2 + middleX) / 2;
        const toLabelY = (y2 + middleY) / 2;
        const fromGap = Math.max(24, relation.fromMany.length * Math.max(12, settings.fontSize - 2) * .8 + 12);
        const toGap = Math.max(24, relation.toMany.length * Math.max(12, settings.fontSize - 2) * .8 + 12);
        const fromGapStart = { x: fromLabelX - fromUx * fromGap / 2, y: fromLabelY - fromUy * fromGap / 2 };
        const fromGapEnd = { x: fromLabelX + fromUx * fromGap / 2, y: fromLabelY + fromUy * fromGap / 2 };
        const toGapStart = { x: toLabelX - toUx * toGap / 2, y: toLabelY - toUy * toGap / 2 };
        const toGapEnd = { x: toLabelX + toUx * toGap / 2, y: toLabelY + toUy * toGap / 2 };
        return <g key={index}>
          <line x1={x1} y1={y1} x2={fromGapStart.x} y2={fromGapStart.y} stroke={ink} strokeWidth={settings.lineWidth} />
          <line x1={fromGapEnd.x} y1={fromGapEnd.y} x2={middleX} y2={middleY} stroke={ink} strokeWidth={settings.lineWidth} />
          <line x1={x2} y1={y2} x2={toGapStart.x} y2={toGapStart.y} stroke={ink} strokeWidth={settings.lineWidth} />
          <line x1={toGapEnd.x} y1={toGapEnd.y} x2={middleX} y2={middleY} stroke={ink} strokeWidth={settings.lineWidth} />
          <g {...drag.bind(`er-relation:${index}`, `${relationName}关系`)}>
            <path d={`M ${middleBase.x} ${middleBase.y - diamondH / 2} L ${middleBase.x + diamondW / 2} ${middleBase.y} L ${middleBase.x} ${middleBase.y + diamondH / 2} L ${middleBase.x - diamondW / 2} ${middleBase.y} Z`} fill={relationFill} stroke={ink} strokeWidth={settings.lineWidth} />
            <text x={middleBase.x} y={middleBase.y + 5} textAnchor="middle" fontSize={Math.max(12, settings.fontSize - 2)} fontWeight="600" fill={ink}>{relationName}</text>
          </g>
          <text x={fromLabelX} y={fromLabelY + 4} fontSize={Math.max(12, settings.fontSize - 2)} fontWeight="700" textAnchor="middle" fill={ink}>{relation.fromMany}</text>
          <text x={toLabelX} y={toLabelY + 4} fontSize={Math.max(12, settings.fontSize - 2)} fontWeight="700" textAnchor="middle" fill={ink}>{relation.toMany}</text>
        </g>;
      })}
      {entities.map((entity) => {
        const basePoint = positions.get(entity.name)!;
        const point = drag.movePoint(`er-entity:${entity.name}`, basePoint);
        const fields = entity.fields.slice(0, 8);
        const points = attributePoints(fields.length);
        return <g key={entity.name}>
          {fields.map((field, index) => {
            const attribute = points[index];
            const attributeOffset = drag.getOffset(`er-attribute:${entity.name}:${index}`);
            return <line key={`line-${field}`} x1={point.x} y1={point.y} x2={point.x + attribute.x + attributeOffset.x} y2={point.y + attribute.y + attributeOffset.y} stroke={ink} strokeWidth={settings.lineWidth} />;
          })}
          {fields.map((field, index) => {
            const attribute = points[index];
            const fieldName = cleanField(field);
            const primaryKey = settings.showPrimaryKeys && field.includes("(PK)");
            const baseEllipseRx = Math.max(62, Math.min(92, fieldName.length * settings.fontSize * .55 + 24));
            const ellipseRx = Math.max(fieldName.length * settings.fontSize * .34 + 18, baseEllipseRx * borderScale);
            const ellipseRy = Math.max(settings.fontSize + 10, 28 * borderScale);
            return <g key={field} {...drag.bind(`er-attribute:${entity.name}:${index}`, `${entity.name}的${fieldName}属性`)}>
              <g transform={`translate(${point.x + attribute.x} ${point.y + attribute.y})`}>
                <ellipse rx={ellipseRx} ry={ellipseRy} fill="#ffffff" stroke={ink} strokeWidth={settings.lineWidth} />
                <text y="5" textAnchor="middle" fontSize={settings.fontSize} fontWeight={primaryKey ? "700" : "500"} textDecoration={primaryKey ? "underline" : undefined} fill={ink}>{fieldName}</text>
              </g>
            </g>;
          })}
          <g {...drag.bind(`er-entity:${entity.name}`, `${entity.name}实体`)}>
            <g filter="url(#soft-shadow)">
              <rect x={basePoint.x - entityW / 2} y={basePoint.y - entityH / 2} width={entityW} height={entityH} rx="2" fill={entityFill} stroke={ink} strokeWidth={settings.lineWidth} />
              <text x={basePoint.x} y={basePoint.y + 6} textAnchor="middle" fontSize={settings.fontSize + 2} fontWeight="700" fill={ink}>{entity.name}</text>
            </g>
          </g>
        </g>;
      })}
      {entities.length === 0 && <text x={width / 2} y="170" textAnchor="middle" fontSize="16" fill="#687b8f">{parsedInput.sqlMode ? "未识别到完整的 CREATE TABLE 结构" : "请输入“实体名: 属性1, 属性2”或 CREATE TABLE SQL"}</text>}
    </CanvasFrame>
  );
}

function FlowDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const lines = dataLines(source);
  const nodeLines = lines.filter((line) => /\[(start|process|decision|end)\]$/.test(line));
  const nodes = nodeLines.map((line) => ({ name: line.replace(/\s*\[[^\]]+\]$/, ""), type: line.match(/\[([^\]]+)\]$/)?.[1] || "process" }));
  const edges = lines.filter((line) => line.includes("->") && !nodeLines.includes(line)).map((line) => {
    const labelled = line.match(/^(.+?)\s+-([^>-]+)->\s+(.+)$/);
    if (labelled) return { from: labelled[1].trim(), label: labelled[2].trim(), to: labelled[3].trim() };
    const plain = line.split("->");
    return { from: plain[0].trim(), label: "", to: plain[1]?.trim() || "" };
  });
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const longestNodeName = Math.max(1, ...nodes.map((node) => node.name.length));
  const nodeW = Math.max(longestNodeName * settings.fontSize * .72 + 42, 184 * borderScale);
  const nodeH = Math.max(settings.fontSize + 22, 58 * borderScale);
  const decisionW = Math.max(longestNodeName * settings.fontSize * .48 + 30, 83 * borderScale);
  const decisionH = Math.max(settings.fontSize + 16, 39 * borderScale);
  const verticalHalf = Math.max(nodeH / 2, decisionH);
  const nodeStep = Math.max(verticalHalf * 2 + 18, verticalHalf * 2 + 34 * spacing);
  const branchOffset = 160 * spacing;
  const flowCenterX = Math.max(390, nodeW / 2 + 60);
  const width = Math.max(780, flowCenterX + branchOffset + nodeW / 2 + 60);
  const height = Math.max(560, nodes.length * nodeStep + 90);
  const positions = new Map(nodes.map((node, index) => [node.name, { x: index > 3 && index % 2 ? flowCenterX + branchOffset : flowCenterX, y: 38 + index * nodeStep }]));
  const nodeTypes = new Map(nodes.map((node) => [node.name, node.type]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const fill = settings.monochrome ? "#ffffff" : "#fff5d8";
  return <CanvasFrame title={titleFrom(source, "系统流程图")} settings={settings} width={width} height={height}>
    {edges.map((edge, index) => {
      const aBase = positions.get(edge.from);
      const bBase = positions.get(edge.to);
      if (!aBase || !bBase) return null;
      const a = drag.movePoint(`flow:${edge.from}`, aBase);
      const b = drag.movePoint(`flow:${edge.to}`, bBase);
      const aHalfH = nodeTypes.get(edge.from) === "decision" ? decisionH : nodeH / 2;
      const bHalfH = nodeTypes.get(edge.to) === "decision" ? decisionH : nodeH / 2;
      return <g key={index}>
        <line x1={a.x} y1={a.y + aHalfH} x2={b.x} y2={b.y - bHalfH} stroke={ink} strokeWidth={settings.lineWidth} markerEnd="url(#arrow)" />
        {edge.label && <text x={(a.x + b.x) / 2 + 10} y={(a.y + b.y) / 2 - 3} fontSize={settings.fontSize - 2} fill="#5d6670" paintOrder="stroke" stroke="#fff" strokeWidth="5">{edge.label}</text>}
      </g>;
    })}
    {nodes.map((node) => {
      const point = positions.get(node.name)!;
      if (node.type === "decision") return <g key={node.name} {...drag.bind(`flow:${node.name}`, `${node.name}流程节点`)}><g transform={`translate(${point.x} ${point.y})`}><path d={`M 0 ${-decisionH} L ${decisionW} 0 L 0 ${decisionH} L ${-decisionW} 0 Z`} fill={fill} stroke={ink} strokeWidth={settings.lineWidth} /><text textAnchor="middle" y="5" fontSize={settings.fontSize} fontWeight="600">{node.name}</text></g></g>;
      const rounded = node.type === "start" || node.type === "end";
      return <g key={node.name} {...drag.bind(`flow:${node.name}`, `${node.name}流程节点`)}><g transform={`translate(${point.x} ${point.y})`} filter="url(#soft-shadow)"><rect x={-nodeW / 2} y={-nodeH / 2} width={nodeW} height={nodeH} rx={rounded ? nodeH / 2 : 5} fill={node.type === "end" && !settings.monochrome ? "#eaf7f2" : fill} stroke={ink} strokeWidth={settings.lineWidth} /><text textAnchor="middle" y="5" fontSize={settings.fontSize} fontWeight="600">{node.name}</text></g></g>;
    })}
  </CanvasFrame>;
}

function SequenceDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const lines = dataLines(source);
  const participants = lines.filter((line) => line.startsWith("participant ")).map((line) => line.replace("participant ", "").trim());
  const messages = lines.filter((line) => /\s--?>\s/.test(line)).map((line) => {
    const match = line.match(/^(.+?)\s+(--?>)\s+(.+?)(?:\s*:\s*(.+))?$/);
    return match ? { from: match[1].trim(), to: match[3].trim(), dashed: match[2] === "-->", label: match[4] || "" } : null;
  }).filter(Boolean) as { from: string; to: string; dashed: boolean; label: string }[];
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const longestParticipant = Math.max(1, ...participants.map((name) => name.length));
  const participantW = Math.max(longestParticipant * settings.fontSize * .72 + 32, 124 * borderScale);
  const participantH = Math.max(settings.fontSize + 18, 42 * borderScale);
  const baseSequenceWidth = Math.max(820, participants.length * 190 + 80);
  const baseParticipantStep = (baseSequenceWidth - 140) / Math.max(1, participants.length - 1);
  const participantStep = Math.max(participantW + 30, baseParticipantStep * spacing);
  const messageStep = Math.max(settings.fontSize + 26, 58 * spacing);
  const participantSpan = Math.max(0, participants.length - 1) * participantStep;
  const width = Math.max(baseSequenceWidth, participantSpan + 140);
  const height = Math.max(540, messages.length * messageStep + 180);
  const bottomParticipantY = height - participantH - 28;
  const participantStartX = (width - participantSpan) / 2;
  const positions = new Map(participants.map((name, i) => [name, participantStartX + i * participantStep]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  return <CanvasFrame title={titleFrom(source, "UML 时序图")} settings={settings} width={width} height={height}>
    {participants.map((name) => {
      const x = positions.get(name)!;
      return <g key={name} {...drag.bind(`sequence-participant:${name}`, `${name}参与者`)}>
        <rect x={x - participantW / 2} y="18" width={participantW} height={participantH} rx="4" fill={settings.monochrome ? "#ffffff" : "#eef2ff"} stroke={ink} strokeWidth={settings.lineWidth} />
        <text x={x} y={18 + participantH / 2 + 5} textAnchor="middle" fontSize={settings.fontSize} fontWeight="700" fill={ink}>{name}</text>
        <line x1={x} y1={18 + participantH} x2={x} y2={bottomParticipantY} stroke={settings.monochrome ? "#000000" : "#7b848d"} strokeWidth={settings.lineWidth} strokeDasharray="6 6" />
        <rect x={x - participantW / 2} y={bottomParticipantY} width={participantW} height={participantH} rx="4" fill={settings.monochrome ? "#ffffff" : "#eef2ff"} stroke={ink} strokeWidth={settings.lineWidth} />
        <text x={x} y={bottomParticipantY + participantH / 2 + 5} textAnchor="middle" fontSize={settings.fontSize} fontWeight="700" fill={ink}>{name}</text>
      </g>;
    })}
    {messages.map((message, index) => {
      const x1Base = positions.get(message.from);
      const x2Base = positions.get(message.to);
      if (x1Base === undefined || x2Base === undefined) return null;
      const x1 = x1Base + drag.getOffset(`sequence-participant:${message.from}`).x;
      const x2 = x2Base + drag.getOffset(`sequence-participant:${message.to}`).x;
      const y = 104 + index * messageStep;
      const self = message.from === message.to;
      return <g key={index} {...drag.bind(`sequence-message:${index}`, `第${index + 1}条消息`)}>{self ? <path d={`M ${x1} ${y} h 70 v 30 h -70`} fill="none" stroke={ink} strokeWidth={settings.lineWidth} markerEnd="url(#arrow)" /> : <line x1={x1} y1={y} x2={x2} y2={y} stroke={ink} strokeWidth={settings.lineWidth} strokeDasharray={message.dashed ? "7 5" : undefined} markerEnd="url(#arrow)" />}<text x={self ? x1 + 38 : (x1 + x2) / 2} y={y - 9} textAnchor="middle" fontSize={settings.fontSize - 1} fill={ink}>{index + 1}. {message.label}</text></g>;
    })}
  </CanvasFrame>;
}

function UseCaseDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const [customBoundarySize, setCustomBoundarySize] = useState<{ width: number; height: number } | null>(null);
  const boundaryResizeRef = useRef<{ pointerId: number; clientX: number; clientY: number; width: number; height: number; scaleX: number; scaleY: number } | null>(null);
  const lines = dataLines(source);
  const system = lines.find((line) => line.startsWith("system "))?.replace("system ", "") || "系统";
  const actors = lines.filter((line) => line.startsWith("actor ")).map((line) => line.replace("actor ", "").trim());
  const parsedLinks = lines.flatMap((line, sourceIndex) => {
    if (line.startsWith("actor ") || line.startsWith("system ")) return [];
    const match = line.match(/^(.+?)\s*(\.\.>|-->|->)\s*(.+?)(?:\s*:\s*(include|extend|包含|扩展))?$/i);
    if (!match) return [];
    const [, from, arrow, to, rawKind] = match;
    const normalizedKind = rawKind?.toLowerCase();
    const kind = normalizedKind === "extend" || normalizedKind === "扩展"
      ? "extend"
      : normalizedKind === "include" || normalizedKind === "包含" || arrow === "..>"
        ? "include"
        : "association";
    return [{ from: from.trim(), to: to.trim(), kind, sourceIndex }];
  });
  const associations = parsedLinks.filter((link) => link.kind === "association" && actors.includes(link.from));
  const dependencies = parsedLinks.filter((link) => link.kind !== "association" || !actors.includes(link.from));
  const primaryUsecases = Array.from(new Set([
    ...associations.map((link) => link.to),
    ...dependencies.map((link) => link.from),
  ])).filter(Boolean);
  const secondaryUsecases = Array.from(new Set(dependencies.map((link) => link.to))).filter((item) => item && !primaryUsecases.includes(item));
  const usecases = [...primaryUsecases, ...secondaryUsecases];
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const usecaseRy = Math.max(settings.fontSize * .8 + 12, 27 * borderScale);
  const usecaseRx = (label: string) => Math.max(label.length * settings.fontSize * .3 + 19, 76 * borderScale);
  const primaryRx = Math.max(76 * borderScale, ...primaryUsecases.map(usecaseRx));
  const secondaryRx = Math.max(76 * borderScale, ...secondaryUsecases.map(usecaseRx));
  const headerH = Math.max(54, settings.fontSize + 30);
  const rowStep = Math.max(usecaseRy * 2 + 16, 74 * spacing);
  const rowCount = Math.max(1, primaryUsecases.length, secondaryUsecases.length);
  const naturalContentH = Math.max(rowCount * rowStep, 350 * borderScale);
  const columnGap = Math.max(115 * spacing, settings.fontSize * 5.5);
  const naturalBoundaryW = Math.max(640 * borderScale, primaryRx * 2 + secondaryRx * 2 + columnGap + 80);
  const naturalBoundaryH = headerH + naturalContentH + 28;
  const minimumBoundaryW = Math.max(430, primaryRx * 2 + secondaryRx * 2 + 120);
  const minimumBoundaryH = headerH + rowCount * (usecaseRy * 2 + 16) + 28;
  const boundaryW = Math.max(minimumBoundaryW, customBoundarySize?.width ?? naturalBoundaryW);
  const boundaryH = Math.max(minimumBoundaryH, customBoundarySize?.height ?? naturalBoundaryH);
  const contentH = boundaryH - headerH - 28;
  const actorZone = Math.max(190, 185 * borderScale);
  const width = Math.max(900, actorZone + boundaryW + 70);
  const height = Math.max(620, boundaryH + 80);
  const boundaryX = actorZone;
  const boundaryY = 18;
  const primaryX = boundaryX + 42 + primaryRx;
  const secondaryX = boundaryX + boundaryW - 42 - secondaryRx;
  const columnTop = boundaryY + headerH;
  const columnY = (index: number, count: number) => columnTop + (contentH * (index + 1)) / (count + 1);
  const usePositions = new Map<string, DragPoint>([
    ...primaryUsecases.map((item, index) => [item, { x: primaryX, y: columnY(index, primaryUsecases.length) }] as [string, DragPoint]),
    ...secondaryUsecases.map((item, index) => [item, { x: secondaryX, y: columnY(index, secondaryUsecases.length) }] as [string, DragPoint]),
  ]);
  const actorPositions = new Map(actors.map((actor, index) => [actor, {
    x: boundaryX - actorZone * .48,
    y: boundaryY + headerH + (contentH * (index + 1)) / (actors.length + 1),
  }]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const mutedInk = settings.monochrome ? "#000000" : "#516273";
  const boundaryFill = settings.monochrome ? "#ffffff" : "#f5f9ff";
  const usecaseFill = settings.monochrome ? "#ffffff" : "#eef6ff";
  const startBoundaryResize = (event: ReactPointerEvent<SVGGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const matrix = event.currentTarget.getScreenCTM();
    boundaryResizeRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      width: boundaryW,
      height: boundaryH,
      scaleX: matrix ? Math.max(.01, Math.hypot(matrix.a, matrix.b)) : 1,
      scaleY: matrix ? Math.max(.01, Math.hypot(matrix.c, matrix.d)) : 1,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizeBoundary = (event: ReactPointerEvent<SVGGElement>) => {
    const active = boundaryResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const nextWidth = Math.min(3600, Math.max(minimumBoundaryW, active.width + (event.clientX - active.clientX) / active.scaleX));
    const nextHeight = Math.min(3600, Math.max(minimumBoundaryH, active.height + (event.clientY - active.clientY) / active.scaleY));
    setCustomBoundarySize({ width: Math.round(nextWidth), height: Math.round(nextHeight) });
    const target = event.currentTarget;
    const clientX = event.clientX;
    const clientY = event.clientY;
    window.requestAnimationFrame(() => expandSvgCanvasToContain(target, clientX, clientY));
  };
  const stopBoundaryResize = (event: ReactPointerEvent<SVGGElement>) => {
    if (boundaryResizeRef.current?.pointerId !== event.pointerId) return;
    boundaryResizeRef.current = null;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const svg = event.currentTarget.ownerSVGElement;
    if (svg) window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitSvgCanvasToContent(svg)));
  };
  const resizeBoundaryByKeyboard = (event: ReactKeyboardEvent<SVGGElement>) => {
    const step = event.shiftKey ? 30 : 10;
    const widthDelta = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const heightDelta = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if (!widthDelta && !heightDelta) return;
    event.preventDefault();
    event.stopPropagation();
    setCustomBoundarySize({
      width: Math.min(3600, Math.max(minimumBoundaryW, boundaryW + widthDelta)),
      height: Math.min(3600, Math.max(minimumBoundaryH, boundaryH + heightDelta)),
    });
  };
  return <CanvasFrame title={titleFrom(source, "系统用例图")} settings={settings} width={width} height={height}>
    <g {...drag.bind("usecase:boundary", `${system}边界`)}><rect x={boundaryX} y={boundaryY} width={boundaryW} height={boundaryH} rx={2 * borderScale} fill={boundaryFill} stroke={ink} strokeWidth={settings.lineWidth} /><text x={boundaryX + boundaryW / 2} y={boundaryY + Math.max(31, settings.fontSize + 8)} textAnchor="middle" fontSize={settings.fontSize + 1} fontWeight="700" fill={ink}>{system}</text><g className="usecase-resize-handle" data-export-ignore="true" role="button" tabIndex={0} aria-label={`调整系统边界大小，当前 ${Math.round(boundaryW)} × ${Math.round(boundaryH)}`} onPointerDown={startBoundaryResize} onPointerMove={resizeBoundary} onPointerUp={stopBoundaryResize} onPointerCancel={stopBoundaryResize} onKeyDown={resizeBoundaryByKeyboard}><title>拖动右下角调整系统边界大小</title><rect x={boundaryX + boundaryW - 22} y={boundaryY + boundaryH - 22} width="44" height="44" fill="transparent" /></g></g>
    {associations.map((relation, index) => {
      const aBase = actorPositions.get(relation.from);
      const uBase = usePositions.get(relation.to);
      if (!aBase || !uBase) return null;
      const a = drag.movePoint(`usecase-actor:${relation.from}`, aBase);
      const u = drag.movePoint(`usecase-item:${relation.to}`, uBase);
      const startX = a.x + 28 * borderScale;
      const endX = u.x - usecaseRx(relation.to) - 5;
      const span = Math.max(80, endX - startX);
      return <path key={`${relation.sourceIndex}-${index}`} d={`M ${startX} ${a.y} C ${startX + span * .28} ${a.y}, ${endX - span * .3} ${u.y}, ${endX} ${u.y}`} fill="none" stroke={mutedInk} strokeWidth={settings.lineWidth} markerEnd="url(#arrow)" />;
    })}
    {dependencies.map((relation, index) => {
      const fromBase = usePositions.get(relation.from);
      const toBase = usePositions.get(relation.to);
      if (!fromBase || !toBase) return null;
      const from = drag.movePoint(`usecase-item:${relation.from}`, fromBase);
      const to = drag.movePoint(`usecase-item:${relation.to}`, toBase);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const horizontal = Math.abs(dx) >= Math.abs(dy) * .55;
      const directionX = dx >= 0 ? 1 : -1;
      const directionY = dy >= 0 ? 1 : -1;
      const start = horizontal
        ? { x: from.x + directionX * usecaseRx(relation.from), y: from.y }
        : { x: from.x, y: from.y + directionY * usecaseRy };
      const end = horizontal
        ? { x: to.x - directionX * usecaseRx(relation.to) - directionX * 5, y: to.y }
        : { x: to.x, y: to.y - directionY * usecaseRy - directionY * 5 };
      const labelX = (start.x + end.x) / 2;
      const labelY = (start.y + end.y) / 2 - 7;
      const label = relation.kind === "extend" ? "«extend»" : "«include»";
      const labelW = Math.max(66, label.length * Math.max(10, settings.fontSize - 3) * .56);
      return <g key={`${relation.sourceIndex}-${index}`}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={mutedInk} strokeWidth={settings.lineWidth} strokeDasharray="8 7" markerEnd="url(#arrow)" />
        <rect x={labelX - labelW / 2} y={labelY - settings.fontSize + 2} width={labelW} height={settings.fontSize + 6} rx="3" fill={boundaryFill} />
        <text x={labelX} y={labelY} textAnchor="middle" fontSize={Math.max(10, settings.fontSize - 3)} fill={ink}>{label}</text>
      </g>;
    })}
    {actors.map((actor) => {
      const p = actorPositions.get(actor)!;
      const figureScale = Math.max(.75, borderScale);
      return <g key={actor} {...drag.bind(`usecase-actor:${actor}`, `${actor}角色`)}><g transform={`translate(${p.x} ${p.y})`}><circle cx="0" cy={-28 * figureScale} r={10 * figureScale} fill={boundaryFill} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={-18 * figureScale} x2="0" y2={20 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1={-20 * figureScale} y1={-5 * figureScale} x2={20 * figureScale} y2={-5 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={20 * figureScale} x2={-17 * figureScale} y2={43 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={20 * figureScale} x2={17 * figureScale} y2={43 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><text x="0" y={63 * figureScale} textAnchor="middle" fontSize={settings.fontSize} fontWeight="600" fill={ink}>{actor}</text></g></g>;
    })}
    {usecases.map((usecase) => {
      const p = usePositions.get(usecase)!;
      return <g key={usecase} {...drag.bind(`usecase-item:${usecase}`, `${usecase}用例`)} filter="url(#soft-shadow)"><ellipse cx={p.x} cy={p.y} rx={usecaseRx(usecase)} ry={usecaseRy} fill={usecaseFill} stroke={ink} strokeWidth={settings.lineWidth} /><text x={p.x} y={p.y + settings.fontSize * .34} textAnchor="middle" fontSize={settings.fontSize} fontWeight="600" fill={ink}>{usecase}</text></g>;
    })}
  </CanvasFrame>;
}

function FunctionModuleDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const lines = dataLines(source);
  const system = lines.find((line) => line.startsWith("system "))?.replace("system ", "").trim() || "系统名称";
  const groups = lines.filter((line) => !line.startsWith("system ")).flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return [];
    const name = line.slice(0, separator).trim();
    const items = line.slice(separator + 1).split(/[;,；，]/).map((item) => item.trim()).filter(Boolean);
    return name && items.length ? [{ name, items }] : [];
  });
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const ink = settings.monochrome ? "#000000" : "#26384a";
  const lineInk = settings.monochrome ? "#000000" : "#48647f";
  const rootFill = settings.monochrome ? "#ffffff" : "#e7f2ff";
  const groupFill = settings.monochrome ? "#ffffff" : "#eef7ff";
  const itemFill = settings.monochrome ? "#ffffff" : "#f7fbff";
  const rootW = Math.max(system.length * settings.fontSize * .72 + 42, 156 * borderScale);
  const rootH = Math.max(settings.fontSize + 20, 46 * borderScale);
  const groupH = Math.max(settings.fontSize + 19, 44 * borderScale);
  const leafW = Math.max(settings.fontSize + 28, 48 * borderScale);
  const longestItem = Math.max(2, ...groups.flatMap((group) => group.items.map((item) => Array.from(item.replace(/\s+/g, "")).length)));
  const leafH = Math.max(longestItem * (settings.fontSize + 3) + 28, 142 * borderScale);
  const leafGap = Math.max(14, 28 * spacing);
  const groupGap = Math.max(52, 78 * spacing);
  const groupW = (name: string) => Math.max(name.length * settings.fontSize * .68 + 38, 132 * borderScale);
  const spans = groups.map((group) => Math.max(groupW(group.name), group.items.length * leafW + Math.max(0, group.items.length - 1) * leafGap));
  const contentW = spans.reduce((sum, span) => sum + span, 0) + Math.max(0, groups.length - 1) * groupGap;
  const width = Math.max(900, contentW + 110);
  const rootCenter: DragPoint = { x: width / 2, y: 36 + rootH / 2 };
  const rootBusY = rootCenter.y + rootH / 2 + Math.max(28, 42 * spacing);
  const groupCenterY = rootBusY + Math.max(32, 45 * spacing) + groupH / 2;
  const childBusGap = Math.max(34, 50 * spacing);
  const leafTopBase = groupCenterY + groupH / 2 + childBusGap + Math.max(25, 34 * spacing);
  const leafCenterY = leafTopBase + leafH / 2;
  const height = Math.max(590, leafTopBase + leafH + 65);
  let cursorX = (width - contentW) / 2;
  const groupLayouts = groups.map((group, groupIndex) => {
    const span = spans[groupIndex];
    const centerX = cursorX + span / 2;
    const itemTotalW = group.items.length * leafW + Math.max(0, group.items.length - 1) * leafGap;
    const itemStartX = centerX - itemTotalW / 2 + leafW / 2;
    const items = group.items.map((item, itemIndex) => ({
      label: item,
      id: `module-item:${groupIndex}:${itemIndex}`,
      base: { x: itemStartX + itemIndex * (leafW + leafGap), y: leafCenterY } as DragPoint,
    }));
    cursorX += span + groupGap;
    return { ...group, id: `module-group:${groupIndex}`, base: { x: centerX, y: groupCenterY } as DragPoint, items };
  });
  const root = drag.movePoint("module:root", rootCenter);
  const movedGroups = groupLayouts.map((group) => ({ ...group, point: drag.movePoint(group.id, group.base) }));
  const upperBusStart = Math.min(...movedGroups.map((group) => group.point.x), root.x);
  const upperBusEnd = Math.max(...movedGroups.map((group) => group.point.x), root.x);
  const renderVerticalLabel = (label: string, x: number, y: number) => {
    const chars = Array.from(label.replace(/\s+/g, ""));
    const lineHeight = settings.fontSize + 3;
    const firstY = y - ((chars.length - 1) * lineHeight) / 2 + settings.fontSize * .34;
    return <text x={x} y={firstY} textAnchor="middle" fontSize={settings.fontSize} fontWeight="600" fill={ink}>{chars.map((char, index) => <tspan key={`${char}-${index}`} x={x} y={firstY + index * lineHeight}>{char}</tspan>)}</text>;
  };

  return <CanvasFrame title={titleFrom(source, "系统功能模块图")} settings={settings} width={width} height={height}>
    {groups.length > 0 && <g aria-hidden="true">
      <line x1={root.x} y1={root.y + rootH / 2} x2={root.x} y2={rootBusY} stroke={lineInk} strokeWidth={settings.lineWidth} />
      <line x1={upperBusStart} y1={rootBusY} x2={upperBusEnd} y2={rootBusY} stroke={lineInk} strokeWidth={settings.lineWidth} />
      {movedGroups.map((group) => {
        const movedItems = group.items.map((item) => ({ ...item, point: drag.movePoint(item.id, item.base) }));
        const childBusY = group.point.y + groupH / 2 + childBusGap;
        const childBusStart = Math.min(...movedItems.map((item) => item.point.x), group.point.x);
        const childBusEnd = Math.max(...movedItems.map((item) => item.point.x), group.point.x);
        return <g key={`${group.id}-links`}>
          <line x1={group.point.x} y1={rootBusY} x2={group.point.x} y2={group.point.y - groupH / 2} stroke={lineInk} strokeWidth={settings.lineWidth} />
          <line x1={group.point.x} y1={group.point.y + groupH / 2} x2={group.point.x} y2={childBusY} stroke={lineInk} strokeWidth={settings.lineWidth} />
          <line x1={childBusStart} y1={childBusY} x2={childBusEnd} y2={childBusY} stroke={lineInk} strokeWidth={settings.lineWidth} />
          {movedItems.map((item) => <line key={`${item.id}-line`} x1={item.point.x} y1={childBusY} x2={item.point.x} y2={item.point.y - leafH / 2} stroke={lineInk} strokeWidth={settings.lineWidth} />)}
        </g>;
      })}
    </g>}
    <g {...drag.bind("module:root", `${system}根模块`)} filter="url(#soft-shadow)"><rect x={rootCenter.x - rootW / 2} y={rootCenter.y - rootH / 2} width={rootW} height={rootH} rx={2 * borderScale} fill={rootFill} stroke={ink} strokeWidth={settings.lineWidth} /><text x={rootCenter.x} y={rootCenter.y + settings.fontSize * .34} textAnchor="middle" fontSize={settings.fontSize + 1} fontWeight="700" fill={ink}>{system}</text></g>
    {groupLayouts.map((group) => <g key={group.id}>
      <g {...drag.bind(group.id, `${group.name}功能分组`)} filter="url(#soft-shadow)"><rect x={group.base.x - groupW(group.name) / 2} y={group.base.y - groupH / 2} width={groupW(group.name)} height={groupH} rx={2 * borderScale} fill={groupFill} stroke={ink} strokeWidth={settings.lineWidth} /><text x={group.base.x} y={group.base.y + settings.fontSize * .34} textAnchor="middle" fontSize={settings.fontSize} fontWeight="700" fill={ink}>{group.name}</text></g>
      {group.items.map((item) => <g key={item.id} {...drag.bind(item.id, `${item.label}功能模块`)} filter="url(#soft-shadow)"><rect x={item.base.x - leafW / 2} y={item.base.y - leafH / 2} width={leafW} height={leafH} rx={1.5 * borderScale} fill={itemFill} stroke={ink} strokeWidth={settings.lineWidth} />{renderVerticalLabel(item.label, item.base.x, item.base.y)}</g>)}
    </g>)}
    {groups.length === 0 && <text x={width / 2} y="190" textAnchor="middle" fontSize={settings.fontSize} fill="#687b8f">请输入“分组名: 功能1; 功能2”</text>}
  </CanvasFrame>;
}

function ArchitectureDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const layers = dataLines(source).map((line) => {
    const split = line.indexOf(":");
    return { name: split > -1 ? line.slice(0, split).trim() : line, modules: split > -1 ? line.slice(split + 1).split(";").map((item) => item.trim()) : [] };
  });
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const layerW = 756 * borderScale;
  const labelW = Math.max(80, 96 * borderScale);
  const layerH = Math.max(settings.fontSize + 40, 88 * borderScale);
  const moduleH = Math.max(settings.fontSize + 20, 48 * borderScale);
  const moduleInsetY = (layerH - moduleH) / 2;
  const layerGap = 50 * spacing;
  const width = Math.max(840, layerW + 84);
  const layerX = (width - layerW) / 2;
  const height = Math.max(540, layers.length * (layerH + layerGap) + 120);
  const ink = settings.monochrome ? "#000000" : "#26303a";
  return <CanvasFrame title={titleFrom(source, "系统架构图")} settings={settings} width={width} height={height}>
    {layers.slice(0, -1).map((layer, index) => {
      const fromOffset = drag.getOffset(`architecture:${index}`);
      const toOffset = drag.getOffset(`architecture:${index + 1}`);
      const y = 26 + index * (layerH + layerGap);
      const nextY = 26 + (index + 1) * (layerH + layerGap);
      return <line key={`arrow-${layer.name}`} x1={width / 2 + fromOffset.x} y1={y + layerH + fromOffset.y} x2={width / 2 + toOffset.x} y2={nextY + toOffset.y} stroke={ink} strokeWidth={settings.lineWidth} markerEnd="url(#arrow)" />;
    })}
    {layers.map((layer, index) => {
      const y = 26 + index * (layerH + layerGap);
      const colors = settings.monochrome ? ["#ffffff"] : ["#eef2ff", "#fff5d8", "#eaf7f2", "#fff0e7", "#f4ecf8"];
      const moduleGap = 12 * spacing;
      const modulePadding = 20 * spacing;
      const moduleStartX = layerX + labelW + modulePadding;
      const available = Math.max(120, layerW - labelW - modulePadding * 2);
      const moduleW = Math.min(150 * borderScale, (available - Math.max(0, layer.modules.length - 1) * moduleGap) / Math.max(1, layer.modules.length));
      return <g key={layer.name} {...drag.bind(`architecture:${index}`, `${layer.name}架构层`, { verticalSnap: { offsetX: 0, guideX: width / 2, threshold: 14 } })}>
        <rect x={layerX} y={y} width={layerW} height={layerH} rx="5" fill={colors[index % colors.length]} stroke={ink} strokeWidth={settings.lineWidth} />
        <rect x={layerX} y={y} width={labelW} height={layerH} rx="5" fill={settings.monochrome ? "#ffffff" : "#26303a"} stroke={ink} strokeWidth={settings.monochrome ? settings.lineWidth : 0} />
        <text x={layerX + labelW / 2} y={y + layerH / 2 + 5} textAnchor="middle" fontSize={settings.fontSize} fontWeight="700" fill={settings.monochrome ? "#000000" : "#fff"}>{layer.name}</text>
        {layer.modules.map((module, moduleIndex) => {
          const x = moduleStartX + moduleIndex * (moduleW + moduleGap);
          return <g key={module}><rect x={x} y={y + moduleInsetY} width={moduleW} height={moduleH} rx="4" fill="#fff" stroke={settings.monochrome ? "#000000" : "#8c949d"} strokeWidth={settings.lineWidth} /><text x={x + moduleW / 2} y={y + moduleInsetY + moduleH / 2 + 5} textAnchor="middle" fontSize={settings.fontSize - 1} fontWeight="600" fill={ink}>{module}</text></g>;
        })}
      </g>;
    })}
    {drag.verticalGuideX !== null && <g className="vertical-alignment-guide" data-export-ignore="true" pointerEvents="none">
      <line x1={drag.verticalGuideX} y1="8" x2={drag.verticalGuideX} y2={height - 28} />
      <circle cx={drag.verticalGuideX} cy="12" r="3" />
      <circle cx={drag.verticalGuideX} cy={height - 32} r="3" />
    </g>}
  </CanvasFrame>;
}

function ThreeLineTable({ source, settings, showNote = true }: { source: string; settings: DiagramSettings; showNote?: boolean }) {
  const drag = useSvgDragPositions();
  const rows = dataLines(source).map((line) => line.split(/,|\t/).map((cell) => cell.trim()));
  const columns = Math.max(...rows.map((row) => row.length), 1);
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const tableW = 750 * spacing;
  const width = Math.max(860, tableW + 110);
  const left = (width - tableW) / 2;
  const right = left + tableW;
  const cellW = (right - left) / columns;
  const rowH = Math.max(settings.fontSize + 18, 46 * spacing);
  const height = Math.max(440, rows.length * rowH + (showNote ? 150 : 105));
  const y = 32;
  const ink = settings.monochrome ? "#000000" : "#1e252c";
  const outerLineWidth = Math.max(1.5, settings.lineWidth * 1.5);
  const headerLineWidth = Math.max(.75, settings.lineWidth * .6);
  return <CanvasFrame title={titleFrom(source, "论文三线表")} settings={settings} width={width} height={height}>
    <line x1={left} y1={y} x2={right} y2={y} stroke={ink} strokeWidth={outerLineWidth} />
    <rect x={left} y={y} width={right - left} height={rowH} fill={settings.monochrome ? "#ffffff" : "#f4f6fa"} />
    <line x1={left} y1={y + rowH} x2={right} y2={y + rowH} stroke={ink} strokeWidth={headerLineWidth} />
    {rows.map((row, rowIndex) => <g key={rowIndex} {...drag.bind(`table-row:${rowIndex}`, `表格第${rowIndex + 1}行`)}>{row.map((cell, columnIndex) => <text key={`${rowIndex}-${columnIndex}`} x={left + columnIndex * cellW + cellW / 2} y={y + rowIndex * rowH + rowH / 2 + 6} textAnchor="middle" fontSize={settings.fontSize} fontWeight={rowIndex === 0 ? "700" : "400"} fill={ink}>{cell}</text>)}</g>)}
    <line x1={left} y1={y + rows.length * rowH} x2={right} y2={y + rows.length * rowH} stroke={ink} strokeWidth={outerLineWidth} />
    {showNote && <g {...drag.bind("table-note", "表格注释")}><text x={left} y={y + rows.length * rowH + 36} fontSize={settings.fontSize - 2} fill="#69727c">注：— 表示不限制长度；数据来源为系统数据库设计。</text></g>}
  </CanvasFrame>;
}

function DataChart({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const rows = dataLines(source).map((line) => line.split(/,|\t/).map((cell) => cell.trim()));
  const headers = rows[0] || [];
  const values = rows.slice(1);
  const series = headers.slice(1);
  const maxValue = Math.max(1, ...values.flatMap((row) => row.slice(1).map((value) => Number(value) || 0)));
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const chartW = 700 * spacing;
  const chartH = 360 * spacing;
  const width = Math.max(860, chartW + 160);
  const top = 45;
  const left = (width - chartW) / 2;
  const labelOffsetY = 27 * spacing;
  const legendOffsetY = 70 * spacing;
  const axisTitleOffsetY = 112 * spacing;
  const legendStep = 128 * spacing;
  const height = Math.max(570, top + chartH + axisTitleOffsetY + 60);
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const colors = settings.monochrome ? ["url(#bw-black)", "url(#bw-hatch)", "url(#bw-dots)", "url(#bw-cross)"] : PALETTE;
  const linePatterns = [undefined, "10 5", "2 4", "12 4 2 4"];
  const xStep = chartW / Math.max(1, values.length);
  return <CanvasFrame title={titleFrom(source, "实验数据图")} settings={settings} width={width} height={height}>
    {[0, 1, 2, 3, 4, 5].map((tick) => {
      const y = top + chartH - (tick / 5) * chartH;
      return <g key={tick}><line x1={left} y1={y} x2={left + chartW} y2={y} stroke="#d9dde2" strokeWidth="1" /><text x={left - 13} y={y + 4} textAnchor="end" fontSize={settings.fontSize - 2} fill="#66717b">{Math.round((tick / 5) * maxValue)}</text></g>;
    })}
    <line x1={left} y1={top} x2={left} y2={top + chartH} stroke={ink} strokeWidth={settings.lineWidth} />
    <line x1={left} y1={top + chartH} x2={left + chartW} y2={top + chartH} stroke={ink} strokeWidth={settings.lineWidth} />
    {settings.chartType === "bar" && values.flatMap((row, rowIndex) => series.map((_, seriesIndex) => {
      const value = Number(row[seriesIndex + 1]) || 0;
      const groupW = xStep * 0.68;
      const barW = groupW / Math.max(1, series.length);
      const x = left + rowIndex * xStep + (xStep - groupW) / 2 + seriesIndex * barW;
      const barH = (value / maxValue) * chartH;
      return <g key={`${rowIndex}-${seriesIndex}`} {...drag.bind(`chart-bar:${rowIndex}:${seriesIndex}`, `${row[0]}的${series[seriesIndex]}柱形`)}><rect data-bw-preserve={settings.monochrome ? "true" : undefined} x={x} y={top + chartH - barH} width={Math.max(6, barW - 3)} height={barH} fill={colors[seriesIndex % colors.length]} stroke={settings.monochrome ? "#000" : "none"} strokeWidth={settings.monochrome ? 1.5 : 0} rx="2" /></g>;
    }))}
    {settings.chartType === "line" && series.map((_, seriesIndex) => {
      const points = values.map((row, rowIndex) => `${left + rowIndex * xStep + xStep / 2},${top + chartH - ((Number(row[seriesIndex + 1]) || 0) / maxValue) * chartH}`).join(" ");
      const seriesColor = settings.monochrome ? "#000" : colors[seriesIndex % colors.length];
      return <g key={seriesIndex} {...drag.bind(`chart-line:${seriesIndex}`, `${series[seriesIndex]}折线`)}><polyline points={points} fill="none" stroke={seriesColor} strokeDasharray={settings.monochrome ? linePatterns[seriesIndex % linePatterns.length] : undefined} strokeWidth={settings.lineWidth + 1} /><>{values.map((row, rowIndex) => <circle key={rowIndex} cx={left + rowIndex * xStep + xStep / 2} cy={top + chartH - ((Number(row[seriesIndex + 1]) || 0) / maxValue) * chartH} r="4" fill="#fff" stroke={seriesColor} strokeWidth="3" />)}</></g>;
    })}
    {values.map((row, index) => <g key={row[0]} {...drag.bind(`chart-label:${index}`, `${row[0]}横轴标签`)}><text x={left + index * xStep + xStep / 2} y={top + chartH + labelOffsetY} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#56616c">{row[0]}</text></g>)}
    {series.map((item, index) => <g key={item} {...drag.bind(`chart-legend:${index}`, `${item}图例`)}><g transform={`translate(${left + index * legendStep} ${top + chartH + legendOffsetY})`}>{settings.chartType === "bar" ? <rect data-bw-preserve={settings.monochrome ? "true" : undefined} width="18" height="10" rx="2" fill={colors[index % colors.length]} stroke={settings.monochrome ? "#000" : "none"} /> : <line x1="0" y1="5" x2="20" y2="5" stroke={settings.monochrome ? "#000" : colors[index % colors.length]} strokeDasharray={settings.monochrome ? linePatterns[index % linePatterns.length] : undefined} strokeWidth="3" />}<text x="27" y="10" fontSize={settings.fontSize - 1} fill={ink}>{item}</text></g></g>)}
    <g {...drag.bind("chart-axis-title", "横轴标题")}><text x={left + chartW / 2} y={top + chartH + axisTitleOffsetY} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#6a737d">{headers[0]}</text></g>
  </CanvasFrame>;
}

function PendingDiagram({ source, settings, name, description }: { source: string; settings: DiagramSettings; name: string; description: string }) {
  const sourceMessage = dataLines(source)[0]?.replace(/^待完善[：:]?\s*/, "") || description;
  const ink = settings.monochrome ? "#000000" : "#244d73";
  const border = settings.monochrome ? "#000000" : "#9fc6e8";
  const fill = settings.monochrome ? "#ffffff" : "#f5faff";
  return <CanvasFrame title={titleFrom(source, name)} settings={settings} width={860} height={500}>
    <rect x="110" y="54" width="640" height="320" rx="18" fill={fill} stroke={border} strokeWidth={settings.lineWidth} strokeDasharray="9 7" />
    <rect x="350" y="92" width="160" height="40" rx="20" fill={settings.monochrome ? "#ffffff" : "#e5f2ff"} stroke={border} strokeWidth={settings.lineWidth} />
    <text x="430" y="118" textAnchor="middle" fontSize={settings.fontSize} fontWeight="700" fill={ink}>功能待完善</text>
    <text x="430" y="190" textAnchor="middle" fontSize={settings.fontSize + 7} fontWeight="700" fill={ink}>{name}</text>
    <text x="430" y="235" textAnchor="middle" fontSize={settings.fontSize} fill={ink}>{sourceMessage}</text>
    <line x1="275" y1="280" x2="585" y2="280" stroke={border} strokeWidth={Math.max(1, settings.lineWidth * .65)} />
    <text x="430" y="322" textAnchor="middle" fontSize={Math.max(10, settings.fontSize - 2)} fill={settings.monochrome ? "#000000" : "#6f8ba5"}>已加入图研功能规划 · 后续版本开放编辑与导出</text>
  </CanvasFrame>;
}

function Diagram({ tool, source, settings }: { tool: ToolId; source: string; settings: DiagramSettings }) {
  const outputSettings = settings.monochrome
    ? { ...settings, lineWidth: Math.max(2, settings.lineWidth) }
    : settings;
  if (tool === "class") return <ClassDiagram source={source} settings={outputSettings} />;
  if (tool === "er") return <ERDiagram source={source} settings={outputSettings} />;
  if (tool === "flow") return <FlowDiagram source={source} settings={outputSettings} />;
  if (tool === "sequence") return <SequenceDiagram source={source} settings={outputSettings} />;
  if (tool === "usecase") return <UseCaseDiagram source={source} settings={outputSettings} />;
  if (tool === "module") return <FunctionModuleDiagram source={source} settings={outputSettings} />;
  if (tool === "architecture") return <ArchitectureDiagram source={source} settings={outputSettings} />;
  if (tool === "environment") return <ThreeLineTable source={source} settings={outputSettings} showNote={false} />;
  if (tool === "table") return <ThreeLineTable source={source} settings={outputSettings} />;
  if (tool === "dataflow") return <PendingDiagram source={source} settings={outputSettings} name="系统数据流图" description="外部实体、处理过程、数据存储和数据流关系" />;
  if (tool === "deployment") return <PendingDiagram source={source} settings={outputSettings} name="UML 部署图" description="服务器节点、运行环境、组件和网络连接关系" />;
  if (tool === "screenshot") return <PendingDiagram source={source} settings={outputSettings} name="核心功能运行截图" description="界面截图上传、裁剪、统一尺寸、编号和图题排版" />;
  if (tool === "testcase") return <PendingDiagram source={source} settings={outputSettings} name="软件测试用例表" description="测试步骤、输入数据、预期结果和实际结果" />;
  return <DataChart source={source} settings={outputSettings} />;
}

function HomePage({ onOpenTool }: { onOpenTool: (tool: ToolId) => void }) {
  return (
    <section className="home-page" aria-label="图研首页">
      <div className="home-hero">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><span />THESIS FIGURE LAB · LOCAL FIRST</div>
          <h1>把论文里的复杂关系，<em>画得一目了然。</em></h1>
          <p>图研是一间为计算机专业毕业生准备的本地图表工作室。把结构化文本变成规范、清晰、可编辑的论文图表，从构思到插入正文，只需要几分钟。</p>
          <div className="home-actions">
            <button className="home-primary-action" onClick={() => onOpenTool("er")}>开始绘制 ER 图<span>→</span></button>
            <span className="home-local-note"><i />无需登录 · 数据不上传 · 自动保存在本机</span>
          </div>
          <div className="home-metrics" aria-label="产品特点">
            <div><strong>14</strong><span>类论文图表</span></div>
            <div><strong>4×</strong><span>黑白高清导出</span></div>
            <div><strong>0</strong><span>云端数据上传</span></div>
          </div>
        </div>

        <div className="home-visual" aria-label="图研把论文结构转换为清晰图表的示意图">
          <div className="home-visual-grid" />
          <span className="home-visual-caption">论文图表 · 实时生成</span>
          <i className="visual-link link-a" /><i className="visual-link link-b" /><i className="visual-link link-c" /><i className="visual-link link-d" />
          <div className="visual-node node-center"><span>图</span><strong>图研工作台</strong><small>结构化文本 → 论文插图</small></div>
          <div className="visual-node node-a"><b>ER</b><span>实体关系</span></div>
          <div className="visual-node node-b"><b>UML</b><span>系统设计</span></div>
          <div className="visual-node node-c"><b>DATA</b><span>实验数据</span></div>
          <div className="visual-node node-d"><b>TABLE</b><span>规范三线表</span></div>
          <div className="home-paper-note"><span>✓</span><div><strong>论文友好</strong><small>白底黑字 · 清晰线条 · 无水印</small></div></div>
        </div>
      </div>

      <section className="home-tools-section">
        <div className="home-section-heading">
          <div><span>TOOLKIT</span><h2>从数据库设计到实验结果，一站画完</h2></div>
          <p>选择一种图表进入独立工作台，每张图都拥有自己的文本、画布和样式参数。</p>
        </div>
        <div className="home-tool-grid">
          {TOOLS.map((item, index) => (
            <button key={item.id} className="home-tool-card" onClick={() => onOpenTool(item.id)}>
              <span className="home-tool-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="home-tool-symbol">{item.symbol}</span>
              <span className="home-tool-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
              <span className="home-tool-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-roadmap" aria-labelledby="thesis-roadmap-title">
        <div className="home-section-heading">
          <div><span>THESIS ROADMAP</span><h2 id="thesis-roadmap-title">软件开发类本科论文图表推荐顺序</h2></div>
          <p>按照“需求分析—总体设计—详细设计—系统实现—系统测试”的论文叙事逐步展开，点击任一图表即可进入对应工作台。</p>
        </div>
        <div className="thesis-roadmap-grid">
          {THESIS_ROADMAP.map((chapter) => (
            <article key={chapter.chapter} className="thesis-chapter-card">
              <div className="thesis-chapter-head"><span>{chapter.chapter}</span><strong>{chapter.title}</strong></div>
              <p>{chapter.note}</p>
              <div className="thesis-tool-sequence">
                {chapter.tools.map((item, index) => <span key={item.id} className="thesis-tool-step">
                  <button onClick={() => onOpenTool(item.id)}><b>{String(item.order).padStart(2, "0")}</b><span>{item.label}</span>{(["dataflow", "deployment", "screenshot", "testcase"] as ToolId[]).includes(item.id) && <em>待完善</em>}</button>
                  {index < chapter.tools.length - 1 && <i>→</i>}
                </span>)}
              </div>
            </article>
          ))}
        </div>
        <div className="thesis-roadmap-note"><strong>使用说明</strong><span>此顺序适合大多数计算机科学与技术专业的软件开发类毕业论文；实际章节名称和图表取舍请优先遵循学校模板与导师要求。</span></div>
      </section>

      <section className="home-workflow">
        <div className="home-section-heading compact">
          <div><span>WORKFLOW</span><h2>三步得到可直接使用的论文图</h2></div>
        </div>
        <div className="workflow-grid">
          <article><span>01</span><strong>输入结构</strong><p>用接近论文提纲的自然格式描述实体、流程、类或实验数据。</p></article>
          <article><span>02</span><strong>拖动与调整</strong><p>实时预览，自由移动元素，并独立调整间距、字号和图框尺寸。</p></article>
          <article><span>03</span><strong>插入论文</strong><p>导出高清 PNG 或可编辑 SVG，白底黑字，适配 Word 与排版软件。</p></article>
        </div>
      </section>

      <section className="home-contact" aria-label="联系作者">
        <div className="home-contact-symbol">@</div>
        <div className="home-contact-copy">
          <span>CONTACT · FEEDBACK</span>
          <h2>发现 Bug，或者有更好的图表想法？</h2>
          <p>欢迎反馈显示异常、导出问题、格式建议和新功能需求。邮件中如能附上图表类型、问题描述与截图，会更容易快速定位。</p>
        </div>
        <a className="home-contact-email" href="mailto:3091948830@qq.com?subject=%E5%9B%BE%E7%A0%94%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88">
          <span>联系作者</span><strong>3091948830@qq.com</strong><i>发送邮件 →</i>
        </a>
      </section>

      <div className="home-footer-note"><span className="brand-mark mini"><span>图</span><i /></span><div><strong>图研</strong><small>让技术表达有结构，也有分寸。</small></div></div>
    </section>
  );
}

export default function Home() {
  const [homeOpen, setHomeOpen] = useState(true);
  const [tool, setTool] = useState<ToolId>("er");
  const [sources, setSources] = useState<Record<ToolId, string>>(SAMPLES);
  const [settingsByTool, setSettingsByTool] = useState<Record<ToolId, DiagramSettings>>(createDefaultSettingsByTool);
  const [toast, setToast] = useState("");
  const [zen, setZen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [inlineTextEdit, setInlineTextEdit] = useState<InlineTextEdit | null>(null);
  const inlineTextInputRef = useRef<HTMLInputElement | null>(null);
  const splitterDragRef = useRef<{ pointerId: number; startX: number; startWidth: number; maxWidth: number } | null>(null);
  const settings = settingsByTool[tool];
  const setSettings = (next: DiagramSettings | ((current: DiagramSettings) => DiagramSettings)) => {
    setSettingsByTool((currentByTool) => {
      const current = currentByTool[tool];
      const updated = typeof next === "function" ? next(current) : next;
      return { ...currentByTool, [tool]: updated };
    });
  };
  const activeTool = TOOLS.find((item) => item.id === tool)!;
  const source = sources[tool];
  const erInputSummary = useMemo(() => tool === "er" ? parseErInput(source) : null, [tool, source]);
  const erSqlMode = erInputSummary?.sqlMode || false;
  const title = titleFrom(source, activeTool.name);
  const lineTotal = erInputSummary ? erInputSummary.entities.length : dataLines(source).length;
  const savedKey = "thesis-figure-lab-v1";
  const settingsVersion = 4;
  const fontMin = 8;
  const fontMax = 96;
  const lineMin = settings.monochrome ? 2 : 0.5;
  const lineMax = 20;
  const borderScaleMin = 40;
  const borderScaleMax = 260;
  const overallScaleMin = 20;
  const overallScaleMax = 250;
  const spacingScaleMin = 30;
  const spacingScaleMax = 300;

  const updateFontSize = (value: number) => {
    if (!Number.isFinite(value)) return;
    setSettings((current) => ({ ...current, fontSize: Math.min(fontMax, Math.max(fontMin, Math.round(value))) }));
  };

  const updateLineWidth = (value: number) => {
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value * 2) / 2;
    setSettings((current) => ({ ...current, lineWidth: Math.min(lineMax, Math.max(current.monochrome ? 2 : 0.5, rounded)) }));
  };

  const updateBorderScale = (value: number) => {
    if (!Number.isFinite(value)) return;
    const nextScale = Math.min(borderScaleMax, Math.max(borderScaleMin, Math.round(value / 5) * 5));
    setSettings((current) => ({ ...current, borderScale: nextScale }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
    }));
  };

  const updateOverallScale = (value: number) => {
    if (!Number.isFinite(value)) return;
    const nextScale = Math.min(overallScaleMax, Math.max(overallScaleMin, Math.round(value / 5) * 5));
    setSettings((current) => ({ ...current, overallScale: nextScale }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
    }));
  };

  const updateSpacingScale = (value: number) => {
    if (!Number.isFinite(value)) return;
    const nextScale = Math.min(spacingScaleMax, Math.max(spacingScaleMin, Math.round(value / 5) * 5));
    setSettings((current) => ({ ...current, spacingScale: nextScale }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
    }));
  };

  const resetStyleSettings = () => {
    setSettings(defaultSettingsForTool(tool));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
    }));
  };

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editorCollapsed || event.button !== 0) return;
    const grid = event.currentTarget.parentElement;
    const editor = event.currentTarget.previousElementSibling as HTMLElement | null;
    if (!grid || !editor) return;
    const maxWidth = Math.max(300, grid.clientWidth - 720);
    splitterDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: editor.getBoundingClientRect().width, maxWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("is-resizing");
    event.preventDefault();
  };

  const resizePanels = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = splitterDragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setEditorWidth(Math.min(active.maxWidth, Math.max(240, active.startWidth + event.clientX - active.startX)));
  };

  const stopPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!splitterDragRef.current) return;
    splitterDragRef.current = null;
    event.currentTarget.classList.remove("is-resizing");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (!saved) {
      setHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed.sources) setSources({ ...SAMPLES, ...parsed.sources });
      if (parsed.settingsByTool) {
        setSettingsByTool((current) => Object.fromEntries(TOOLS.map(({ id }) => {
          const savedSettings = parsed.settingsByTool[id] || {};
          const merged = { ...current[id], ...savedSettings };
          if ((parsed.version || 0) < 4 && id === "architecture" && (savedSettings.spacingScale === undefined || savedSettings.spacingScale === 100)) {
            merged.spacingScale = 115;
          }
          return [id, merged];
        })) as Record<ToolId, DiagramSettings>);
      } else if (parsed.settings) {
        const legacy = { ...DEFAULT_DIAGRAM_SETTINGS, ...parsed.settings } as DiagramSettings;
        const migrated = parsed.version === 2
          ? legacy
          : { ...legacy, monochrome: true, fontSize: Math.max(14, legacy.fontSize), lineWidth: Math.max(2, legacy.lineWidth) };
        setSettingsByTool(Object.fromEntries(TOOLS.map(({ id }) => [
          id,
          id === "architecture" ? { ...migrated, spacingScale: 115 } : { ...migrated },
        ])) as Record<ToolId, DiagramSettings>);
      }
      if (parsed.layout) {
        if (typeof parsed.layout.editorWidth === "number") setEditorWidth(parsed.layout.editorWidth);
        if (typeof parsed.layout.editorCollapsed === "boolean") setEditorCollapsed(parsed.layout.editorCollapsed);
      }
    } catch {
      localStorage.removeItem(savedKey);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(savedKey, JSON.stringify({ version: settingsVersion, sources, settingsByTool, layout: { editorWidth, editorCollapsed } }));
  }, [hydrated, sources, settingsByTool, editorWidth, editorCollapsed]);

  useEffect(() => {
    if (!inlineTextEdit) return;
    window.requestAnimationFrame(() => {
      inlineTextInputRef.current?.focus();
      inlineTextInputRef.current?.select();
    });
  }, [inlineTextEdit?.original]);

  const previewCaption = useMemo(() => {
    const nouns: Record<ToolId, string> = { class: "类定义与关系", er: "实体与联系", flow: "流程节点", dataflow: "数据流元素", sequence: "交互步骤", usecase: "参与角色与用例", module: "功能模块", architecture: "系统分层", deployment: "部署节点", environment: "环境配置项", screenshot: "功能界面", testcase: "测试用例", table: "表格行", chart: "数据记录" };
    return `${lineTotal} 条${nouns[tool]} · 实时生成 · 双击文字可修改`;
  }, [lineTotal, tool]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const startInlineTextEdit = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest("text") : null;
    if (!target || !target.closest("#diagram-canvas")) return;
    const visibleText = (target.textContent || "").trim();
    if (!visibleText) return;
    event.preventDefault();
    event.stopPropagation();

    let original = visibleText;
    if (!source.includes(original)) {
      const withoutSequenceNumber = original.replace(/^\d+\.\s*/, "");
      if (source.includes(withoutSequenceNumber)) original = withoutSequenceNumber;
    }

    const isTitle = target.hasAttribute("data-canvas-title");
    const dragId = target.closest<SVGGElement>("[data-drag-id]")?.dataset.dragId || "";
    const resolved: Pick<InlineTextEdit, "scope" | "sourceLine"> = isTitle ? { scope: "title" } : resolveTextEdit(tool, source, dragId, original);
    if (resolved.scope === "line" && (!resolved.sourceLine || !resolved.sourceLine.includes(original))) return;
    if (resolved.scope === "all" && !source.includes(original)) return;

    const wrap = event.currentTarget;
    const wrapRect = wrap.getBoundingClientRect();
    const rawX = event.clientX - wrapRect.left + wrap.scrollLeft;
    const rawY = event.clientY - wrapRect.top + wrap.scrollTop;
    const x = Math.min(wrap.scrollLeft + wrap.clientWidth - 130, Math.max(wrap.scrollLeft + 130, rawX));
    const y = Math.max(wrap.scrollTop + 12, rawY);
    setInlineTextEdit({ original, value: original, sourceLine: resolved.sourceLine, scope: resolved.scope, x, y });
  };

  const commitInlineTextEdit = () => {
    if (!inlineTextEdit) return;
    const replacement = inlineTextEdit.value.trim();
    if (!replacement || replacement === inlineTextEdit.original) {
      setInlineTextEdit(null);
      return;
    }
    setSources((current) => {
      const currentSource = current[tool];
      let updatedSource = currentSource;
      if (inlineTextEdit.scope === "title") {
        updatedSource = /^\s*@title\s+.*$/m.test(currentSource)
          ? currentSource.replace(/^\s*@title\s+.*$/m, `@title ${replacement}`)
          : `@title ${replacement}\n${currentSource}`;
      } else if (inlineTextEdit.scope === "all") {
        updatedSource = replaceIdentifier(currentSource, inlineTextEdit.original, replacement);
      } else if (inlineTextEdit.sourceLine) {
        const updatedLine = inlineTextEdit.sourceLine.replace(inlineTextEdit.original, replacement);
        updatedSource = currentSource.includes(inlineTextEdit.sourceLine)
          ? currentSource.replace(inlineTextEdit.sourceLine, updatedLine)
          : currentSource.replace(inlineTextEdit.original, replacement);
      }
      return { ...current, [tool]: updatedSource };
    });
    setInlineTextEdit(null);
    notify("图中文字已更新");
  };

  const changeCanvasZoom = (nextZoom: number) => {
    if (!Number.isFinite(nextZoom)) return;
    setCanvasZoom(Math.min(200, Math.max(35, Math.round(nextZoom / 5) * 5)));
  };

  const fitCanvasToViewport = (message: string) => {
    const wrap = document.getElementById("preview-canvas-wrap");
    const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
    if (!wrap || !svg) return;
    const viewBox = svg.viewBox.baseVal;
    if (!viewBox.width || !viewBox.height) return;
    const expanded = document.querySelector(".app-shell")?.classList.contains("is-zen") || false;
    const availableWidth = Math.max(1, Math.min(wrap.clientWidth - 48, expanded ? 1150 : 920));
    const availableHeight = Math.max(1, wrap.clientHeight - 52);
    const heightAtFullWidth = availableWidth * (viewBox.height / viewBox.width);
    const fittedZoom = Math.floor(Math.min(1, availableHeight / heightAtFullWidth) * 100 / 5) * 5;
    changeCanvasZoom(Math.max(35, fittedZoom));
    notify(message);
  };

  const fitCanvas = () => fitCanvasToViewport("已适应全部内容");

  const autoLayout = () => {
    setInlineTextEdit(null);
    setLayoutVersion((version) => version + 1);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
      fitCanvasToViewport("已按当前参数自动排版");
    }));
  };

  const toggleCanvasExpansion = () => {
    const expanding = !zen;
    setZen(expanding);
    if (expanding) setCanvasZoom(100);
    notify(expanding ? "画布已按 100% 展开" : "已退出展开画布");
  };

  const getSvgText = (scale = 1) => {
    const element = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
    if (!element) return "";
    const copy = element.cloneNode(true) as SVGSVGElement;
    copy.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const viewBox = (copy.getAttribute("viewBox") || "0 0 1200 800").split(/\s+/);
    copy.setAttribute("width", String(Math.round(Number(viewBox[2]) * scale)));
    copy.setAttribute("height", String(Math.round(Number(viewBox[3]) * scale)));
    if (settings.monochrome) {
      copy.setAttribute("style", "background:#fff;color:#000");
      copy.querySelectorAll("text").forEach((node) => {
        node.setAttribute("fill", "#000000");
        node.setAttribute("font-family", "Microsoft YaHei, PingFang SC, Arial, sans-serif");
      });
      copy.querySelectorAll("[stroke]").forEach((node) => {
        if (node.tagName.toLowerCase() === "text") node.setAttribute("stroke", "#ffffff");
        else if (node.getAttribute("stroke") !== "none") node.setAttribute("stroke", "#000000");
      });
      copy.querySelectorAll("rect, circle, ellipse, path, polygon").forEach((node) => {
        if (node.closest("defs") || node.hasAttribute("data-bw-preserve")) return;
        const fill = node.getAttribute("fill");
        if (fill && fill !== "none") node.setAttribute("fill", "#ffffff");
      });
      copy.querySelector("#arrow path")?.setAttribute("fill", "#000000");
      copy.querySelector("#open-arrow path")?.setAttribute("fill", "#ffffff");
    }
    return new XMLSerializer().serializeToString(copy);
  };

  const exportSvg = () => {
    downloadFile(getSvgText(), `${safeName(title)}.svg`, "image/svg+xml;charset=utf-8");
    notify("SVG 已导出");
  };

  const exportPng = () => {
    const exportScale = settings.monochrome ? 4 : 3;
    const svgText = getSvgText(exportScale);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (png) downloadFile(png, `${safeName(title)}@${exportScale}x.png`, "image/png");
        URL.revokeObjectURL(url);
        notify("高清 PNG 已导出");
      }, "image/png");
    };
    image.src = url;
  };

  const exportSource = () => {
    downloadFile(source, `${safeName(title)}.${erSqlMode ? "sql" : "txt"}`, "text/plain;charset=utf-8");
    notify("源文件已保存");
  };

  const copyTableToWord = async () => {
    if (tool !== "table" && tool !== "environment") return;
    const tableRows = dataLines(source).map((line) => line.split(/,|\t/).map((cell) => cell.trim()));
    if (!tableRows.length) {
      notify("暂无可复制的表格内容");
      return;
    }
    const [headers, ...bodyRows] = tableRows;
    const fontStyle = "font-family:'Times New Roman','SimSun',serif;mso-fareast-font-family:'SimSun';mso-ascii-font-family:'Times New Roman';mso-hansi-font-family:'Times New Roman';font-size:10.5pt;";
    const cellStyle = `${fontStyle}padding:4pt 8pt;border-left:none;border-right:none;text-align:center;vertical-align:middle;line-height:1.5;`;
    const headerBottomWidth = bodyRows.length ? ".75pt" : "1.5pt";
    const headerHtml = headers.map((cell) => `<th style="${cellStyle}font-weight:normal;border-top:1.5pt solid #000;border-bottom:${headerBottomWidth} solid #000;mso-border-top-alt:solid windowtext 1.5pt;mso-border-bottom-alt:solid windowtext ${headerBottomWidth};">${escapeHtml(cell)}</th>`).join("");
    const bodyHtml = bodyRows.map((row, rowIndex) => {
      const bottomBorder = rowIndex === bodyRows.length - 1 ? "border-bottom:1.5pt solid #000;mso-border-bottom-alt:solid windowtext 1.5pt;" : "border-top:none;border-bottom:none;";
      return `<tr>${headers.map((_, index) => `<td style="${cellStyle}${bottomBorder}">${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`;
    }).join("");
    const copiedTitle = settings.showTitle ? `<p align="center" style="${fontStyle}margin:0 0 6pt;text-align:center;">${escapeHtml(title)}</p>` : "";
    const html = `<html><head><meta charset="utf-8"></head><body><!--StartFragment--><div style="width:100%;text-align:center;">${copiedTitle}<table align="center" cellspacing="0" cellpadding="0" style="${fontStyle}width:85%;margin-left:auto;margin-right:auto;border-collapse:collapse;border-spacing:0;border-left:none;border-right:none;border-top:1.5pt solid #000;border-bottom:1.5pt solid #000;mso-table-lspace:0pt;mso-table-rspace:0pt;text-align:center;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div><!--EndFragment--></body></html>`;
    const plainText = [...(settings.showTitle ? [title] : []), ...tableRows.map((row) => row.join("\t"))].join("\n");
    try {
      await copyRichText(html, plainText);
      notify("已复制，可直接粘贴到 Word");
    } catch {
      notify("复制失败，请重新操作");
    }
  };

  const openTool = (nextTool: ToolId) => {
    setTool(nextTool);
    setHomeOpen(false);
    setZen(false);
    setInlineTextEdit(null);
  };

  const openHome = () => {
    setHomeOpen(true);
    setZen(false);
    setInlineTextEdit(null);
  };

  return (
    <main className={`app-shell ${zen ? "is-zen" : ""} ${editorCollapsed ? "is-editor-collapsed" : ""}`} style={editorWidth ? { "--editor-width": `${editorWidth}px` } as CSSProperties : undefined}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span>图</span><i /></div>
          <div><strong>图研</strong><small>THESIS FIGURE LAB</small></div>
        </div>
        <div className="project-title">
          <span className="document-dot" />
          <div><strong>{homeOpen ? "计算机专业论文图表工作台" : title}</strong><small>{homeOpen ? "本地运行 · 隐私优先 · 为论文而生" : "已自动保存到本机"}</small></div>
        </div>
        <div className="top-actions">
          {homeOpen ? <button className="export-button" onClick={() => openTool("er")}>进入工作台</button> : <>
            <button className="quiet-button" onClick={exportSource}>保存源文件</button>
            {(tool === "table" || tool === "environment") && <button className="svg-export-button" onClick={copyTableToWord}>复制到 Word</button>}
            <button className="svg-export-button" onClick={exportSvg}>导出 SVG</button>
            <button className="export-button" onClick={exportPng}><span>↓</span> 导出高清 PNG</button>
          </>}
        </div>
      </header>

      <aside className="tool-sidebar" aria-label="论文图表工具">
        <nav>
          <button className={`tool-item ${homeOpen ? "active" : ""}`} onClick={openHome} aria-current={homeOpen ? "page" : undefined}>
            <span className="tool-label">首页</span>
          </button>
          {TOOLS.map((item) => (
            <button key={item.id} className={`tool-item ${!homeOpen && tool === item.id ? "active" : ""}`} onClick={() => openTool(item.id)} aria-current={!homeOpen && tool === item.id ? "page" : undefined}>
              <span className="tool-label">{item.short}</span>
            </button>
          ))}
        </nav>
      </aside>

      {homeOpen ? <HomePage onOpenTool={openTool} /> : <section className="workspace">
        <div className="studio-grid">
          <section className="editor-panel panel">
            <div className="panel-head">
              <div><span className="panel-kicker">SOURCE</span><strong>图表文本</strong></div>
              <div className="editor-head-actions">
                {tool === "er" && <button className="mini-button sql-sample-button" onClick={() => { setSources((current) => ({ ...current, er: ER_SQL_SAMPLE })); notify("已载入 SQL 示例"); }}>SQL 示例</button>}
                <button className="mini-button" onClick={() => { setSources((current) => ({ ...current, [tool]: SAMPLES[tool] })); notify("示例已恢复"); }}>恢复示例</button>
              </div>
            </div>
            <div className="syntax-tip"><span>i</span><p>{activeTool.hint}</p>{tool === "er" && <b className={erSqlMode ? "is-sql" : ""}>{erSqlMode ? "SQL 自动识别" : "简洁文本"}</b>}</div>
            <textarea
              value={source}
              onChange={(event) => setSources((current) => ({ ...current, [tool]: event.target.value }))}
              spellCheck={false}
              placeholder={tool === "er" ? "可直接粘贴 MySQL CREATE TABLE 建表语句" : undefined}
              aria-label={`${activeTool.name}文本编辑器`}
            />
            <div className="editor-foot"><span><i className="ok-dot" />{erSqlMode ? (erInputSummary?.entities.length ? `SQL 已解析 ${erInputSummary.entities.length} 个实体` : "等待完整 SQL 结构") : "语法可解析"}</span><span>{source.length} 字符</span></div>
          </section>

          <div className="workspace-splitter" role="separator" aria-label="调整文本区与预览区宽度" aria-orientation="vertical" tabIndex={0} onPointerDown={startPanelResize} onPointerMove={resizePanels} onPointerUp={stopPanelResize} onPointerCancel={stopPanelResize} onDoubleClick={() => { setEditorWidth(null); setEditorCollapsed(false); }} onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); setEditorWidth((width) => Math.max(240, (width || 380) - 20)); }
            if (event.key === "ArrowRight") { event.preventDefault(); setEditorWidth((width) => Math.min(680, (width || 380) + 20)); }
          }}>
            <span className="splitter-line" />
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setEditorCollapsed((collapsed) => !collapsed)} title={editorCollapsed ? "展开文本编辑区" : "收起文本编辑区"} aria-label={editorCollapsed ? "展开文本编辑区" : "收起文本编辑区"}>{editorCollapsed ? "›" : "‹"}</button>
            <span className="splitter-grip">•••</span>
          </div>

          <section className="preview-panel panel">
            <div className="panel-head preview-head">
              <div><span className="panel-kicker">PREVIEW</span><strong>论文效果预览</strong><small>{previewCaption}</small></div>
              <div className="preview-mode-controls" aria-label="预览显示模式">
                <div className="preview-mode-item"><span>显示图题</span><button className={`switch ${settings.showTitle ? "on" : ""}`} onClick={() => setSettings({ ...settings, showTitle: !settings.showTitle })} aria-label="显示图题"><span /></button></div>
                {tool === "er" && <div className="preview-mode-item"><span>显示主键</span><button className={`switch ${settings.showPrimaryKeys ? "on" : ""}`} onClick={() => setSettings({ ...settings, showPrimaryKeys: !settings.showPrimaryKeys })} aria-label="显示主键"><span /></button></div>}
                <div className="preview-mode-item"><span>彩色模式</span><button className={`switch ${!settings.monochrome ? "on" : ""}`} onClick={() => setSettings({ ...settings, monochrome: !settings.monochrome, lineWidth: !settings.monochrome ? Math.max(2, settings.lineWidth) : settings.lineWidth })} aria-label="彩色模式"><span /></button></div>
              </div>
              <div className="preview-actions">
                <button className="canvas-control icon-button" title="缩小画布" aria-label="缩小画布" onClick={() => changeCanvasZoom(canvasZoom - 10)}>−</button>
                <label className="zoom-readout"><input type="number" min="35" max="200" step="5" value={canvasZoom} onFocus={(event) => event.currentTarget.select()} onChange={(event) => changeCanvasZoom(event.currentTarget.valueAsNumber)} aria-label="手动输入预览缩放比例" /><span>%</span></label>
                <button className="canvas-control icon-button" title="放大画布" aria-label="放大画布" onClick={() => changeCanvasZoom(canvasZoom + 10)}>＋</button>
                <button className="canvas-text-button" onClick={autoLayout}>自动排版</button>
                <button className="canvas-text-button" onClick={fitCanvas}>适应全部</button>
                <button className="canvas-expand-button" onClick={toggleCanvasExpansion}>{zen ? "退出展开" : "展开画布"}</button>
              </div>
            </div>
            <div id="preview-canvas-wrap" className="canvas-wrap" onDoubleClickCapture={startInlineTextEdit}>
              <div className="canvas-paper" style={{ "--canvas-percent": `${canvasZoom}%`, "--canvas-max-width": `${canvasZoom * 9.2}px` } as CSSProperties}><Diagram key={`${tool}-${layoutVersion}`} tool={tool} source={source} settings={settings} /></div>
              {inlineTextEdit && <form className="canvas-inline-editor" style={{ left: inlineTextEdit.x, top: inlineTextEdit.y }} onSubmit={(event) => { event.preventDefault(); commitInlineTextEdit(); }} onPointerDown={(event) => event.stopPropagation()}>
                <input ref={inlineTextInputRef} value={inlineTextEdit.value} onChange={(event) => setInlineTextEdit({ ...inlineTextEdit, value: event.target.value })} onBlur={commitInlineTextEdit} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setInlineTextEdit(null); } }} aria-label="修改图表文字" />
                <span>Enter 保存 · Esc 取消</span>
              </form>}
            </div>
          </section>

          <aside className="settings-panel panel">
            <div className="panel-head"><div><span className="panel-kicker">STYLE</span><strong>样式参数</strong></div><button className="reset-link" onClick={resetStyleSettings}>重置参数</button></div>
            <div className="setting-group scale-setting">
              <div className="setting-heading"><div><strong>整体缩放</strong><small>影响图形布局与导出</small></div><span className="setting-value percent-value"><input type="number" min={overallScaleMin} max={overallScaleMax} step="5" value={settings.overallScale} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateOverallScale(event.currentTarget.valueAsNumber)} aria-label="手动输入整体缩放比例" /><em>%</em></span></div>
              <input type="range" min={overallScaleMin} max={overallScaleMax} step="5" value={settings.overallScale} onChange={(event) => updateOverallScale(event.currentTarget.valueAsNumber)} aria-label="整体缩放比例" />
              <small className="range-hint">{overallScaleMin}–{overallScaleMax}% · 100% 为原始大小</small>
            </div>
            <div className="setting-group spacing-setting">
              <div className="setting-heading"><div><strong>整体间距</strong><small>统一调整各图表元素的距离</small></div><span className="setting-value percent-value"><input type="number" min={spacingScaleMin} max={spacingScaleMax} step="5" value={settings.spacingScale} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSpacingScale(event.currentTarget.valueAsNumber)} aria-label="手动输入整体间距比例" /><em>%</em></span></div>
              <input type="range" min={spacingScaleMin} max={spacingScaleMax} step="5" value={settings.spacingScale} onChange={(event) => updateSpacingScale(event.currentTarget.valueAsNumber)} aria-label="整体间距比例" />
              <small className="range-hint">{spacingScaleMin}–{spacingScaleMax}% · 默认布局防重叠</small>
            </div>
            <div className="setting-group">
              <div className="setting-heading"><div><strong>正文字号</strong><small>默认 14px · 五号字</small></div><span className="setting-value"><input type="number" min={fontMin} max={fontMax} step="1" value={settings.fontSize} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateFontSize(event.currentTarget.valueAsNumber)} aria-label="手动输入正文字号" /><em>px</em></span></div>
              <input type="range" min={fontMin} max={fontMax} step="1" value={settings.fontSize} onChange={(event) => updateFontSize(event.currentTarget.valueAsNumber)} aria-label="正文字号" />
              <small className="range-hint">{fontMin}–{fontMax}px · 五号字约为 14px</small>
            </div>
            <div className="setting-group">
              <div className="setting-heading"><div><strong>线条粗细</strong><small>支持半像素精调</small></div><span className="setting-value"><input type="number" min={lineMin} max={lineMax} step="0.5" value={settings.lineWidth} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateLineWidth(event.currentTarget.valueAsNumber)} aria-label="手动输入线条粗细" /><em>px</em></span></div>
              <input type="range" min={lineMin} max={lineMax} step="0.5" value={settings.lineWidth} onChange={(event) => updateLineWidth(event.currentTarget.valueAsNumber)} aria-label="线条粗细" />
              <small className="range-hint">{lineMin}–{lineMax}px · 支持 0.5px 精调</small>
            </div>
            <div className="setting-group">
              <div className="setting-heading"><div><strong>边框大小</strong><small>调整实体框、属性框等宽高</small></div><span className="setting-value percent-value"><input type="number" min={borderScaleMin} max={borderScaleMax} step="5" value={settings.borderScale} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateBorderScale(event.currentTarget.valueAsNumber)} aria-label="手动输入边框大小比例" /><em>%</em></span></div>
              <input type="range" min={borderScaleMin} max={borderScaleMax} step="5" value={settings.borderScale} onChange={(event) => updateBorderScale(event.currentTarget.valueAsNumber)} aria-label="边框大小比例" />
              <small className="range-hint">{borderScaleMin}–{borderScaleMax}% · 100% 为默认尺寸</small>
            </div>
            <div className="setting-group font-family-setting">
              <div className="setting-heading"><div><strong>字体型号</strong><small>中英文字体分别设置</small></div></div>
              <div className="font-select-grid">
                <label><span>中文字体</span><select value={settings.chineseFont} onChange={(event) => setSettings({ ...settings, chineseFont: event.currentTarget.value as DiagramSettings["chineseFont"] })} aria-label="选择中文字体">{CHINESE_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
                <label><span>英文字体</span><select value={settings.englishFont} onChange={(event) => setSettings({ ...settings, englishFont: event.currentTarget.value as DiagramSettings["englishFont"] })} aria-label="选择英文字体">{ENGLISH_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
              </div>
              <small className="range-hint">默认：中文宋体 · 英文 Times New Roman</small>
            </div>
            {tool === "chart" && <div className="setting-group"><label><span>图表类型</span></label><div className="segment"><button className={settings.chartType === "bar" ? "active" : ""} onClick={() => setSettings({ ...settings, chartType: "bar" })}>柱状图</button><button className={settings.chartType === "line" ? "active" : ""} onClick={() => setSettings({ ...settings, chartType: "line" })}>折线图</button></div></div>}
          </aside>
        </div>
      </section>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
