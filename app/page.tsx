"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DiagramDragProvider, fitSvgCanvasToContent } from "@/components/DiagramCanvas";
import { Diagram } from "@/components/diagrams";
import { ER_SQL_SAMPLE, SAMPLES, TABLE_NOTE_TEXT, THESIS_ROADMAP, TOOLS, createDefaultSettingsByTool, defaultSettingsForTool } from "@/lib/catalog";
import { parseWorkspaceBackup, serializeWorkspaceBackup } from "@/lib/backup";
import { canvasPixelSize, copyRichText, diagramSvgMarkup, downloadFile, escapeHtml, exportPngFromSvg, safeName } from "@/lib/export";
import { dataLines, parseDiagnostics, parseErInput, parseTableSource, replaceIdentifier, resolveTextEdit, titleFrom } from "@/lib/parse";
import { readWorkspace, STORAGE_KEY, writeWorkspace, type Workspace } from "@/lib/storage";
import { CHINESE_FONT_OPTIONS, ENGLISH_FONT_OPTIONS, type DiagramSettings, type DragOffsets, type InlineTextEdit, type ToolId } from "@/lib/types";


const CONTACT_EMAIL = "3091948830@qq.com";
const AUTHOR_SITE = "https://www.cvetryu.cn/";
const QQ_MAIL_URL = "https://mail.qq.com/";

function HomePage({ onOpenTool, onContact }: { onOpenTool: (tool: ToolId) => void; onContact: () => void }) {
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
            <div><strong>13</strong><span>类论文图表</span></div>
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
                  <button onClick={() => onOpenTool(item.id)}><b>{String(item.order).padStart(2, "0")}</b><span>{item.label}</span></button>
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
        <button type="button" className="home-contact-email" onClick={onContact}>
          <span>联系作者</span><strong>{CONTACT_EMAIL}</strong><i>查看联系方式 →</i>
        </button>
      </section>

      <div className="home-footer-note"><span className="brand-mark mini"><span>图</span><i /></span><div><strong>图研</strong><small>让技术表达有结构，也有分寸。</small></div></div>
    </section>
  );
}

type ToastState = {
  message: string;
  tone: "info" | "warn" | "error";
  action?: { label: string; run: () => void };
};

const emptyOffsetsByTool = () => Object.fromEntries(TOOLS.map(({ id }) => [id, {}])) as Record<ToolId, DragOffsets>;
const createDefaultWorkspace = (): Workspace => ({
  homeOpen: true,
  tool: "er",
  sources: SAMPLES,
  settingsByTool: createDefaultSettingsByTool(),
  dragOffsets: emptyOffsetsByTool(),
  canvasZoom: 100,
  editorWidth: null,
  editorCollapsed: false,
});

const CM_TO_PX = 96 / 2.54;
const MAX_BACKUP_FILE_SIZE = 50 * 1024 * 1024;

export default function Home() {
  const [homeOpen, setHomeOpen] = useState(true);
  const [tool, setTool] = useState<ToolId>("er");
  const [sources, setSources] = useState<Record<ToolId, string>>(SAMPLES);
  const [settingsByTool, setSettingsByTool] = useState<Record<ToolId, DiagramSettings>>(createDefaultSettingsByTool);
  const [dragOffsets, setDragOffsets] = useState<Record<ToolId, DragOffsets>>(emptyOffsetsByTool);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saveWarning, setSaveWarning] = useState("");
  const [exporting, setExporting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [zen, setZen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [inlineTextEdit, setInlineTextEdit] = useState<InlineTextEdit | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const inlineTextInputRef = useRef<HTMLInputElement | null>(null);
  const contactCloseRef = useRef<HTMLButtonElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const splitterDragRef = useRef<{ pointerId: number; startX: number; startWidth: number; maxWidth: number } | null>(null);
  const navDragRef = useRef<{ pointerId: number; startX: number; startScroll: number; moved: boolean } | null>(null);
  const suppressNavClickRef = useRef(false);
  const settings = settingsByTool[tool];
  const setSettings = (next: DiagramSettings | ((current: DiagramSettings) => DiagramSettings)) => {
    setSettingsByTool((currentByTool) => {
      const current = currentByTool[tool];
      const updated = typeof next === "function" ? next(current) : next;
      return { ...currentByTool, [tool]: updated };
    });
  };
  const setToolOffsets = useCallback((commit: DragOffsets) => {
    setDragOffsets((current) => ({ ...current, [tool]: commit }));
  }, [tool]);
  const activeTool = TOOLS.find((item) => item.id === tool)!;
  const source = sources[tool];
  const erInputSummary = useMemo(() => tool === "er" ? parseErInput(source) : null, [tool, source]);
  const erSqlMode = erInputSummary?.sqlMode || false;
  const diagnostics = useMemo(() => parseDiagnostics(tool, source), [tool, source]);
  const errorCount = diagnostics.filter((item) => item.level === "error").length;
  const warningCount = diagnostics.length - errorCount;
  const title = titleFrom(source, activeTool.name);
  const lineTotal = erInputSummary ? erInputSummary.entities.length : dataLines(source).length;
  const isTableTool = tool === "table" || tool === "environment" || tool === "testcase";
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
  const insertedFontPt = canvasWidth > 0
    ? settings.fontSize * (settings.printWidthCm * CM_TO_PX) / canvasWidth * 0.75
    : 0;
  const calibration = canvasWidth <= 0
    ? { tone: "", text: "正在测量画布宽度…" }
    : insertedFontPt < settings.targetFontPt - 0.6
      ? { tone: "is-too-small", text: `插入后正文约 ${insertedFontPt.toFixed(1)}pt，低于目标 ${settings.targetFontPt}pt。请提高字号，或减小图片插入宽度。` }
      : insertedFontPt > settings.targetFontPt + 1.5
        ? { tone: "is-too-large", text: `插入后正文约 ${insertedFontPt.toFixed(1)}pt，高于目标 ${settings.targetFontPt}pt。可增大插入宽度，或降低字号。` }
        : { tone: "is-ok", text: `插入后正文约 ${insertedFontPt.toFixed(1)}pt，与目标 ${settings.targetFontPt}pt 相符。` };

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
    const snapshot = settings;
    setSettings(defaultSettingsForTool(tool));
    notify("样式参数已重置", {
      label: "撤销",
      run: () => setSettings(snapshot),
    }, "warn");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
    }));
  };

  const restoreSample = () => {
    if (source === SAMPLES[tool]) {
      notify("当前已经是示例内容");
      return;
    }
    const snapshot = source;
    setSources((current) => ({ ...current, [tool]: SAMPLES[tool] }));
    notify("示例已恢复，原内容仍在本图中", {
      label: "撤销",
      run: () => setSources((current) => ({ ...current, [tool]: snapshot })),
    }, "warn");
  };

  const loadSqlSample = () => {
    const snapshot = source;
    setSources((current) => ({ ...current, er: ER_SQL_SAMPLE }));
    notify("已载入 SQL 示例", {
      label: "撤销",
      run: () => setSources((current) => ({ ...current, er: snapshot })),
    }, "warn");
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

  const startNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    suppressNavClickRef.current = false;
    navDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: event.currentTarget.scrollLeft, moved: false };
  };

  const moveNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const active = navDragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = event.clientX - active.startX;
    if (!active.moved) {
      if (Math.abs(delta) < 5) return;
      active.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add("is-dragging");
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = active.startScroll - delta;
  };

  const endNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const active = navDragRef.current;
    if (!active) return;
    navDragRef.current = null;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.moved) {
      suppressNavClickRef.current = true;
      window.setTimeout(() => { suppressNavClickRef.current = false; }, 160);
    }
  };

  const guardNavClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressNavClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is only readable on the client, so the persisted workspace has to be pushed into state once after hydration. */
  useEffect(() => {
    const workspace = readWorkspace(createDefaultWorkspace());
    setHomeOpen(workspace.homeOpen);
    setTool(workspace.tool);
    setSources(workspace.sources);
    setSettingsByTool(workspace.settingsByTool);
    setDragOffsets(workspace.dragOffsets);
    setCanvasZoom(workspace.canvasZoom);
    setEditorWidth(workspace.editorWidth);
    setEditorCollapsed(workspace.editorCollapsed);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const outcome = writeWorkspace({ homeOpen, tool, sources, settingsByTool, dragOffsets, canvasZoom, editorWidth, editorCollapsed });
      if (outcome === "quota") setSaveWarning("本地存储空间不足，已降级为只保存文本与样式");
      else if (outcome === "unavailable") setSaveWarning("浏览器禁用了本地存储，关闭页面后修改会丢失");
      else setSaveWarning("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, homeOpen, tool, sources, settingsByTool, dragOffsets, canvasZoom, editorWidth, editorCollapsed]);

  useEffect(() => {
    if (homeOpen) return;
    const measure = () => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      const box = svg?.viewBox?.baseVal;
      if (box && box.width > 0) setCanvasWidth(box.width);
    };
    measure();
    const timer = window.setTimeout(measure, 280);
    return () => window.clearTimeout(timer);
  }, [homeOpen, tool, source, settings, layoutVersion]);

  const editingOriginal = inlineTextEdit?.original;
  useEffect(() => {
    if (!editingOriginal) return;
    window.requestAnimationFrame(() => {
      inlineTextInputRef.current?.focus();
      inlineTextInputRef.current?.select();
    });
  }, [editingOriginal]);

  useEffect(() => () => { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current); }, []);

  useEffect(() => {
    if (!contactOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    contactCloseRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [contactOpen]);

  const parseStatus = errorCount
    ? `${errorCount} 处需要修正`
    : warningCount
      ? `${warningCount} 处提示，图表已生成`
      : erSqlMode
        ? erInputSummary?.entities.length ? `SQL 已解析 ${erInputSummary.entities.length} 个实体` : "等待完整 SQL 结构"
        : "语法可解析";

  const previewCaption = useMemo(() => {
    const nouns: Record<ToolId, string> = { class: "类定义与关系", er: "实体与联系", flow: "流程节点", dataflow: "数据流元素", sequence: "交互步骤", usecase: "参与角色与用例", module: "功能模块", architecture: "系统分层", deployment: "部署节点", environment: "环境配置项", testcase: "测试用例", table: "表格行", chart: "数据记录" };
    return `${lineTotal} 条${nouns[tool]} · 实时生成 · 双击文字可修改`;
  }, [lineTotal, tool]);

  const notify = useCallback((message: string, action?: ToastState["action"], tone: ToastState["tone"] = "info") => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone, action });
    toastTimerRef.current = window.setTimeout(() => setToast(null), action ? 6000 : 2000);
  }, []);

  const copyContactEmail = async () => {
    try {
      await copyRichText(CONTACT_EMAIL, CONTACT_EMAIL);
      notify(`邮箱已复制：${CONTACT_EMAIL}`);
    } catch {
      notify("复制失败，请手动选择邮箱地址", undefined, "error");
    }
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

  const fitCanvasToViewport = (message: string, action?: ToastState["action"]) => {
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
    notify(message, action);
  };

  const fitCanvas = () => fitCanvasToViewport("已适应全部内容");

  const autoLayout = () => {
    const snapshot = dragOffsets[tool];
    const undo = {
      label: "撤销",
      run: () => {
        setDragOffsets((current) => ({ ...current, [tool]: snapshot }));
        setLayoutVersion((version) => version + 1);
      },
    };
    setInlineTextEdit(null);
    setDragOffsets((current) => ({ ...current, [tool]: {} }));
    setLayoutVersion((version) => version + 1);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const svg = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
      if (svg) fitSvgCanvasToContent(svg);
      fitCanvasToViewport("已按当前参数自动排版", undo);
    }));
  };

  const toggleCanvasExpansion = () => {
    const expanding = !zen;
    setZen(expanding);
    if (expanding) setCanvasZoom(100);
    notify(expanding ? "画布已按 100% 展开" : "已退出展开画布");
  };

  const exportSvg = () => {
    const markup = diagramSvgMarkup(1, settings.monochrome);
    if (!markup) {
      notify("画布尚未渲染，无法导出 SVG", undefined, "error");
      return;
    }
    downloadFile(markup, `${safeName(title)}.svg`, "image/svg+xml;charset=utf-8");
    notify("SVG 已导出");
  };

  const exportPng = async () => {
    if (exporting) return;
    const element = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
    if (!element) {
      notify("画布尚未渲染，无法导出 PNG", undefined, "error");
      return;
    }
    const exportScale = settings.monochrome ? 4 : 3;
    const { width, height } = canvasPixelSize(element, exportScale);
    const markup = diagramSvgMarkup(exportScale, settings.monochrome);
    setExporting(true);
    notify("正在生成高清 PNG…");
    const outcome = await exportPngFromSvg(markup, { filename: `${safeName(title)}@${exportScale}x.png`, width, height });
    setExporting(false);
    if (outcome === "ok") {
      notify(`高清 PNG 已导出（${width} × ${height}px）`);
      return;
    }
    if (outcome === "too-large") {
      notify(`导出尺寸 ${width} × ${height}px 超出浏览器上限，请降低整体缩放或字号`, undefined, "error");
      return;
    }
    notify("浏览器绘制大图失败，请改用导出 SVG 或降低缩放", undefined, "error");
  };

  const exportSource = () => {
    downloadFile(source, `${safeName(title)}.${erSqlMode ? "sql" : "txt"}`, "text/plain;charset=utf-8");
    notify("源文件已保存");
  };

  const exportWorkspace = () => {
    try {
      const workspace: Workspace = { homeOpen, tool, sources, settingsByTool, dragOffsets, canvasZoom, editorWidth, editorCollapsed };
      const data = serializeWorkspaceBackup(workspace);
      if (new Blob([data]).size > MAX_BACKUP_FILE_SIZE) {
        notify("备份文件超过 50 MB，请精简图表文本后重试", undefined, "error");
        return;
      }
      downloadFile(data, `图研工作区备份-${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8");
      notify(`工作区备份已导出，包含 ${TOOLS.length} 种图表`);
    } catch {
      notify("备份生成失败，请稍后重试", undefined, "error");
    }
  };

  const importWorkspace = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_SIZE) {
      notify("备份文件超过 50 MB，无法导入", undefined, "error");
      return;
    }

    let imported: Workspace;
    try {
      imported = parseWorkspaceBackup(await file.text(), createDefaultWorkspace());
    } catch (error) {
      notify(error instanceof Error ? error.message : "备份文件无法读取", undefined, "error");
      return;
    }

    const confirmed = window.confirm("将用备份中的内容替换当前工作区，包括全部图表文本、样式和排版。建议先导出当前工作区备份。是否继续？");
    if (!confirmed) return;

    setBackupBusy(true);
    let previousStorage: string | null = null;
    let storageSnapshotTaken = false;
    try {
      previousStorage = localStorage.getItem(STORAGE_KEY);
      storageSnapshotTaken = true;

      const outcome = writeWorkspace(imported);
      if (outcome !== "ok") {
        throw new Error(outcome === "quota" ? "浏览器存储空间不足，无法完整恢复工作区" : "浏览器本地存储不可用，无法恢复工作区");
      }

      setHomeOpen(imported.homeOpen);
      setTool(imported.tool);
      setSources(imported.sources);
      setSettingsByTool(imported.settingsByTool);
      setDragOffsets(imported.dragOffsets);
      setCanvasZoom(imported.canvasZoom);
      setEditorWidth(imported.editorWidth);
      setEditorCollapsed(imported.editorCollapsed);
      setZen(false);
      setInlineTextEdit(null);
      setSaveWarning("");
      notify(`工作区已恢复：${TOOLS.length} 种图表`);
    } catch (error) {
      let rollbackFailed = false;
      if (storageSnapshotTaken) {
        try {
          if (previousStorage === null) localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, previousStorage);
        } catch { rollbackFailed = true; }
      }
      const message = error instanceof Error ? error.message : "工作区恢复失败";
      notify(rollbackFailed ? `${message}；自动回滚未能完成，请刷新页面检查本地数据` : message, undefined, "error");
    } finally {
      setBackupBusy(false);
    }
  };

  const copyTableToWord = async () => {
    if (!isTableTool) return;
    const table = parseTableSource(source);
    if (!table.rows.length) {
      notify("暂无可复制的表格内容", undefined, "error");
      return;
    }
    const normalized = table.rows.map((row) => Array.from({ length: table.columns }, (_, index) => row[index] || ""));
    const [headers, ...bodyRows] = normalized;
    const fontWeight = settings.fontBold ? 700 : 400;
    const fontStyle = `font-family:'Times New Roman','SimSun',serif;mso-fareast-font-family:'SimSun';mso-ascii-font-family:'Times New Roman';mso-hansi-font-family:'Times New Roman';font-size:10.5pt;font-weight:${fontWeight};`;
    const cellStyle = `${fontStyle}padding:4pt 8pt;border-left:none;border-right:none;text-align:center;vertical-align:middle;line-height:1.5;`;
    const headerBottomWidth = bodyRows.length ? ".75pt" : "1.5pt";
    const headerHtml = headers.map((cell) => `<th style="${cellStyle}font-weight:${fontWeight};border-top:1.5pt solid #000;border-bottom:${headerBottomWidth} solid #000;mso-border-top-alt:solid windowtext 1.5pt;mso-border-bottom-alt:solid windowtext ${headerBottomWidth};">${escapeHtml(cell)}</th>`).join("");
    const bodyHtml = bodyRows.map((row, rowIndex) => {
      const bottomBorder = rowIndex === bodyRows.length - 1 ? "border-bottom:1.5pt solid #000;mso-border-bottom-alt:solid windowtext 1.5pt;" : "border-top:none;border-bottom:none;";
      return `<tr>${headers.map((_, index) => `<td style="${cellStyle}${bottomBorder}">${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`;
    }).join("");
    const copiedTitle = settings.showTitle ? `<p align="center" style="${fontStyle}margin:0 0 6pt;text-align:center;">${escapeHtml(title)}</p>` : "";
    const noteHtml = settings.showTableNote ? `<p style="${fontStyle}margin:4pt 0 0;">${escapeHtml(TABLE_NOTE_TEXT)}</p>` : "";
    const html = `<html><head><meta charset="utf-8"></head><body><!--StartFragment--><div style="width:100%;text-align:center;">${copiedTitle}<table align="center" cellspacing="0" cellpadding="0" style="${fontStyle}width:85%;margin-left:auto;margin-right:auto;border-collapse:collapse;border-spacing:0;border-left:none;border-right:none;border-top:1.5pt solid #000;border-bottom:1.5pt solid #000;mso-table-lspace:0pt;mso-table-rspace:0pt;text-align:center;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>${noteHtml}</div><!--EndFragment--></body></html>`;
    const plainText = [...(settings.showTitle ? [title] : []), ...normalized.map((row) => row.join("\t")), ...(settings.showTableNote ? [TABLE_NOTE_TEXT] : [])].join("\n");
    try {
      await copyRichText(html, plainText);
      notify("已复制，可直接粘贴到 Word");
    } catch {
      notify("复制失败，请重试或改用导出图片", undefined, "error");
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
          <div><strong>{homeOpen ? "计算机专业论文图表工作台" : title}</strong><small>{homeOpen ? "本地运行 · 隐私优先 · 为论文而生" : saveWarning || "修改会保存在此浏览器"}</small></div>
        </div>
        <div className="top-actions">
          {homeOpen ? <button className="export-button" onClick={() => setContactOpen(true)}>反馈问题</button> : <>
            <button className="quiet-button" onClick={exportSource}>保存源文件</button>
            <button className="svg-export-button" onClick={exportWorkspace} disabled={backupBusy} title="导出所有图表、样式和布局">导出备份</button>
            <button className="svg-export-button" onClick={() => backupFileInputRef.current?.click()} disabled={backupBusy} title="从备份恢复整个工作区">{backupBusy ? "正在恢复…" : "恢复备份"}</button>
            <input ref={backupFileInputRef} type="file" accept=".json,application/json" hidden onChange={(event) => { void importWorkspace(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
            {isTableTool && <button className="svg-export-button" onClick={copyTableToWord}>复制到 Word</button>}
            <button className="svg-export-button" onClick={exportSvg}>导出 SVG</button>
            <button className="export-button" onClick={exportPng} disabled={exporting} aria-busy={exporting}><span>↓</span> {exporting ? "正在导出…" : "导出高清 PNG"}</button>
          </>}
        </div>
      </header>

      <aside className="tool-sidebar" aria-label="论文图表工具" onPointerDown={startNavDrag} onPointerMove={moveNavDrag} onPointerUp={endNavDrag} onPointerCancel={endNavDrag} onClickCapture={guardNavClick}>
        <nav>
          <button className={`tool-item ${homeOpen ? "active" : ""}`} onClick={openHome} aria-current={homeOpen ? "page" : undefined}>
            <span className="tool-label">首页</span>
          </button>
          {TOOLS.map((item) => (
            <button key={item.id} className={`tool-item ${!homeOpen && tool === item.id ? "active" : ""}`} onClick={() => openTool(item.id)} title={item.name} aria-label={item.name} aria-current={!homeOpen && tool === item.id ? "page" : undefined}>
              <span className="tool-label">{item.short}</span>
            </button>
          ))}
        </nav>
      </aside>

      {homeOpen ? <HomePage onOpenTool={openTool} onContact={() => setContactOpen(true)} /> : <section className="workspace">
        <div className="studio-grid">
          <section className="editor-panel panel">
            <div className="panel-head">
              <div><span className="panel-kicker">SOURCE</span><strong>图表文本</strong></div>
              <div className="editor-head-actions">
                {tool === "er" && <button className="mini-button sql-sample-button" onClick={loadSqlSample}>SQL 示例</button>}
                <button className="mini-button" onClick={restoreSample}>恢复示例</button>
              </div>
            </div>
            <div className="syntax-tip"><span aria-hidden="true">i</span><p>{activeTool.hint}</p>{tool === "er" && <b className={erSqlMode ? "is-sql" : ""}>{erSqlMode ? "SQL 自动识别" : "简洁文本"}</b>}</div>
            <textarea
              value={source}
              onChange={(event) => setSources((current) => ({ ...current, [tool]: event.target.value }))}
              spellCheck={false}
              placeholder={tool === "er" ? "可直接粘贴 MySQL CREATE TABLE 建表语句" : undefined}
              aria-label={`${activeTool.name}文本编辑器`}
            />
            <div className="editor-foot"><span className="parse-state"><i className={`state-dot ${errorCount ? "is-error" : warningCount ? "is-warn" : "is-ok"}`} />{parseStatus}</span><span>{source.length} 字符</span></div>
            {!!diagnostics.length && <details className="parse-diagnostics" open={!!errorCount}>
              <summary>{errorCount ? `${errorCount} 处解析错误` : `${warningCount} 处解析提示`}</summary>
              <ul>{diagnostics.slice(0, 8).map((item, index) => <li key={`${item.level}-${index}`} data-level={item.level}>{item.message}</li>)}</ul>
              {diagnostics.length > 8 && <small>另有 {diagnostics.length - 8} 条提示未展开</small>}
            </details>}
          </section>

          <div className="workspace-splitter" role="slider" aria-label="调整文本区与预览区宽度" aria-orientation="vertical" aria-valuemin={240} aria-valuemax={680} aria-valuenow={Math.round(editorWidth || 380)} aria-valuetext={`文本区 ${Math.round(editorWidth || 380)} 像素`} tabIndex={0} onPointerDown={startPanelResize} onPointerMove={resizePanels} onPointerUp={stopPanelResize} onPointerCancel={stopPanelResize} onDoubleClick={() => { setEditorWidth(null); setEditorCollapsed(false); }} onKeyDown={(event) => {
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
                <div className="preview-mode-item"><span id="toggle-font-bold">字体加粗</span><button className={`switch ${settings.fontBold ? "on" : ""}`} role="switch" aria-checked={settings.fontBold} aria-labelledby="toggle-font-bold" onClick={() => setSettings({ ...settings, fontBold: !settings.fontBold })}><span /></button></div>
                <div className="preview-mode-item"><span id="toggle-uniform-font">统一字号</span><button className={`switch ${settings.uniformFontSize ? "on" : ""}`} role="switch" aria-checked={settings.uniformFontSize} aria-labelledby="toggle-uniform-font" onClick={() => setSettings({ ...settings, uniformFontSize: !settings.uniformFontSize })}><span /></button></div>
                <div className="preview-mode-item"><span id="toggle-show-title">显示图题</span><button className={`switch ${settings.showTitle ? "on" : ""}`} role="switch" aria-checked={settings.showTitle} aria-labelledby="toggle-show-title" onClick={() => setSettings({ ...settings, showTitle: !settings.showTitle })}><span /></button></div>
                {tool === "er" && <div className="preview-mode-item"><span id="toggle-primary-keys">显示主键</span><button className={`switch ${settings.showPrimaryKeys ? "on" : ""}`} role="switch" aria-checked={settings.showPrimaryKeys} aria-labelledby="toggle-primary-keys" onClick={() => setSettings({ ...settings, showPrimaryKeys: !settings.showPrimaryKeys })}><span /></button></div>}
                {tool === "er" && <div className="preview-mode-item"><span id="toggle-er-relations">显示关系</span><button className={`switch ${settings.showRelations ? "on" : ""}`} role="switch" aria-checked={settings.showRelations} aria-labelledby="toggle-er-relations" onClick={() => setSettings({ ...settings, showRelations: !settings.showRelations })}><span /></button></div>}
                {isTableTool && <div className="preview-mode-item"><span id="toggle-table-note">显示注释</span><button className={`switch ${settings.showTableNote ? "on" : ""}`} role="switch" aria-checked={settings.showTableNote} aria-labelledby="toggle-table-note" onClick={() => setSettings({ ...settings, showTableNote: !settings.showTableNote })}><span /></button></div>}
                <div className="preview-mode-item"><span id="toggle-color-mode">彩色模式</span><button className={`switch ${!settings.monochrome ? "on" : ""}`} role="switch" aria-checked={!settings.monochrome} aria-labelledby="toggle-color-mode" onClick={() => setSettings({ ...settings, monochrome: !settings.monochrome, lineWidth: !settings.monochrome ? Math.max(2, settings.lineWidth) : settings.lineWidth })}><span /></button></div>
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
              <div className="canvas-paper" style={{ "--canvas-percent": `${canvasZoom}%`, "--canvas-max-width": `${canvasZoom * 9.2}px` } as CSSProperties}>
                <DiagramDragProvider offsets={dragOffsets[tool] || {}} commit={setToolOffsets}>
                  <Diagram key={`${tool}-${layoutVersion}`} tool={tool} source={source} settings={settings} />
                </DiagramDragProvider>
              </div>
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
            {canvasWidth > 0 && <div className="setting-group print-calibration">
              <div className="setting-heading"><div><strong>版心字号校准</strong><small>按插入 Word 后的实际显示宽度估算</small></div></div>
              <div className="print-inputs">
                <span className="print-input"><em>插入宽度</em><input type="number" min="8" max="22" step="0.5" value={settings.printWidthCm} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) setSettings({ ...settings, printWidthCm: Math.min(22, Math.max(8, next)) }); }} aria-label="图片插入宽度（厘米）" /><i>cm</i></span>
                <span className="print-input"><em>目标字号</em><input type="number" min="5" max="16" step="0.5" value={settings.targetFontPt} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) setSettings({ ...settings, targetFontPt: Math.min(16, Math.max(5, next)) }); }} aria-label="目标字号（磅）" /><i>pt</i></span>
              </div>
              <small className={`calibration-readout ${calibration.tone}`}>{calibration.text}</small>
            </div>}
            {tool === "chart" && <div className="setting-group"><div className="setting-heading"><div><strong>图表类型</strong></div></div><div className="segment" role="group" aria-label="图表类型"><button className={settings.chartType === "bar" ? "active" : ""} aria-pressed={settings.chartType === "bar"} onClick={() => setSettings({ ...settings, chartType: "bar" })}>柱状图</button><button className={settings.chartType === "line" ? "active" : ""} aria-pressed={settings.chartType === "line"} onClick={() => setSettings({ ...settings, chartType: "line" })}>折线图</button></div></div>}
          </aside>
        </div>
      </section>}
      {contactOpen && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 点击遮罩只是鼠标便利操作，Esc 与关闭按钮已提供键盘入口。
        <div className="contact-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactOpen(false); }}>
          <section className="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" aria-describedby="contact-dialog-desc">
            <button ref={contactCloseRef} type="button" className="contact-close" onClick={() => setContactOpen(false)} aria-label="关闭联系作者窗口">×</button>
            <span className="contact-kicker">CONTACT · FEEDBACK</span>
            <h2 id="contact-dialog-title">联系作者</h2>
            <p id="contact-dialog-desc">遇到显示异常、导出失败，或想提新的图表需求，欢迎直接发邮件。附上图表类型、问题描述和截图，会更容易快速定位。</p>
            <div className="contact-address"><small>作者邮箱</small><strong>{CONTACT_EMAIL}</strong></div>
            <div className="contact-actions">
              <button type="button" onClick={() => { void copyContactEmail(); }}>复制邮箱</button>
              <a href={QQ_MAIL_URL} target="_blank" rel="noopener noreferrer">用邮件网页端发送 ↗</a>
            </div>
            <small className="contact-tip">QQ 邮箱网页版会在新标签页打开；也可以先复制邮箱，在任意邮箱中发送。</small>
            <a className="contact-site" href={AUTHOR_SITE} target="_blank" rel="noopener noreferrer">作者主页 · cvetryu.cn ↗</a>
          </section>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tone}`} role="status"><span aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span>{toast.message}{toast.action && <button type="button" onClick={() => { toast.action?.run(); setToast(null); }}>{toast.action.label}</button>}</div>}
    </main>
  );
}
