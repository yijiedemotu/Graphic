"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DiagramSettings, RelationKind } from "@/lib/types";

export type DragPoint = { x: number; y: number };
export type DragOffsets = Record<string, DragPoint>;
type CanvasView = { x: number; y: number; width: number; height: number };
type DragBindOptions = { verticalSnap?: { offsetX: number; guideX: number; threshold?: number } };

const INK = "#26303a";

export const RELATION_MARKERS: Record<RelationKind, { dashed: boolean; start?: string; end?: string }> = {
  association: { dashed: false },
  navigable: { dashed: false, end: "#uml-navigable" },
  dependency: { dashed: true, end: "#uml-navigable" },
  generalization: { dashed: false, end: "#uml-navigable" },
  realization: { dashed: true, end: "#uml-navigable" },
  aggregation: { dashed: false, start: "#uml-diamond" },
  composition: { dashed: false, start: "#uml-diamond-solid" },
};

export function DiagramDefs({ lineWidth, monochrome }: { lineWidth: number; monochrome: boolean }) {
  return (
    <defs>
      {monochrome && <style>{`
        .bw { shape-rendering: geometricPrecision; text-rendering: optimizeLegibility; }
        .bw path, .bw line, .bw polyline, .bw polygon, .bw rect, .bw circle, .bw ellipse { shape-rendering: geometricPrecision; stroke-linejoin: miter; stroke-linecap: square; }
        .bw #arrow path, .bw #uml-navigable path { fill: none !important; stroke: #000 !important; }
        .bw #uml-diamond path { fill: #fff !important; stroke: #000 !important; }
        .bw #uml-diamond-solid path { fill: #000 !important; stroke: #000 !important; }
        .bw [filter] { filter: none !important; }
      `}</style>}
      {/* 箭头统一为开口「>」形：顶点与直线端点重合，避免线端与箭头之间出现空隙。 */}
      <marker id="arrow" markerUnits="userSpaceOnUse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={Math.max(6, lineWidth * 7)} markerHeight={Math.max(6, lineWidth * 7)} orient="auto-start-reverse">
        <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={INK} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="uml-navigable" markerUnits="userSpaceOnUse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={Math.max(6, lineWidth * 7)} markerHeight={Math.max(6, lineWidth * 7)} orient="auto-start-reverse">
        <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={INK} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="uml-diamond" markerUnits="userSpaceOnUse" viewBox="0 0 18 12" refX="1" refY="6" markerWidth="18" markerHeight="12" orient="auto-start-reverse">
        <path d="M1 6 L7 1 L13 6 L7 11 Z" fill="#fff" stroke={INK} strokeWidth={lineWidth} strokeLinejoin="miter" />
      </marker>
      <marker id="uml-diamond-solid" markerUnits="userSpaceOnUse" viewBox="0 0 18 12" refX="1" refY="6" markerWidth="18" markerHeight="12" orient="auto-start-reverse">
        <path d="M1 6 L7 1 L13 6 L7 11 Z" fill={INK} stroke={INK} strokeWidth={lineWidth} strokeLinejoin="miter" />
      </marker>
      <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={INK} floodOpacity="0.12" />
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

export function CanvasFrame({
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
  children: ReactNode;
}) {
  const top = settings.showTitle ? 58 : 24;
  const contentScale = Math.min(2.5, Math.max(.2, settings.overallScale / 100));
  const diagramFontFamily = `"${settings.englishFont}", "${settings.chineseFont}", "Songti SC", serif`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const frame = window.requestAnimationFrame(() => growSvgCanvasToContent(svg));
    return () => window.cancelAnimationFrame(frame);
  });
  // React 会在 width/height 变化时重写 viewBox、背景、标题等属性，绕过冻结。
  // 布局阶段把冻结前的视口写回去，保证拖拽/缩放期间的坐标基准不变。
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const frozen = isSvgCanvasFrozen(svg);
    const view = frozen ? canvasViews.get(svg) : { x: 0, y: 0, width, height };
    if (view) applySvgCanvasView(svg, view);
  }, [width, height]);
  return (
    <svg ref={svgRef} id="diagram-canvas" className={`diagram-svg ${settings.monochrome ? "bw" : ""}`} viewBox={`0 0 ${width} ${height}`} data-base-view-box={`0 0 ${width} ${height}`} fontFamily={diagramFontFamily} shapeRendering="geometricPrecision" textRendering={settings.monochrome ? "optimizeLegibility" : "geometricPrecision"} role="img" aria-label={title}>
      {/* 字重统一由此控制：默认全部常规，开启加粗后全部加粗，覆盖图表内各处的内联字重。 */}
      <style>{`.diagram-svg text { font-weight: ${settings.fontBold ? 700 : 400} !important; }${settings.uniformFontSize ? `.diagram-svg text { font-size: ${settings.fontSize}px !important; }` : ""}`}</style>
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

const canvasAnimations = new WeakMap<SVGSVGElement, number>();
const canvasViews = new WeakMap<SVGSVGElement, CanvasView>();

export function applySvgCanvasView(svg: SVGSVGElement, view: CanvasView) {
  canvasViews.set(svg, view);
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

// 拖拽/缩放期间冻结画布视口：viewBox 一旦变化，拖拽起点与当前点的坐标基准就不再一致，
// 位移会随缩放被放大或缩小。标记挂在 SVG 上，组件卸载后自然失效。
export function setSvgCanvasFrozen(svg: SVGSVGElement | null, frozen: boolean) {
  if (!svg) return;
  if (frozen) svg.dataset.canvasFrozen = "true";
  else delete svg.dataset.canvasFrozen;
}

function isSvgCanvasFrozen(svg: SVGSVGElement) {
  return svg.dataset.canvasFrozen === "true";
}

export function growSvgCanvasToContent(svg: SVGSVGElement) {
  if (!svg.isConnected || isSvgCanvasFrozen(svg)) return;
  const content = svg.querySelector<SVGGElement>("[data-canvas-content]");
  const svgRect = svg.getBoundingClientRect();
  const contentRect = content?.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  if (!contentRect?.width || !svgRect.width || !svgRect.height || !viewBox.width || !viewBox.height) return;

  const margin = 28;
  const left = viewBox.x + (contentRect.left - svgRect.left) * (viewBox.width / svgRect.width) - margin;
  const top = viewBox.y + (contentRect.top - svgRect.top) * (viewBox.height / svgRect.height) - margin;
  const right = viewBox.x + (contentRect.right - svgRect.left) * (viewBox.width / svgRect.width) + margin;
  const bottom = viewBox.y + (contentRect.bottom - svgRect.top) * (viewBox.height / svgRect.height) + margin;
  const next: CanvasView = {
    x: Math.min(viewBox.x, left),
    y: Math.min(viewBox.y, top),
    width: Math.max(viewBox.x + viewBox.width, right) - Math.min(viewBox.x, left),
    height: Math.max(viewBox.y + viewBox.height, bottom) - Math.min(viewBox.y, top),
  };
  if (next.x === viewBox.x && next.y === viewBox.y && next.width === viewBox.width && next.height === viewBox.height) return;
  applySvgCanvasView(svg, next);
}

export function fitSvgCanvasToContent(svg: SVGSVGElement) {
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

export function expandSvgCanvasToContain(element: SVGGElement, clientX: number, clientY: number) {
  const svg = element.ownerSVGElement;
  if (!svg || !element.isConnected) return;
  const svgRect = svg.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  if (!svgRect.width || !svgRect.height || !viewBox.width || !viewBox.height) return;

  if (!isSvgCanvasFrozen(svg)) {
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

type DragStore = {
  offsets: DragOffsets;
  commit: (next: DragOffsets) => void;
};

const DragStoreContext = createContext<DragStore | null>(null);

export function DiagramDragProvider({ offsets, commit, children }: DragStore & { children: ReactNode }) {
  return <DragStoreContext value={{ offsets, commit }}>{children}</DragStoreContext>;
}

export function useSvgDragPositions() {
  const store = useContext(DragStoreContext);
  const [ownedOffsets, setOwnedOffsets] = useState<DragOffsets>({});
  const [verticalGuideX, setVerticalGuideX] = useState<number | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; origin: DragPoint; start: DragPoint } | null>(null);
  const offsets = store?.offsets ?? ownedOffsets;

  const setOffsets = (next: DragOffsets | ((current: DragOffsets) => DragOffsets)) => {
    const value = typeof next === "function" ? next(offsets) : next;
    if (store) store.commit(value);
    else setOwnedOffsets(value);
  };

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

  const refit = (svg: SVGSVGElement | null) => {
    if (!svg) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitSvgCanvasToContent(svg)));
  };

  // 拖动结束只做「必要时扩边」，不做缩放重排，避免松手瞬间画面整体跳一下。
  const settleAfterDrag = (svg: SVGSVGElement | null) => {
    if (!svg) return;
    window.requestAnimationFrame(() => growSvgCanvasToContent(svg));
  };

  const bind = (id: string, label: string, options?: DragBindOptions) => ({
    className: "draggable-group",
    "data-drag-id": id,
    role: "group",
    tabIndex: 0,
    "aria-label": `${label}，可拖动`,
    transform: `translate(${getOffset(id).x} ${getOffset(id).y})`,
    onPointerDown: (event: ReactPointerEvent<SVGGElement>) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest("text")) return;
      event.preventDefault();
      event.stopPropagation();
      const start = svgPoint(event.currentTarget, event.clientX, event.clientY);
      dragRef.current = { id, pointerId: event.pointerId, origin: getOffset(id), start };
      setSvgCanvasFrozen(event.currentTarget.ownerSVGElement, true);
      setVerticalGuideX(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add("is-dragging");
    },
    onPointerMove: (event: ReactPointerEvent<SVGGElement>) => {
      const active = dragRef.current;
      if (!active || active.id !== id || active.pointerId !== event.pointerId) return;
      event.preventDefault();
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
      setSvgCanvasFrozen(event.currentTarget.ownerSVGElement, false);
      setVerticalGuideX(null);
      event.currentTarget.classList.remove("is-dragging");
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      settleAfterDrag(event.currentTarget.ownerSVGElement);
    },
    onPointerCancel: (event: ReactPointerEvent<SVGGElement>) => {
      if (!dragRef.current || dragRef.current.id !== id) return;
      dragRef.current = null;
      setSvgCanvasFrozen(event.currentTarget.ownerSVGElement, false);
      setVerticalGuideX(null);
      event.currentTarget.classList.remove("is-dragging");
      settleAfterDrag(event.currentTarget.ownerSVGElement);
    },
    onDoubleClick: (event: ReactPointerEvent<SVGGElement>) => {
      if (event.target instanceof Element && event.target.closest("text")) return;
      setOffsets((values) => ({ ...values, [id]: { x: 0, y: 0 } }));
      refit(event.currentTarget.ownerSVGElement);
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
  });

  const movePoint = (id: string, point: DragPoint): DragPoint => {
    const offset = getOffset(id);
    return { x: point.x + offset.x, y: point.y + offset.y };
  };

  return { bind, getOffset, movePoint, verticalGuideX };
}
