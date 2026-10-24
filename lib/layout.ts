const WIDE_CHAR = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

export function estimateTextWidth(text: string, fontSize: number) {
  let units = 0;
  for (const char of text) {
    if (char === " ") units += 0.32;
    else if (/\s/.test(char)) units += 0.45;
    else if (WIDE_CHAR.test(char)) units += 1;
    else units += 0.56;
  }
  return units * fontSize;
}

export function widestText(items: string[], fontSize: number) {
  return Math.max(0, ...items.map((item) => estimateTextWidth(item, fontSize)));
}
