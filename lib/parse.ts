import type { ParseDiagnostic, Relation, RelationKind, ToolId } from "./types.ts";

export function titleFrom(source: string, fallback: string) {
  const line = source.split("\n").find((item) => item.trim().startsWith("@title"));
  return line?.replace("@title", "").trim() || fallback;
}

export function dataLines(source: string) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@title") && !line.startsWith("#"));
}

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = false;
      } else current += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "," || char === "\t") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function hasUnclosedQuote(line: string) {
  const quoteCount = (line.match(/"/g) || []).length;
  return quoteCount % 2 === 1;
}

const RELATION_TOKENS: Array<{ token: string; kind: RelationKind }> = [
  { token: "..|>", kind: "realization" },
  { token: "<|--", kind: "generalization" },
  { token: "*--", kind: "composition" },
  { token: "o--", kind: "aggregation" },
  { token: "..>", kind: "dependency" },
  { token: "-->", kind: "navigable" },
  { token: "--", kind: "association" },
];

export function relationKind(token: string): RelationKind {
  return RELATION_TOKENS.find((item) => item.token === token)?.kind ?? "association";
}

const RELATION_TOKEN_PATTERN = /(\.\.\|>|<\|--|\*--|o--|\.\.>|-->|--)/;

export function parseRelations(lines: string[], allowedTokens?: string[]) {
  const relations: Relation[] = [];
  const unparsed: string[] = [];

  for (const line of lines) {
    const match = line.match(RELATION_TOKEN_PATTERN);
    if (!match || match.index === undefined) {
      unparsed.push(line);
      continue;
    }
    const token = match[1];
    if (allowedTokens && !allowedTokens.includes(token)) {
      unparsed.push(line);
      continue;
    }
    const left = line.slice(0, match.index).trim();
    const rest = line.slice(match.index + token.length);
    const colonIndex = rest.indexOf(":");
    const right = (colonIndex < 0 ? rest : rest.slice(0, colonIndex)).trim();
    const label = colonIndex < 0 ? "" : rest.slice(colonIndex + 1).trim();
    const leftTokens = left.split(/\s+/).filter(Boolean);
    const rightTokens = right.split(/\s+/).filter(Boolean);
    const from = leftTokens[0] || "";
    const to = rightTokens[rightTokens.length - 1] || "";
    if (!from || !to || from === to && leftTokens.length > 1 && !rightTokens.length) {
      unparsed.push(line);
      continue;
    }
    relations.push({
      from,
      to,
      fromMany: leftTokens[1],
      toMany: rightTokens.length > 1 ? rightTokens[0] : undefined,
      arrow: token,
      kind: relationKind(token),
      label,
    });
  }

  return { relations, unparsed };
}

export type ClassNode = { name: string; kind: "class" | "interface" | "abstract"; attributes: string[]; methods: string[] };

export function parseClassSource(source: string) {
  const lines = dataLines(source);
  const nodes: ClassNode[] = [];
  const relationLines: string[] = [];
  const unrecognized: string[] = [];

  for (const line of lines) {
    const declaration = line.match(/^(class|interface|abstract class)\s+(.+)$/);
    if (declaration) {
      const kind: ClassNode["kind"] = declaration[1] === "interface" ? "interface" : declaration[1].startsWith("abstract") ? "abstract" : "class";
      const parts = declaration[2].split("|").map((part) => part.trim());
      nodes.push({
        name: parts[0].replace(/\s+(?:\{.*\})$/, "").trim(),
        kind,
        attributes: (parts[1] || "").split(";").map((item) => item.trim()).filter(Boolean),
        methods: (parts[2] || "").split(";").map((item) => item.trim()).filter(Boolean),
      });
      continue;
    }
    if (RELATION_TOKEN_PATTERN.test(line)) {
      relationLines.push(line);
      continue;
    }
    unrecognized.push(line);
  }

  const { relations, unparsed } = parseRelations(relationLines);
  const names = new Set(nodes.map((node) => node.name));
  const diagnostics: ParseDiagnostic[] = [];
  for (const relation of relations) {
    if (!names.has(relation.from) || !names.has(relation.to)) {
      diagnostics.push({ level: "error", message: `关系引用了未定义的类：${relation.from} / ${relation.to}` });
    }
  }
  for (const line of [...unparsed, ...unrecognized]) {
    diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
  }
  if (!nodes.length) diagnostics.unshift({ level: "error", message: "没有解析到类定义，请使用 class 名称 | 属性 | 方法" });

  return { nodes, relations, diagnostics };
}

export type ErEntityDefinition = { name: string; fields: string[] };
export type ErInputDefinition = { entities: ErEntityDefinition[]; relations: Relation[]; sqlMode: boolean; diagnostics: ParseDiagnostic[] };
export type SqlColumnDefinition = { sqlName: string; displayName: string; primaryKey: boolean };
export type SqlForeignKeyDefinition = { localColumns: string[]; targetTable: string; targetColumns: string[] };
export type SqlTableDefinition = {
  sqlName: string;
  displayName: string;
  columns: SqlColumnDefinition[];
  primaryKeys: Set<string>;
  uniqueKeys: string[][];
  foreignKeys: SqlForeignKeyDefinition[];
};

export function isSqlErSource(source: string) {
  return /\bCREATE\s+TABLE\b/i.test(source);
}

export function sqlIdentifier(value: string) {
  const last = value.trim().split(/\s*\.\s*/).pop() || value;
  return last.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "");
}

export function sqlIdentifierList(value: string) {
  return value.split(",").map((item) => sqlIdentifier(item.replace(/\s+(?:ASC|DESC)\b/gi, ""))).filter(Boolean);
}

export function splitSqlDefinitionList(body: string) {
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

export function sqlComment(value: string) {
  const single = value.match(/\bCOMMENT\s*=?\s*'((?:''|\\.|[^'])*)'/i);
  const double = value.match(/\bCOMMENT\s*=?\s*"((?:""|\\.|[^"])*)"/i);
  const raw = single?.[1] ?? double?.[1] ?? "";
  return raw.replace(/''/g, "'").replace(/""/g, '"').replace(/\\(['"])/g, "$1").trim();
}

export function stripSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*(?:--|#).*$/gm, " ");
}

export type SqlAlterForeignKeyDefinition = { table: string; foreignKey: SqlForeignKeyDefinition };

function collectAlterForeignKeys(cleaned: string): SqlAlterForeignKeyDefinition[] {
  const identifierPattern = '(?:`[^`]+`|"[^"]+"|[A-Za-z_$][\\w$]*)';
  const tablePattern = `${identifierPattern}(?:\\s*\\.\\s*${identifierPattern})?`;
  const statementPattern = new RegExp(`\\bALTER\\s+TABLE\\s+(${tablePattern})\\s+([\\s\\S]*?)(?=;|\\bALTER\\s+TABLE\\b|\\bCREATE\\s+TABLE\\b|$)`, "gi");
  const foreignPattern = new RegExp(`\\bFOREIGN\\s+KEY\\s*\\(([^)]+)\\)\\s*REFERENCES\\s+(${tablePattern})\\s*\\(([^)]+)\\)`, "gi");
  const found: SqlAlterForeignKeyDefinition[] = [];
  let statement: RegExpExecArray | null;

  while ((statement = statementPattern.exec(cleaned))) {
    const table = sqlIdentifier(statement[1]);
    const body = statement[2];
    foreignPattern.lastIndex = 0;
    let foreign: RegExpExecArray | null;
    while ((foreign = foreignPattern.exec(body))) {
      found.push({
        table,
        foreignKey: {
          localColumns: sqlIdentifierList(foreign[1]),
          targetTable: sqlIdentifier(foreign[2]),
          targetColumns: sqlIdentifierList(foreign[3]),
        },
      });
    }
    if (statementPattern.lastIndex === statement.index) statementPattern.lastIndex += 1;
  }

  return found;
}

export function parseAlterForeignKeys(source: string): SqlAlterForeignKeyDefinition[] {
  return collectAlterForeignKeys(stripSqlComments(source));
}

export function parseSqlTables(source: string): SqlTableDefinition[] {
  const cleaned = stripSqlComments(source);
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

  const tableIndex = new Map(tables.map((table) => [table.sqlName.toLowerCase(), table]));
  collectAlterForeignKeys(cleaned).forEach(({ table, foreignKey }) => {
    const owner = tableIndex.get(table.toLowerCase());
    if (!owner) return;
    const duplicate = owner.foreignKeys.some((existing) => existing.targetTable.toLowerCase() === foreignKey.targetTable.toLowerCase()
      && existing.localColumns.join(",").toLowerCase() === foreignKey.localColumns.join(",").toLowerCase());
    if (!duplicate) owner.foreignKeys.push(foreignKey);
  });

  return tables;
}

export function parseErInput(source: string): ErInputDefinition {
  if (!isSqlErSource(source)) {
    const lines = dataLines(source);
    const relationLines = lines.filter((line) => /\s--\s/.test(line));
    const entityLines = lines.filter((line) => line.includes(":") && !relationLines.includes(line));
    const diagnostics: ParseDiagnostic[] = [];
    for (const line of lines) {
      if (!entityLines.includes(line) && !relationLines.includes(line)) {
        diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
      }
    }
    if (!entityLines.length) diagnostics.unshift({ level: "error", message: "未识别到实体，请使用“实体名: 属性1, 属性2”" });

    return {
      entities: entityLines.map((line) => {
        const split = line.indexOf(":");
        return { name: line.slice(0, split).trim(), fields: line.slice(split + 1).split(",").map((field) => field.trim()).filter(Boolean) };
      }),
      relations: parseRelations(relationLines, ["--"]).relations,
      sqlMode: false,
      diagnostics,
    };
  }

  const tables = parseSqlTables(source);
  const diagnostics: ParseDiagnostic[] = [];
  if (!tables.length) diagnostics.push({ level: "error", message: "检测到 CREATE TABLE 但未解析出完整结构，请检查括号是否闭合" });
  const usedDisplayNames = new Set<string>();
  tables.forEach((table) => {
    if (usedDisplayNames.has(table.displayName)) table.displayName = `${table.displayName}（${table.sqlName}）`;
    usedDisplayNames.add(table.displayName);
    if (!table.columns.length) diagnostics.push({ level: "warning", message: `表 ${table.sqlName} 没有解析到字段` });
  });
  const tableMap = new Map(tables.map((table) => [table.sqlName.toLowerCase(), table]));
  [...new Set(parseAlterForeignKeys(source).map((item) => item.table))].forEach((table) => {
    if (!tableMap.has(table.toLowerCase())) {
      diagnostics.push({ level: "warning", message: `ALTER TABLE 修改的表 ${table} 不在输入的 CREATE TABLE 中` });
    }
  });
  const relations: Relation[] = [];
  const relationKeys = new Set<string>();
  tables.forEach((table) => table.foreignKeys.forEach((foreignKey) => {
    const target = tableMap.get(foreignKey.targetTable.toLowerCase());
    if (!target) {
      diagnostics.push({ level: "warning", message: `外键引用的表 ${foreignKey.targetTable} 不在输入中` });
      return;
    }
    const localColumns = foreignKey.localColumns.map((column) => column.toLowerCase());
    const oneToOne = (localColumns.length === table.primaryKeys.size && localColumns.every((column) => table.primaryKeys.has(column)))
      || table.uniqueKeys.some((columns) => columns.length === localColumns.length && columns.every((column) => localColumns.includes(column)));
    const key = `${target.sqlName}->${table.sqlName}:${localColumns.join(",")}`;
    if (relationKeys.has(key)) return;
    relationKeys.add(key);
    relations.push({ from: target.displayName, to: table.displayName, fromMany: "1", toMany: oneToOne ? "1" : "n", arrow: "--", kind: "association", label: "关联" });
  }));

  return {
    entities: tables.map((table) => ({
      name: table.displayName,
      fields: table.columns.map((column) => `${column.displayName}${column.primaryKey ? "(PK)" : ""}`),
    })),
    relations,
    sqlMode: true,
    diagnostics,
  };
}

export function parseFlowSource(source: string) {
  const lines = dataLines(source);
  const nodeLines = lines.filter((line) => /\[(start|process|decision|end)\]$/.test(line));
  const nodes = nodeLines.map((line) => ({
    name: line.replace(/\s*\[[^\]]+\]$/, "").trim(),
    type: line.match(/\[([^\]]+)\]$/)?.[1] || "process",
  }));
  const edges = lines.filter((line) => line.includes("->") && !nodeLines.includes(line)).map((line) => {
    const labelled = line.match(/^(.+?)\s+-([^>-]+)->\s+(.+)$/);
    if (labelled) return { from: labelled[1].trim(), label: labelled[2].trim(), to: labelled[3].trim() };
    const plain = line.split("->");
    return { from: plain[0].trim(), label: "", to: plain[1]?.trim() || "" };
  });
  const diagnostics: ParseDiagnostic[] = [];
  const names = new Set(nodes.map((node) => node.name));
  edges.forEach((edge) => {
    if (!names.has(edge.from) || !names.has(edge.to)) {
      diagnostics.push({ level: "error", message: `连线引用了未定义的节点：${edge.from} -> ${edge.to}` });
    }
  });
  lines.forEach((line) => {
    if (!nodeLines.includes(line) && !line.includes("->")) diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
  });
  if (!nodes.length) diagnostics.unshift({ level: "error", message: "没有解析到节点，请使用“节点名 [start|process|decision|end]”" });

  return { nodes, edges, diagnostics };
}

export function parseSequenceSource(source: string) {
  const lines = dataLines(source);
  const participants = lines.filter((line) => line.startsWith("participant ")).map((line) => line.replace("participant ", "").trim());
  const messageSource = lines.filter((line) => /\s--?>\s/.test(line));
  const diagnostics: ParseDiagnostic[] = [];
  const messages = messageSource.flatMap((line) => {
    const match = line.match(/^(.+?)\s+(--?>)\s+(.+?)(?:\s*:\s*(.+))?$/);
    if (!match) {
      diagnostics.push({ level: "warning", message: `无法识别的消息行：${line}` });
      return [];
    }
    const from = match[1].trim();
    const to = match[3].trim();
    [from, to].forEach((name) => {
      if (!participants.includes(name)) {
        participants.push(name);
        diagnostics.push({ level: "warning", message: `参与者“${name}”未声明，已自动补充` });
      }
    });
    return [{ from, to, dashed: match[2] === "-->", label: match[4] || "" }];
  });
  lines.forEach((line) => {
    if (!line.startsWith("participant ") && !/\s--?>\s/.test(line)) diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
  });
  if (!participants.length) diagnostics.unshift({ level: "error", message: "没有解析到参与者，请使用 participant 名称" });

  return { participants, messages, diagnostics };
}

type UseCaseLink =
  | { from: string; to: string; kind: "association" | "include" | "extend"; sourceIndex: number }
  | { invalid: string; sourceIndex: number };

export function parseUseCaseSource(source: string) {
  const lines = dataLines(source);
  const system = lines.find((line) => line.startsWith("system "))?.replace("system ", "").trim() || "系统";
  const actors = lines.filter((line) => line.startsWith("actor ")).map((line) => line.replace("actor ", "").trim());
  const parsedLinks = lines.flatMap<UseCaseLink>((line, sourceIndex) => {
    if (line.startsWith("actor ") || line.startsWith("system ")) return [];
    const match = line.match(/^(.+?)\s*(\.\.>|-->|->)\s*(.+?)(?:\s*:\s*(include|extend|包含|扩展))?$/i);
    if (!match) return [{ invalid: line, sourceIndex }];
    const [, from, arrow, to, rawKind] = match;
    const normalizedKind = rawKind?.toLowerCase();
    const kind = normalizedKind === "extend" || normalizedKind === "扩展"
      ? "extend"
      : normalizedKind === "include" || normalizedKind === "包含" || arrow === "..>"
        ? "include"
        : "association";
    return [{ from: from.trim(), to: to.trim(), kind, sourceIndex }];
  });
  const diagnostics: ParseDiagnostic[] = parsedLinks
    .filter((link): link is { invalid: string; sourceIndex: number } => "invalid" in link)
    .map((link) => ({ level: "warning", message: `无法识别的行：${link.invalid}` }));
  const associations = parsedLinks.filter((link): link is Extract<UseCaseLink, { from: string }> => !("invalid" in link) && link.kind === "association" && actors.includes(link.from));
  const dependencies = parsedLinks.filter((link): link is Extract<UseCaseLink, { from: string }> => !("invalid" in link) && (link.kind !== "association" || !actors.includes(link.from)));
  const primaryUsecases = Array.from(new Set([
    ...associations.map((link) => link.to),
    ...dependencies.map((link) => link.from),
  ]));
  const secondaryUsecases = Array.from(new Set(dependencies.map((link) => link.to))).filter((item) => !primaryUsecases.includes(item));
  if (!actors.length) diagnostics.unshift({ level: "error", message: "没有解析到角色，请使用 actor 名称" });

  return {
    system,
    actors,
    associations,
    dependencies,
    primaryUsecases,
    secondaryUsecases,
    diagnostics,
  };
}

type ModuleGroup = { name: string; items: string[] } | { invalid: string };

export function parseModuleSource(source: string) {
  const lines = dataLines(source);
  const system = lines.find((line) => line.startsWith("system "))?.replace("system ", "").trim() || "系统名称";
  const groups = lines.filter((line) => !line.startsWith("system ")).flatMap<ModuleGroup>((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return [{ invalid: line }];
    const name = line.slice(0, separator).trim();
    const items = line.slice(separator + 1).split(/[;,；，]/).map((item) => item.trim()).filter(Boolean);
    return name && items.length ? [{ name, items }] : [{ invalid: line }];
  });
  const diagnostics: ParseDiagnostic[] = groups
    .filter((group): group is { invalid: string } => "invalid" in group)
    .map((group) => ({ level: "warning", message: `无法识别的行：${group.invalid}` }));
  const validGroups = groups.filter((group): group is Extract<ModuleGroup, { name: string }> => !("invalid" in group));
  if (!validGroups.length) diagnostics.unshift({ level: "error", message: "没有解析到分组，请使用“分组名: 功能1; 功能2”" });

  return { system, groups: validGroups, diagnostics };
}

export function parseArchitectureSource(source: string) {
  const lines = dataLines(source);
  const layers = lines.map((line) => {
    const split = line.indexOf(":");
    return {
      name: split > -1 ? line.slice(0, split).trim() : line,
      modules: split > -1 ? line.slice(split + 1).split(/[;,；，]/).map((item) => item.trim()).filter(Boolean) : [],
    };
  });
  const diagnostics: ParseDiagnostic[] = [];
  if (!layers.length) diagnostics.push({ level: "error", message: "没有解析到分层，请使用“层名: 模块1; 模块2”" });
  layers.filter((layer) => !layer.modules.length).forEach((layer) => diagnostics.push({ level: "warning", message: `层“${layer.name}”没有模块` }));

  return { layers, diagnostics };
}

export function parseTableSource(source: string, options: { minColumns?: number } = {}) {
  const lines = dataLines(source);
  const diagnostics: ParseDiagnostic[] = [];
  const rows = lines.map((line, index) => {
    if (hasUnclosedQuote(line)) diagnostics.push({ level: "warning", message: `第 ${index + 1} 行的双引号未闭合` });
    return splitCsvLine(line);
  });
  const columns = Math.max(1, ...rows.map((row) => row.length));
  rows.forEach((row, index) => {
    if (index > 0 && row.length !== rows[0].length) {
      diagnostics.push({ level: "warning", message: `第 ${index + 1} 行有 ${row.length} 列，表头为 ${rows[0].length} 列` });
    }
  });
  if (options.minColumns && columns < options.minColumns) {
    diagnostics.push({ level: "error", message: `至少需要 ${options.minColumns} 列内容` });
  }
  if (!rows.length) diagnostics.push({ level: "error", message: "没有解析到表格内容" });

  return { rows, columns, diagnostics };
}

export function parseChartSource(source: string) {
  const rows = dataLines(source).map((line) => splitCsvLine(line));
  const headers = rows[0] || [];
  const values = rows.slice(1);
  const series = headers.slice(1);
  const diagnostics: ParseDiagnostic[] = [];
  const numericValues: number[] = [];
  values.forEach((row, rowIndex) => {
    row.slice(1).forEach((cell, cellIndex) => {
      if (!cell) return;
      const numeric = Number(cell);
      if (!Number.isFinite(numeric)) {
        diagnostics.push({ level: "warning", message: `第 ${rowIndex + 2} 行“${series[cellIndex] || cellIndex + 1}”不是数字：${cell}` });
      } else numericValues.push(numeric);
    });
    if (row.length < 2) diagnostics.push({ level: "warning", message: `第 ${rowIndex + 2} 行缺少数据列` });
  });
  if (series.length > 6) diagnostics.push({ level: "warning", message: "系列过多时图例可能超出画布，建议合并分组" });
  if (!values.length) diagnostics.push({ level: "error", message: "没有数据行，首行应为表头" });
  const minValue = Math.min(0, ...numericValues);
  const maxValue = Math.max(0, ...numericValues);

  return { headers, values, series, minValue, maxValue, diagnostics };
}

export type DfdElement = { name: string; id?: string };
export type DfdFlow = { from: string; to: string; label: string; dashed: boolean };

export function parseDfdSource(source: string) {
  const lines = dataLines(source);
  const externals: DfdElement[] = [];
  const processes: DfdElement[] = [];
  const stores: DfdElement[] = [];
  const flows: DfdFlow[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  lines.forEach((line) => {
    const external = line.match(/^external\s+(.+)$/);
    if (external) {
      externals.push({ name: external[1].trim() });
      return;
    }
    const process = line.match(/^process\s+(.+)$/);
    if (process) {
      const [id, ...rest] = process[1].trim().split(/\s+/);
      processes.push(/^\d+(\.\d+)*$/.test(id) ? { id, name: rest.join(" ") } : { name: process[1].trim() });
      return;
    }
    const store = line.match(/^store\s+(.+)$/);
    if (store) {
      const [id, ...rest] = store[1].trim().split(/\s+/);
      stores.push(/^[A-Z]\d*$/i.test(id) ? { id, name: rest.join(" ") } : { name: store[1].trim() });
      return;
    }
    const flow = line.match(/^(.+?)\s+(-->|->)\s+(.+?)(?:\s*:\s*(.*))?$/);
    if (flow) {
      flows.push({ from: flow[1].trim(), to: flow[3].trim(), label: (flow[4] || "").trim(), dashed: flow[2] === "-->" });
      return;
    }
    diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
  });

  const known = new Map<string, DfdElement>();
  [...externals, ...processes, ...stores].forEach((element) => {
    known.set(dfdName(element), element);
    known.set(element.name, element);
    if (element.id) known.set(element.id, element);
  });
  flows.forEach((flow) => {
    if (!known.has(flow.from) || !known.has(flow.to)) {
      diagnostics.push({ level: "error", message: `数据流引用了未定义的元素：${flow.from} -> ${flow.to}` });
    }
  });
  if (!processes.length) diagnostics.unshift({ level: "error", message: "没有解析到处理过程，请使用 process 1.0 名称" });

  return { externals, processes, stores, flows, diagnostics };
}

export function dfdName(element: DfdElement) {
  return fullName(element);
}

function fullName(element: DfdElement) {
  return element.id ? `${element.id} ${element.name}` : element.name;
}

export type DeploymentNode = { name: string; components: string[] };
export type DeploymentLink = { from: string; to: string; label: string; arrow: string };

export function parseDeploymentSource(source: string) {
  const lines = dataLines(source);
  const nodes: DeploymentNode[] = [];
  const links: DeploymentLink[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  lines.forEach((line) => {
    const node = line.match(/^node\s+(.+)$/);
    if (node) {
      const [name, rest] = node[1].split("|");
      nodes.push({
        name: name.trim(),
        components: (rest || "").split(/[;,；，]/).map((item) => item.trim()).filter(Boolean),
      });
      return;
    }
    const link = line.match(/^(.+?)\s+(<-->|<->|-->|---)\s+(.+?)(?:\s*:\s*(.*))?$/);
    if (link) {
      links.push({ from: link[1].trim(), to: link[3].trim(), label: (link[4] || "").trim(), arrow: link[2] });
      return;
    }
    diagnostics.push({ level: "warning", message: `无法识别的行：${line}` });
  });

  const names = new Set(nodes.map((node) => node.name));
  links.forEach((link) => {
    if (!names.has(link.from) || !names.has(link.to)) {
      diagnostics.push({ level: "error", message: `通信线引用了未定义的节点：${link.from} / ${link.to}` });
    }
  });
  nodes.filter((node) => !node.components.length).forEach((node) => diagnostics.push({ level: "warning", message: `节点“${node.name}”没有构件` }));
  if (!nodes.length) diagnostics.unshift({ level: "error", message: "没有解析到节点，请使用 node 节点名 | 构件1; 构件2" });

  return { nodes, links, diagnostics };
}

export const TESTCASE_COLUMNS = ["用例编号", "测试功能", "测试步骤", "输入数据", "预期结果", "实际结果", "结论"];

export function parseTestcaseSource(source: string) {
  const table = parseTableSource(source, { minColumns: 2 });
  const diagnostics = [...table.diagnostics];
  const headers = table.rows[0] || [];
  if (headers.length && !headers.some((header) => header.includes("结论"))) {
    diagnostics.push({ level: "warning", message: `建议包含“结论”列，例如：${TESTCASE_COLUMNS.join(",")}` });
  }
  return { rows: table.rows, columns: table.columns, diagnostics };
}

export type TextEditTarget = { sourceLine?: string; scope: "line" | "all" | "title" };

export function resolveTextEdit(tool: ToolId, source: string, dragId: string, visibleText: string): TextEditTarget {
  const lines = dataLines(source);
  if (tool === "chart" && !dragId) return { scope: "line" };
  if (dragId.startsWith("er-attribute:")) {
    const entityName = dragId.slice("er-attribute:".length).split(":")[0];
    return { sourceLine: lines.find((line) => line.startsWith(`${entityName}:`)), scope: "line" };
  }
  if (dragId.startsWith("er-entity:")) return { scope: "all" };
  if (dragId.startsWith("er-relation:")) {
    const index = Number(dragId.slice("er-relation:".length));
    return { sourceLine: lines.filter((line) => /\s--\s/.test(line))[index], scope: "line" };
  }
  if (dragId.startsWith("class:")) {
    const className = dragId.slice("class:".length);
    return visibleText === className
      ? { scope: "all" }
      : { sourceLine: lines.find((line) => line.startsWith(`class ${className} `) || line === `class ${className}`), scope: "line" };
  }
  if (dragId.startsWith("flow:")) return { scope: "all" };
  if (dragId.startsWith("sequence-participant:")) return { scope: "all" };
  if (dragId.startsWith("sequence-message:")) {
    const index = Number(dragId.slice("sequence-message:".length));
    return { sourceLine: lines.filter((line) => /\s--?>\s/.test(line))[index], scope: "line" };
  }
  if (dragId === "usecase:boundary") {
    return { sourceLine: lines.find((line) => line.startsWith("system ")), scope: "line" };
  }
  if (dragId.startsWith("usecase-actor:") || dragId.startsWith("usecase-item:")) return { scope: "all" };
  if (dragId === "module:root") {
    return { sourceLine: lines.find((line) => line.startsWith("system ")), scope: "line" };
  }
  if (dragId.startsWith("module-group:") || dragId.startsWith("module-item:")) return { scope: "all" };
  if (dragId.startsWith("architecture:")) {
    const index = Number(dragId.slice("architecture:".length));
    return { sourceLine: lines[index], scope: "line" };
  }
  if (dragId.startsWith("dfd:")) {
    const name = dragId.slice("dfd:".length);
    return { sourceLine: lines.find((line) => line.endsWith(name) || line.includes(` ${name}`)), scope: "all" };
  }
  if (dragId.startsWith("deployment:")) {
    const name = dragId.slice("deployment:".length);
    return visibleText === name ? { scope: "all" } : { sourceLine: lines.find((line) => line.startsWith(`node ${name} `)), scope: "line" };
  }
  if (dragId.startsWith("table-row:")) {
    const index = Number(dragId.slice("table-row:".length));
    return { sourceLine: lines[index], scope: "line" };
  }
  if (dragId.startsWith("testcase-row:")) {
    const index = Number(dragId.slice("testcase-row:".length));
    return { sourceLine: lines[index], scope: "line" };
  }
  if (dragId.startsWith("chart-label:")) {
    const index = Number(dragId.slice("chart-label:".length));
    return { sourceLine: lines[index + 1], scope: "line" };
  }
  if (dragId.startsWith("chart-legend:") || dragId === "chart-axis-title") {
    return { sourceLine: lines[0], scope: "line" };
  }
  const matchingLines = lines.filter((line) => line.includes(visibleText));
  return { sourceLine: matchingLines[0], scope: "line" };
}

export function parseDiagnostics(tool: ToolId, source: string): ParseDiagnostic[] {
  switch (tool) {
    case "class": return parseClassSource(source).diagnostics;
    case "er": return parseErInput(source).diagnostics;
    case "flow": return parseFlowSource(source).diagnostics;
    case "sequence": return parseSequenceSource(source).diagnostics;
    case "usecase": return parseUseCaseSource(source).diagnostics;
    case "module": return parseModuleSource(source).diagnostics;
    case "architecture": return parseArchitectureSource(source).diagnostics;
    case "dataflow": return parseDfdSource(source).diagnostics;
    case "deployment": return parseDeploymentSource(source).diagnostics;
    case "testcase": return parseTestcaseSource(source).diagnostics;
    case "chart": return parseChartSource(source).diagnostics;
    default: return parseTableSource(source).diagnostics;
  }
}

export function replaceIdentifier(source: string, original: string, replacement: string) {
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu"), replacement);
}
