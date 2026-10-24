import assert from "node:assert/strict";
import test from "node:test";

import { estimateTextWidth, widestText } from "../lib/layout.ts";

test("estimateTextWidth treats CJK glyphs as full width", () => {
  assert.equal(estimateTextWidth("学生学习", 14), 56);
  assert.ok(estimateTextWidth("students", 14) < estimateTextWidth("学生学生学生学生", 14));
  assert.equal(estimateTextWidth("", 14), 0);
  assert.equal(estimateTextWidth("学生 用户", 10), estimateTextWidth("学生用户", 10) + 3.2);
});

test("widestText returns the longest rendered line", () => {
  assert.equal(widestText(["短", "很长的中文属性名称"], 12), estimateTextWidth("很长的中文属性名称", 12));
  assert.equal(widestText([], 12), 0);
});
