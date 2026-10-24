import assert from "node:assert/strict";
import test from "node:test";

import {
  dfdName,
  hasUnclosedQuote,
  parseArchitectureSource,
  parseChartSource,
  parseClassSource,
  parseDeploymentSource,
  parseDfdSource,
  parseDiagnostics,
  parseErInput,
  parseFlowSource,
  parseAlterForeignKeys,
  parseModuleSource,
  parseRelations,
  parseSequenceSource,
  parseSqlTables,
  parseTableSource,
  parseTestcaseSource,
  parseUseCaseSource,
  relationKind,
  replaceIdentifier,
  resolveTextEdit,
  splitCsvLine,
  titleFrom,
} from "../lib/parse.ts";

test("titleFrom reads @title and falls back", () => {
  assert.equal(titleFrom("@title 图 3-1 系统架构\na", "默认"), "图 3-1 系统架构");
  assert.equal(titleFrom("no title here", "默认"), "默认");
});

test("splitCsvLine honours quotes and tabs", () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);
  assert.deepEqual(splitCsvLine('a,"say ""hi""",c'), ["a", 'say "hi"', "c"]);
  assert.deepEqual(splitCsvLine("a\tb\tc"), ["a", "b", "c"]);
  assert.equal(hasUnclosedQuote('a,"b'), true);
  assert.equal(hasUnclosedQuote('a,"b"'), false);
});

test("parseRelations keeps cardinality, arrow kind and label", () => {
  const { relations, unparsed } = parseRelations(["学生 1 --> n 选课记录 : 发起", "broken line"]);
  assert.deepEqual(unparsed, ["broken line"]);
  assert.equal(relations.length, 1);
  assert.equal(relations[0].kind, "navigable");
  assert.equal(relations[0].fromMany, "1");
  assert.equal(relations[0].toMany, "n");
  assert.equal(relations[0].label, "发起");
  assert.equal(relationKind("<|--"), "generalization");
});

test("parseRelations rejects a token outside the allow list", () => {
  const { relations, unparsed } = parseRelations(["A ..> B : 依赖"], ["--"]);
  assert.equal(relations.length, 0);
  assert.deepEqual(unparsed, ["A ..> B : 依赖"]);
});

test("parseClassSource splits attributes, methods and stereotypes", () => {
  const { nodes, relations, diagnostics } = parseClassSource(
    "@title t\nclass 学生 | +学号: String; +姓名: String | +选课(): Boolean\ninterface 仓储\n学生 --> 仓储 : 使用\n",
  );
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].attributes.length, 2);
  assert.equal(nodes[0].methods.length, 1);
  assert.equal(nodes[1].kind, "interface");
  assert.equal(relations.length, 1);
  assert.equal(diagnostics.length, 0);
});

test("parseClassSource flags relations to undefined classes", () => {
  const { diagnostics } = parseClassSource("class A\nA --> B");
  assert.equal(diagnostics.some((item) => item.level === "error"), true);
});

test("parseClassSource accepts every UML relation token", () => {
  const { relations, diagnostics } = parseClassSource(
    [
      "class A", "class B", "class C", "class D", "class E", "class F",
      "A --> B: 关联", "A ..> C: 依赖", "A <|-- D: 继承",
      "A ..|> E: 实现", "A o-- F: 聚合", "A *-- B: 组合",
    ].join("\n"),
  );
  assert.deepEqual(relations.map((item) => item.kind), ["navigable", "dependency", "generalization", "realization", "aggregation", "composition"]);
  assert.deepEqual(diagnostics, []);
});

test("parseSqlTables reads comments, primary and foreign keys", () => {
  const tables = parseSqlTables(
    "CREATE TABLE `student` (`student_id` BIGINT COMMENT '学号', PRIMARY KEY (`student_id`)) COMMENT='学生';\n"
    + "CREATE TABLE `enrollment` (`record_id` BIGINT, `student_id` BIGINT, PRIMARY KEY (`record_id`), "
    + "CONSTRAINT `fk` FOREIGN KEY (`student_id`) REFERENCES `student` (`student_id`)) COMMENT='选课记录';",
  );
  assert.equal(tables.length, 2);
  assert.equal(tables[0].displayName, "学生");
  assert.equal(tables[0].columns[0].displayName, "学号");
  assert.equal(tables[0].columns[0].primaryKey, true);
  assert.deepEqual(tables[1].foreignKeys[0].targetColumns, ["student_id"]);
});

test("parseAlterForeignKeys attributes statements and skips comments", () => {
  const source = [
    "CREATE TABLE `student` (`student_id` BIGINT PRIMARY KEY) COMMENT='学生';",
    "CREATE TABLE `course` (`course_id` BIGINT PRIMARY KEY) COMMENT='课程';",
    "CREATE TABLE `enrollment` (`record_id` BIGINT PRIMARY KEY, `student_id` BIGINT, `course_id` BIGINT) COMMENT='选课记录';",
    "/* 历史脚本：建表后再补外键 */",
    "ALTER TABLE `enrollment` ADD CONSTRAINT `fk_student` FOREIGN KEY (`student_id`) REFERENCES `student` (`student_id`);",
    "-- ALTER TABLE `course` ADD CONSTRAINT `fk_ignored` FOREIGN KEY (`course_id`) REFERENCES `student` (`student_id`);",
    "ALTER TABLE `enrollment` ADD CONSTRAINT `fk_course` FOREIGN KEY (`course_id`) REFERENCES `course` (`course_id`);",
  ].join("\n");
  const alters = parseAlterForeignKeys(source);
  assert.equal(alters.length, 2);
  assert.equal(alters[0].table, "enrollment");
  assert.deepEqual(alters[0].foreignKey.localColumns, ["student_id"]);
  assert.equal(alters[1].foreignKey.targetTable, "course");

  const tables = parseSqlTables(source);
  const enrollment = tables.find((table) => table.sqlName === "enrollment")!;
  assert.deepEqual(enrollment.foreignKeys.map((foreignKey) => foreignKey.targetTable), ["student", "course"]);
  const course = tables.find((table) => table.sqlName === "course")!;
  assert.equal(course.foreignKeys.length, 0);
});

test("parseSqlTables does not duplicate an ALTER TABLE foreign key", () => {
  const tables = parseSqlTables([
    "CREATE TABLE `student` (`id` BIGINT PRIMARY KEY);",
    "CREATE TABLE `profile` (`id` BIGINT PRIMARY KEY, `student_id` BIGINT, FOREIGN KEY (`student_id`) REFERENCES `student` (`id`));",
    "ALTER TABLE `profile` ADD CONSTRAINT `fk` FOREIGN KEY (`student_id`) REFERENCES `student` (`id`);",
  ].join("\n"));
  assert.equal(tables[1].foreignKeys.length, 1);
});

test("parseErInput turns ALTER TABLE foreign keys into relations", () => {
  const parsed = parseErInput([
    "CREATE TABLE `student` (`student_id` BIGINT PRIMARY KEY) COMMENT='学生';",
    "CREATE TABLE `enrollment` (`record_id` BIGINT PRIMARY KEY, `student_id` BIGINT) COMMENT='选课记录';",
    "ALTER TABLE `enrollment` ADD CONSTRAINT `fk_student` FOREIGN KEY (`student_id`) REFERENCES `student` (`student_id`);",
  ].join("\n"));
  assert.equal(parsed.relations.length, 1);
  assert.equal(parsed.relations[0].from, "学生");
  assert.equal(parsed.relations[0].to, "选课记录");
  assert.equal(parsed.relations[0].toMany, "n");
  assert.deepEqual(parsed.diagnostics, []);
});

test("parseErInput warns when an ALTER TABLE target is missing", () => {
  const parsed = parseErInput([
    "CREATE TABLE `student` (`student_id` BIGINT PRIMARY KEY) COMMENT='学生';",
    "ALTER TABLE `ghost` ADD CONSTRAINT `fk` FOREIGN KEY (`student_id`) REFERENCES `student` (`student_id`);",
  ].join("\n"));
  assert.equal(parsed.relations.length, 0);
  assert.equal(parsed.diagnostics.filter((item) => item.level === "warning" && item.message.includes("ghost")).length, 1);
});

test("parseErInput detects one-to-one links through a unique foreign key", () => {
  const simple = parseErInput("学生: 学号(PK), 姓名\n教师 1 -- n 学生 : 授课\nnonsense line");
  assert.equal(simple.sqlMode, false);
  assert.equal(simple.entities.length, 1);
  assert.equal(simple.relations.length, 1);
  assert.equal(simple.diagnostics.some((item) => item.message.includes("nonsense")), true);

  const sql = parseErInput(
    "CREATE TABLE `user` (`id` BIGINT PRIMARY KEY) COMMENT='用户';\n"
    + "CREATE TABLE `profile` (`id` BIGINT PRIMARY KEY, `user_id` BIGINT UNIQUE, FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)) COMMENT='资料';",
  );
  assert.equal(sql.sqlMode, true);
  assert.equal(sql.relations[0].toMany, "1");
});

test("parseFlowSource separates node definitions from edges", () => {
  const { nodes, edges, diagnostics } = parseFlowSource(
    "开始 [start]\n校验 [decision]\n结束 [end]\n开始 -> 校验\n校验 -通过-> 结束\n校验 -> 缺失\n",
  );
  assert.equal(nodes.length, 3);
  assert.equal(edges.length, 3);
  assert.equal(edges[1].label, "通过");
  assert.equal(diagnostics.filter((item) => item.level === "error").length, 1);
});

test("parseSequenceSource auto-adds undeclared participants", () => {
  const { participants, messages, diagnostics } = parseSequenceSource(
    "participant A\nA -> B: 请求\nB --> A: 响应\ngarbage\n",
  );
  assert.deepEqual(participants, ["A", "B"]);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].dashed, true);
  assert.equal(diagnostics.some((item) => item.message.includes("garbage")), true);
});

test("parseUseCaseSource splits actor links from include/extend", () => {
  const { associations, dependencies, primaryUsecases, secondaryUsecases } = parseUseCaseSource(
    "system 平台\nactor 学生\n学生 -> 登录\n登录 -> 找回密码: extend\n登录 --> 查看资料: include\n",
  );
  assert.equal(associations.length, 1);
  assert.equal(dependencies.length, 2);
  assert.deepEqual(primaryUsecases, ["登录"]);
  assert.deepEqual(secondaryUsecases, ["找回密码", "查看资料"]);
});

test("parseModuleSource and parseArchitectureSource report unusable lines", () => {
  const modules = parseModuleSource("system 平台\n学生: 登录; 发布\n管理员: 审核\nbroken\n");
  assert.equal(modules.groups.length, 2);
  assert.equal(modules.groups[0].items.length, 2);
  assert.equal(modules.diagnostics.length, 1);

  const architecture = parseArchitectureSource("表现层: Web; 小程序\n数据层: MySQL\n");
  assert.equal(architecture.layers.length, 2);
  assert.equal(architecture.diagnostics.length, 0);
});

test("parseTableSource normalises ragged rows and warns", () => {
  const { rows, columns, diagnostics } = parseTableSource("字段,类型,说明\na,BIGINT,主键\nb,VARCHAR");
  assert.equal(columns, 3);
  assert.equal(rows[2].length, 2);
  assert.equal(diagnostics.filter((item) => item.message.includes("列")).length, 1);
});

test("parseTestcaseSource suggests the verdict column", () => {
  const parsed = parseTestcaseSource("用例编号,测试功能\nTC-01,登录");
  assert.equal(parsed.diagnostics.some((item) => item.message.includes("结论")), true);
});

test("parseChartSource validates numeric cells", () => {
  const { headers, series, maxValue, diagnostics } = parseChartSource("并发,优化前,优化后\n50,126,82\n100,abc,141");
  assert.deepEqual(headers, ["并发", "优化前", "优化后"]);
  assert.deepEqual(series, ["优化前", "优化后"]);
  assert.equal(maxValue, 141);
  assert.equal(diagnostics.length, 1);
});

test("parseDfdSource resolves flows by id and by name", () => {
  const parsed = parseDfdSource(
    "external 学生\nprocess 1.0 发布商品\nstore D1 商品表\n学生 -> 1.0 发布商品: 商品信息\n1.0 --> D1: 写入\n幽灵 -> D1: 断链\n",
  );
  assert.equal(parsed.flows.length, 3);
  assert.equal(parsed.flows[1].dashed, true);
  assert.equal(dfdName({ id: "D1", name: "商品表" }), "D1 商品表");
  const errors = parsed.diagnostics.filter((item) => item.level === "error");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /幽灵/);
});

test("parseDeploymentSource reads node components and links", () => {
  const parsed = parseDeploymentSource(
    "node 应用服务器 | Spring Boot; 定时任务\nnode 数据服务器 | MySQL\n应用服务器 <-> 数据服务器: TCP 3306\n应用服务器 <-> 缺失: x\nnode 空节点 |\n",
  );
  assert.equal(parsed.nodes.length, 3);
  assert.equal(parsed.nodes[0].components.length, 2);
  assert.equal(parsed.links.length, 2);
  assert.equal(parsed.links[0].arrow, "<->");
  assert.equal(parsed.diagnostics.filter((item) => item.level === "error").length, 1);
  assert.equal(parsed.diagnostics.filter((item) => item.message.includes("没有构件")).length, 1);
});

test("resolveTextEdit maps diagram drag ids back to source lines", () => {
  const er = "学生: 学号(PK), 姓名\n学生 1 -- n 选课 : 选修\n";
  assert.equal(resolveTextEdit("er", er, "er-attribute:学生:姓名", "姓名").sourceLine, "学生: 学号(PK), 姓名");
  assert.equal(resolveTextEdit("er", er, "er-entity:学生", "学生").scope, "all");
  assert.equal(resolveTextEdit("class", "class 学生", "class:学生", "学生").scope, "all");
  assert.equal(resolveTextEdit("table", "a,b\n1,2", "table-row:1", "1").sourceLine, "1,2");
  assert.equal(resolveTextEdit("chart", "并发,值\n50,1", "chart-label:0", "50").sourceLine, "50,1");
});

test("replaceIdentifier only swaps whole identifiers", () => {
  assert.equal(replaceIdentifier("A -> AB\nBA", "A", "C"), "C -> AB\nBA");
});

test("parseDiagnostics dispatches per tool", () => {
  assert.equal(parseDiagnostics("flow", "开始 [start]").length, 0);
  assert.equal(parseDiagnostics("chart", "并发,值").length, 1);
});
