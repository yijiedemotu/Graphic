"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CanvasFrame, RELATION_MARKERS, expandSvgCanvasToContain, growSvgCanvasToContent, setSvgCanvasFrozen, useSvgDragPositions } from "@/components/DiagramCanvas";
import { TABLE_NOTE_TEXT } from "@/lib/catalog";
import { estimateTextWidth } from "@/lib/layout";
import {
  dfdName,
  parseArchitectureSource,
  parseChartSource,
  parseClassSource,
  parseDeploymentSource,
  parseDfdSource,
  parseErInput,
  parseFlowSource,
  parseModuleSource,
  parseSequenceSource,
  parseTableSource,
  parseTestcaseSource,
  parseUseCaseSource,
  titleFrom,
  type ClassNode,
} from "@/lib/parse";
import type { DiagramSettings, DragPoint, ToolId } from "@/lib/types";

const PALETTE = ["#3157d5", "#ef8b4b", "#2f8f74", "#aa67c7", "#d1a52b"];

function edgePoint(center: DragPoint, toward: DragPoint, halfW: number, halfH: number): DragPoint {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const divisor = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, .001);
  return { x: center.x + dx / divisor, y: center.y + dy / divisor };
}

function ClassDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const { nodes, relations } = parseClassSource(source);
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const titleH = Math.max(settings.fontSize + 18, 42 * borderScale);
  const rowStep = Math.max(19, settings.fontSize + 6);
  const longestCell = Math.max(1, ...nodes.flatMap((node) => [node.name, ...node.attributes, ...node.methods].map((text) => estimateTextWidth(text.trim(), settings.fontSize))));
  const cardW = Math.min(520, Math.max(210 * borderScale, longestCell + 26));
  const cardSize = (node: ClassNode) => {
    const dividerY = titleH + Math.max(1, node.attributes.length) * rowStep + 8;
    return { dividerY, cardH: dividerY + Math.max(1, node.methods.length) * rowStep + 12 };
  };
  const sizes = new Map(nodes.map((node) => [node.name, cardSize(node)]));
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const gapX = 84 * spacing;
  const gapY = 70 * spacing;
  const width = Math.max(760, cols * cardW + (cols - 1) * gapX + 100);
  const rowCount = Math.ceil(nodes.length / cols);
  const rowTops: number[] = [];
  let rowCursor = 28;
  for (let row = 0; row < rowCount; row += 1) {
    rowTops[row] = rowCursor;
    const rowCards = nodes.slice(row * cols, (row + 1) * cols);
    rowCursor += Math.max(1, ...rowCards.map((node) => sizes.get(node.name)!.cardH)) + gapY;
  }
  const positions = new Map(nodes.map((node, index) => [node.name, {
    x: 50 + (index % cols) * (cardW + gapX),
    y: rowTops[Math.floor(index / cols)],
  }]));
  const height = Math.max(520, rowCursor + 60);
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const accent = settings.monochrome ? "#ffffff" : "#eef2ff";

  return (
    <CanvasFrame title={titleFrom(source, "UML 类图")} settings={settings} width={width} height={height}>
      {relations.map((relation, index) => {
        const fromBase = positions.get(relation.from);
        const toBase = positions.get(relation.to);
        if (!fromBase || !toBase) return null;
        const fromCenter = { x: fromBase.x + cardW / 2 + drag.getOffset(`class:${relation.from}`).x, y: fromBase.y + (sizes.get(relation.from)?.cardH ?? titleH) / 2 + drag.getOffset(`class:${relation.from}`).y };
        const toCenter = { x: toBase.x + cardW / 2 + drag.getOffset(`class:${relation.to}`).x, y: toBase.y + (sizes.get(relation.to)?.cardH ?? titleH) / 2 + drag.getOffset(`class:${relation.to}`).y };
        const start = edgePoint(fromCenter, toCenter, cardW / 2, (sizes.get(relation.from)?.cardH ?? titleH) / 2);
        const end = edgePoint(toCenter, fromCenter, cardW / 2, (sizes.get(relation.to)?.cardH ?? titleH) / 2);
        const marker = RELATION_MARKERS[relation.kind];
        return (
          <g key={`${relation.from}-${relation.to}-${index}`}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={ink}
              strokeWidth={settings.lineWidth}
              strokeDasharray={marker.dashed ? "7 5" : undefined}
              markerStart={marker.start ? `url(${marker.start})` : undefined}
              markerEnd={marker.end ? `url(${marker.end})` : undefined}
            />
            {relation.label && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#59636e" paintOrder="stroke" stroke="#fff" strokeWidth="5">{relation.label}</text>}
            {relation.fromMany && <text x={start.x + (end.x > start.x ? 16 : -16)} y={start.y - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill={ink}>{relation.fromMany}</text>}
            {relation.toMany && <text x={end.x + (end.x > start.x ? -16 : 16)} y={end.y - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill={ink}>{relation.toMany}</text>}
          </g>
        );
      })}
      {nodes.map((node) => {
        const point = positions.get(node.name)!;
        const { dividerY, cardH } = sizes.get(node.name)!;
        const stereotype = node.kind === "interface" ? "«interface»" : node.kind === "abstract" ? "«abstract»" : "";
        return (
          <g key={node.name} {...drag.bind(`class:${node.name}`, `${node.name}类`)}>
            <g transform={`translate(${point.x} ${point.y})`} filter="url(#soft-shadow)">
              <rect width={cardW} height={cardH} rx="5" fill="#fff" stroke={ink} strokeWidth={settings.lineWidth} />
              <rect width={cardW} height={titleH} rx="5" fill={accent} stroke={ink} strokeWidth={settings.lineWidth} />
              <rect y={titleH - 5} width={cardW} height="5" fill={accent} />
              {stereotype && <text x={cardW / 2} y={titleH / 2 - 3} textAnchor="middle" fontSize={settings.fontSize - 3} fill={ink}>{stereotype}</text>}
              <text x={cardW / 2} y={stereotype ? titleH / 2 + settings.fontSize : 27} textAnchor="middle" fontSize={settings.fontSize + 1} fontWeight="700" fill={ink} fontStyle={node.kind === "abstract" ? "italic" : undefined}>{node.name}</text>
              <line x1="0" y1={dividerY} x2={cardW} y2={dividerY} stroke={ink} strokeWidth={settings.lineWidth} />
              {node.attributes.map((item, i) => <text key={`${node.name}-attr-${i}`} x="12" y={titleH + rowStep - 5 + i * rowStep} fontSize={settings.fontSize - 2} fill={ink}>{item.trim()}</text>)}
              {node.methods.map((item, i) => <text key={`${node.name}-method-${i}`} x="12" y={dividerY + rowStep - 5 + i * rowStep} fontSize={settings.fontSize - 2} fill={ink}>{item.trim()}</text>)}
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
  const cleanField = (field: string) => field.replace(/\((PK|FK)\)/g, "").trim();
  const ellipseRy = Math.max(settings.fontSize + 10, 28 * borderScale);
  const ellipseRx = (fieldName: string) => {
    const textWidth = estimateTextWidth(fieldName, settings.fontSize);
    const base = Math.max(62, Math.min(92, textWidth * .55 + 24));
    return Math.max(textWidth * .72 + 18, base * borderScale);
  };
  const ringCapacity = (ring: number) => 8 + ring * 4;
  const ringRadius = (ring: number) => ({ rx: (172 + ring * 128) * spacing, ry: (120 + ring * 96) * spacing });
  const attributeLayout = (count: number) => {
    const slots: DragPoint[] = [];
    let remaining = count;
    let ring = 0;
    while (remaining > 0) {
      const inRing = Math.min(remaining, ringCapacity(ring));
      const radius = ringRadius(ring);
      for (let index = 0; index < inRing; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / inRing;
        slots.push({ x: Math.cos(angle) * radius.rx, y: Math.sin(angle) * radius.ry });
      }
      remaining -= inRing;
      ring += 1;
    }
    return { slots, rings: Math.max(1, ring) };
  };
  const layouts = new Map(entities.map((entity) => {
    const layout = attributeLayout(entity.fields.length);
    const widest = Math.max(62, ...entity.fields.map((field) => ellipseRx(cleanField(field))));
    const outer = ringRadius(layout.rings - 1);
    return [entity.name, {
      slots: layout.slots,
      halfW: outer.rx + widest + 18,
      halfH: outer.ry + ellipseRy + 16,
    }];
  }));
  const layoutValues = Array.from(layouts.values());
  const clusterW = Math.max(580 * spacing, 2 * Math.max(210, ...layoutValues.map((layout) => layout.halfW)));
  const clusterH = Math.max(390 * spacing, 2 * Math.max(150, ...layoutValues.map((layout) => layout.halfH)));
  const cols = Math.min(2, Math.max(1, entities.length));
  const rows = Math.max(1, Math.ceil(entities.length / cols));
  const width = Math.max(720, cols * clusterW + 40);
  const height = Math.max(470, rows * clusterH + 70);
  const longestEntityName = Math.max(1, ...entities.map((entity) => estimateTextWidth(entity.name, settings.fontSize + 2)));
  const entityW = Math.max(longestEntityName + 36, 190 * borderScale);
  const entityH = Math.max(settings.fontSize + 24, 62 * borderScale);
  const gridStartX = (width - cols * clusterW) / 2;
  const positions = new Map(entities.map((entity, index) => [entity.name, {
    x: gridStartX + clusterW / 2 + (index % cols) * clusterW,
    y: 20 + clusterH / 2 + Math.floor(index / cols) * clusterH,
  }]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const entityFill = settings.monochrome ? "#ffffff" : "#eaf3ff";
  const relationFill = settings.monochrome ? "#ffffff" : "#f1f7ff";

  const pointOnEntityEdge = (center: DragPoint, target: DragPoint) => {
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    const divisor = Math.max(Math.abs(dx) / (entityW / 2), Math.abs(dy) / (entityH / 2), .001);
    return { x: center.x + dx / divisor, y: center.y + dy / divisor };
  };

  return (
    <CanvasFrame title={titleFrom(source, "E-R 图")} settings={settings} width={width} height={height}>
      {settings.showRelations && relations.map((relation, index) => {
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
        const fromMany = relation.fromMany || "1";
        const toMany = relation.toMany || "n";
        const fromGap = Math.max(24, fromMany.length * Math.max(12, settings.fontSize - 2) * .8 + 12);
        const toGap = Math.max(24, toMany.length * Math.max(12, settings.fontSize - 2) * .8 + 12);
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
          <text x={fromLabelX} y={fromLabelY + 4} fontSize={Math.max(12, settings.fontSize - 2)} fontWeight="700" textAnchor="middle" fill={ink}>{fromMany}</text>
          <text x={toLabelX} y={toLabelY + 4} fontSize={Math.max(12, settings.fontSize - 2)} fontWeight="700" textAnchor="middle" fill={ink}>{toMany}</text>
        </g>;
      })}
      {entities.map((entity) => {
        const basePoint = positions.get(entity.name)!;
        const point = drag.movePoint(`er-entity:${entity.name}`, basePoint);
        const fields = entity.fields;
        const points = layouts.get(entity.name)?.slots ?? [];
        return <g key={entity.name}>
          {fields.map((field, index) => {
            const attribute = points[index];
            const attributeOffset = drag.getOffset(`er-attribute:${entity.name}:${index}`);
            return <line key={`line-${entity.name}-${index}`} x1={point.x} y1={point.y} x2={point.x + attribute.x + attributeOffset.x} y2={point.y + attribute.y + attributeOffset.y} stroke={ink} strokeWidth={settings.lineWidth} />;
          })}
          {fields.map((field, index) => {
            const attribute = points[index];
            const fieldName = cleanField(field);
            const primaryKey = settings.showPrimaryKeys && field.includes("(PK)");
            const ellipseRxValue = ellipseRx(fieldName);
            return <g key={`${entity.name}-${index}`} {...drag.bind(`er-attribute:${entity.name}:${index}`, `${entity.name}的${fieldName}属性`)}>
              <g transform={`translate(${point.x + attribute.x} ${point.y + attribute.y})`}>
                <ellipse rx={ellipseRxValue} ry={ellipseRy} fill="#ffffff" stroke={ink} strokeWidth={settings.lineWidth} />
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
  const { nodes, edges } = parseFlowSource(source);
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const longestNodeName = Math.max(1, ...nodes.map((node) => node.name.length));
  const nodeW = Math.max(longestNodeName * settings.fontSize * .72 + 42, 184 * borderScale);
  const nodeH = Math.max(settings.fontSize + 22, 58 * borderScale);
  const decisionW = Math.max(longestNodeName * settings.fontSize * .48 + 30, 83 * borderScale);
  const decisionH = Math.max(settings.fontSize + 16, 39 * borderScale);
  const verticalHalf = Math.max(nodeH / 2, decisionH);
  const nodeStep = Math.max(verticalHalf * 2 + 18, verticalHalf * 2 + 34 * spacing);
  const branchGap = Math.max(90, 130 * spacing);
  const successors = new Map(nodes.map((node) => [node.name, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.name, 0]));
  edges.forEach((edge) => {
    if (!successors.has(edge.from) || !indegree.has(edge.to)) return;
    successors.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
  });
  const rankByName = new Map<string, number>();
  const assignRanks = (seeds: string[], initialRank: number) => {
    const queue: string[] = [];
    seeds.forEach((name) => {
      if (!rankByName.has(name)) {
        rankByName.set(name, initialRank);
        queue.push(name);
      }
    });
    while (queue.length) {
      const name = queue.shift()!;
      const nextRank = rankByName.get(name)! + 1;
      successors.get(name)?.forEach((next) => {
        if (!rankByName.has(next)) {
          rankByName.set(next, nextRank);
          queue.push(next);
        }
      });
    }
  };
  const roots = nodes.filter((node) => node.type === "start").map((node) => node.name);
  if (!edges.length) {
    nodes.forEach((node, index) => rankByName.set(node.name, index));
  } else {
    assignRanks(roots.length ? roots : nodes.filter((node) => indegree.get(node.name) === 0).map((node) => node.name), 0);
    nodes.forEach((node) => {
      if (rankByName.has(node.name)) return;
      const nextRank = Math.max(-1, ...rankByName.values()) + 1;
      assignRanks([node.name], nextRank);
    });
  }
  const layers = new Map<number, typeof nodes>();
  nodes.forEach((node) => {
    const rank = rankByName.get(node.name) ?? 0;
    layers.set(rank, [...(layers.get(rank) ?? []), node]);
  });
  // Reorder nodes within each rank by the average position of their connected
  // nodes. Repeated top-down and bottom-up sweeps reduce avoidable edge crossings
  // while retaining the rank structure and source order for unconnected nodes.
  const orderedLayers = Array.from(layers.entries()).sort(([a], [b]) => a - b);
  const neighbors = new Map(nodes.map((node) => [node.name, [] as string[]]));
  edges.forEach((edge) => {
    if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) return;
    neighbors.get(edge.from)!.push(edge.to);
    neighbors.get(edge.to)!.push(edge.from);
  });
  const orderByName = () => new Map(orderedLayers.flatMap(([, layer]) => layer.map((node, index) => [node.name, index] as [string, number])));
  for (let sweep = 0; sweep < 6; sweep += 1) {
    const direction = sweep % 2 === 0 ? 1 : -1;
    const currentOrder = direction === 1 ? orderedLayers : [...orderedLayers].reverse();
    for (let layerIndex = 1; layerIndex < currentOrder.length; layerIndex += 1) {
      const [, layer] = currentOrder[layerIndex];
      const order = orderByName();
      const stableIndex = new Map(layer.map((node, index) => [node.name, index]));
      layer.sort((left, right) => {
        const score = (name: string) => {
          const connected = neighbors.get(name)!.map((other) => order.get(other)).filter((value): value is number => value !== undefined);
          return connected.length ? connected.reduce((sum, value) => sum + value, 0) / connected.length : stableIndex.get(name)!;
        };
        return score(left.name) - score(right.name) || stableIndex.get(left.name)! - stableIndex.get(right.name)!;
      });
    }
  }
  const maxRank = Math.max(0, ...layers.keys());
  const widestLayer = Math.max(1, ...Array.from(layers.values(), (layer) => layer.length));
  const width = Math.max(780, widestLayer * nodeW + (widestLayer - 1) * branchGap + 120);
  const height = Math.max(560, (maxRank + 1) * nodeStep + 130);
  const positions = new Map<string, DragPoint>();
  orderedLayers.forEach(([rank, layer]) => {
    const layerWidth = layer.length * nodeW + (layer.length - 1) * branchGap;
    layer.forEach((node, index) => {
      positions.set(node.name, {
        x: (width - layerWidth) / 2 + nodeW / 2 + index * (nodeW + branchGap),
        y: 54 + rank * nodeStep,
      });
    });
  });
  const nodeTypes = new Map(nodes.map((node) => [node.name, node.type]));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const fill = settings.monochrome ? "#ffffff" : "#fff5d8";
  const pointOnNodeEdge = (center: DragPoint, toward: DragPoint, type: string) => {
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (type === "decision") {
      const scale = 1 / Math.max(.001, Math.abs(dx) / decisionW + Math.abs(dy) / decisionH);
      return { x: center.x + dx * scale, y: center.y + dy * scale };
    }
    return edgePoint(center, toward, nodeW / 2, nodeH / 2);
  };
  return <CanvasFrame title={titleFrom(source, "系统流程图")} settings={settings} width={width} height={height}>
    {edges.map((edge, index) => {
      const aBase = positions.get(edge.from);
      const bBase = positions.get(edge.to);
      if (!aBase || !bBase) return null;
      const a = drag.movePoint(`flow:${edge.from}`, aBase);
      const b = drag.movePoint(`flow:${edge.to}`, bBase);
      const start = pointOnNodeEdge(a, b, nodeTypes.get(edge.from) || "process");
      const end = pointOnNodeEdge(b, a, nodeTypes.get(edge.to) || "process");
      return <g key={index}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={ink} strokeWidth={settings.lineWidth} markerEnd="url(#arrow)" />
        {edge.label && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#5d6670" paintOrder="stroke" stroke="#fff" strokeWidth="5">{edge.label}</text>}
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
  const { participants, messages } = parseSequenceSource(source);
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
  const boundaryResizeRef = useRef<{ pointerId: number; clientX: number; clientY: number; width: number; height: number; scaleX: number; scaleY: number; axis: "both" | "horizontal" | "vertical" } | null>(null);
  const boundaryResizeListenersRef = useRef<{ move: (event: PointerEvent) => void; finish: (event: PointerEvent) => void } | null>(null);
  const { system, actors, associations, dependencies, primaryUsecases, secondaryUsecases } = parseUseCaseSource(source);
  const usecases = [...primaryUsecases, ...secondaryUsecases];
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const usecaseRy = Math.max(settings.fontSize * .8 + 10, 16 * borderScale);
  const usecaseRx = (label: string) => Math.max(Array.from(label).length * settings.fontSize * .55 + 14, 44 * borderScale);
  const primaryRx = Math.max(44 * borderScale, ...primaryUsecases.map(usecaseRx));
  const secondaryRx = Math.max(44 * borderScale, ...secondaryUsecases.map(usecaseRx));
  const orderedActors = [...actors];
  const orderedPrimary = [...primaryUsecases];
  const orderedSecondary = [...secondaryUsecases];
  const secondaryToPrimary = new Map(secondaryUsecases.map((usecase) => [usecase, dependencies.filter((link) => link.to === usecase).map((link) => link.from)]));
  // Keep primary use cases in source order so each actor's solid links remain
  // grouped. Sort secondary use cases by their connected primary rows.
  const primaryOrder = new Map(orderedPrimary.map((name, index) => [name, index]));
  orderedSecondary.sort((a, b) => {
    const center = (name: string) => {
      const linked = secondaryToPrimary.get(name)!.map((item) => primaryOrder.get(item)).filter((value): value is number => value !== undefined);
      return linked.length ? linked.reduce((sum, value) => sum + value, 0) / linked.length : secondaryUsecases.indexOf(name);
    };
    return center(a) - center(b) || secondaryUsecases.indexOf(a) - secondaryUsecases.indexOf(b);
  });
  const headerH = Math.max(54, settings.fontSize + 30);
  const rowStep = Math.max(usecaseRy * 2 + 22, 56 * spacing);
  const rowCount = Math.max(1, actors.length, primaryUsecases.length, secondaryUsecases.length);
  const naturalContentH = Math.max(rowCount * rowStep, usecaseRy * 2 + 80);
  const hasSecondary = secondaryUsecases.length > 0;
  const boundaryPad = Math.max(24, 30 * borderScale);
  const columnGap = Math.max(84 * spacing, settings.fontSize * 4);
  const headerW = Math.max(220, Array.from(system).length * Math.max(11, settings.fontSize - 3) * .78 + 60);
  const naturalBoundaryW = Math.max(
    headerW,
    boundaryPad * 2 + primaryRx * 2 + (hasSecondary ? columnGap + secondaryRx * 2 : 0) + 16,
  );
  const naturalBoundaryH = headerH + naturalContentH + 28;
  const minimumBoundaryW = Math.max(
    200,
    boundaryPad * 2 + primaryRx * 2 + (hasSecondary ? Math.max(26, settings.fontSize * 1.9) + secondaryRx * 2 : 0),
  );
  // 边框下限只限制边框本身，内容不随边框重排。
  const minimumContentH = Math.max(
    (rowCount + 1) * usecaseRy * 2 + 8,
    secondaryUsecases.length
      ? (secondaryUsecases.length - 1) * (usecaseRy * 2 + 12) + usecaseRy * 2 + 16
      : 0,
    usecaseRy * 2 + 16,
  );
  const minimumBoundaryH = headerH + minimumContentH + 28;
  const boundaryW = Math.max(minimumBoundaryW, customBoundarySize?.width ?? naturalBoundaryW);
  const boundaryH = Math.max(minimumBoundaryH, customBoundarySize?.height ?? naturalBoundaryH);
  // 边框与内容解耦：内容始终按自然布局摆放，收放边框只改变框本身。
  const contentH = naturalContentH;
  const actorZone = Math.max(190, 185 * borderScale);
  const width = Math.max(900, actorZone + boundaryW + 70);
  const height = Math.max(620, boundaryH + 80);
  const boundaryX = actorZone;
  const boundaryY = 18;
  const primaryX = boundaryX + boundaryPad + primaryRx;
  const secondaryX = boundaryX + naturalBoundaryW - boundaryPad - secondaryRx;
  const columnTop = boundaryY + headerH;
  const columnY = (index: number, count: number) => columnTop + (contentH * (index + (rowCount - count) / 2 + 1)) / (rowCount + 1);
  const primaryPositions = orderedPrimary.map((item, index) => [item, { x: primaryX, y: columnY(index, orderedPrimary.length) }] as [string, DragPoint]);
  const primaryY = new Map(primaryPositions.map(([name, point]) => [name, point.y]));
  const secondaryTargets = orderedSecondary.map((name, index) => {
    const linkedY = secondaryToPrimary.get(name)!.map((item) => primaryY.get(item)).filter((value): value is number => value !== undefined);
    const y = linkedY.length ? linkedY.reduce((sum, value) => sum + value, 0) / linkedY.length : columnY(index, orderedSecondary.length);
    return { name, y };
  }).sort((a, b) => a.y - b.y || orderedSecondary.indexOf(a.name) - orderedSecondary.indexOf(b.name));
  const minSecondaryGap = usecaseRy * 2 + 12;
  const minContentY = columnTop + usecaseRy + 8;
  const maxContentY = columnTop + contentH - usecaseRy - 8;
  const secondaryY = secondaryTargets.map((item) => Math.max(minContentY, Math.min(maxContentY, item.y)));
  for (let index = 1; index < secondaryY.length; index += 1) secondaryY[index] = Math.max(secondaryY[index], secondaryY[index - 1] + minSecondaryGap);
  if (secondaryY.length && secondaryY[secondaryY.length - 1] > maxContentY) {
    secondaryY[secondaryY.length - 1] = maxContentY;
    for (let index = secondaryY.length - 2; index >= 0; index -= 1) secondaryY[index] = Math.min(secondaryY[index], secondaryY[index + 1] - minSecondaryGap);
  }
  const usePositions = new Map<string, DragPoint>([
    ...primaryPositions,
    ...secondaryTargets.map(({ name }, index) => [name, { x: secondaryX, y: secondaryY[index] }] as [string, DragPoint]),
  ]);
  const figureScale = Math.max(.75, borderScale);
  const actorTargets = orderedActors.map((actor, index) => {
    const linkedY = associations
      .filter((relation) => relation.from === actor)
      .map((relation) => usePositions.get(relation.to)?.y)
      .filter((value): value is number => value !== undefined);
    const y = linkedY.length ? linkedY.reduce((sum, value) => sum + value, 0) / linkedY.length : columnY(index, orderedActors.length);
    return { actor, y };
  }).sort((a, b) => a.y - b.y || orderedActors.indexOf(a.actor) - orderedActors.indexOf(b.actor));
  const actorGap = 116 * figureScale;
  const actorMinY = columnTop + 32 * figureScale;
  const actorMaxY = columnTop + contentH - 62 * figureScale;
  const actorY = actorTargets.map((item) => Math.max(actorMinY, Math.min(actorMaxY, item.y)));
  for (let index = 1; index < actorY.length; index += 1) actorY[index] = Math.max(actorY[index], actorY[index - 1] + actorGap);
  if (actorY.length && actorY[actorY.length - 1] > actorMaxY) {
    actorY[actorY.length - 1] = actorMaxY;
    for (let index = actorY.length - 2; index >= 0; index -= 1) actorY[index] = Math.min(actorY[index], actorY[index + 1] - actorGap);
  }
  const actorPositions = new Map(actorTargets.map(({ actor }, index) => [actor, {
    x: boundaryX - actorZone * .48,
    y: actorY[index],
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
      axis: (event.currentTarget.dataset.resizeAxis || "both") as "both" | "horizontal" | "vertical",
    };
    setSvgCanvasFrozen(event.currentTarget.ownerSVGElement, true);
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => {
      const active = boundaryResizeRef.current;
      if (!active || active.pointerId !== moveEvent.pointerId) return;
      moveEvent.preventDefault();
      const nextWidth = active.axis === "vertical" ? active.width : Math.min(3600, Math.max(minimumBoundaryW, active.width + (moveEvent.clientX - active.clientX) / active.scaleX));
      const nextHeight = active.axis === "horizontal" ? active.height : Math.min(3600, Math.max(minimumBoundaryH, active.height + (moveEvent.clientY - active.clientY) / active.scaleY));
      setCustomBoundarySize({ width: Math.round(nextWidth), height: Math.round(nextHeight) });
      window.requestAnimationFrame(() => expandSvgCanvasToContain(target, moveEvent.clientX, moveEvent.clientY));
    };
    const finish = () => {
      if (!boundaryResizeRef.current) return;
      boundaryResizeRef.current = null;
      // 结束路径一律解冻，避免异常指针序列让画布卡在冻结状态。
      setSvgCanvasFrozen(target.ownerSVGElement, false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      boundaryResizeListenersRef.current = null;
      const svg = target.ownerSVGElement;
      if (svg) window.requestAnimationFrame(() => growSvgCanvasToContent(svg));
    };
    boundaryResizeListenersRef.current = { move, finish };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
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
  useEffect(() => () => {
    const listeners = boundaryResizeListenersRef.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.finish);
    window.removeEventListener("pointercancel", listeners.finish);
    boundaryResizeRef.current = null;
  }, []);
  const boundaryHandles = (["both", "horizontal", "vertical"] as const).map((axis) => {
    const rect = axis === "both"
      ? { x: boundaryX + boundaryW - 22, y: boundaryY + boundaryH - 22, width: 44, height: 44, cursor: "nwse-resize" }
      : axis === "horizontal"
        ? { x: boundaryX + boundaryW - 12, y: boundaryY + boundaryH / 2 - 24, width: 24, height: 48, cursor: "ew-resize" }
        : { x: boundaryX + boundaryW / 2 - 24, y: boundaryY + boundaryH - 12, width: 48, height: 24, cursor: "ns-resize" };
    return <g key={axis} className="usecase-resize-handle" data-resize-axis={axis} data-export-ignore="true" role="button" tabIndex={0} aria-label={axis === "vertical" ? "调整系统边界高度" : axis === "horizontal" ? "调整系统边界宽度" : `调整系统边界大小，当前 ${Math.round(boundaryW)} × ${Math.round(boundaryH)}`} onPointerDown={startBoundaryResize} onKeyDown={resizeBoundaryByKeyboard}>
      {axis === "both" && <title>拖动右下角调整系统边界大小</title>}
      <rect {...rect} fill="transparent" />
    </g>;
  });
  const boundaryOffset = drag.getOffset("usecase:boundary");
  return <CanvasFrame title={titleFrom(source, "系统用例图")} settings={settings} width={width} height={height}>
    <g {...drag.bind("usecase:boundary", `${system}边界`)}>
      <rect x={boundaryX} y={boundaryY} width={boundaryW} height={boundaryH} rx={2 * borderScale} fill={boundaryFill} stroke={ink} strokeWidth={settings.lineWidth} />
    </g>
    {associations.map((relation, index) => {
      const aBase = actorPositions.get(relation.from);
      const uBase = usePositions.get(relation.to);
      if (!aBase || !uBase) return null;
      const a = drag.movePoint(`usecase-actor:${relation.from}`, aBase);
      const u = drag.movePoint(`usecase-item:${relation.to}`, uBase);
      const start = { x: a.x + 20 * figureScale, y: a.y - 5 * figureScale };
      const dx = u.x - start.x;
      const dy = u.y - start.y;
      const ellipseScale = 1 / Math.max(.001, Math.hypot(dx / usecaseRx(relation.to), dy / usecaseRy));
      const end = { x: u.x - dx * ellipseScale, y: u.y - dy * ellipseScale };
      return <line key={`${relation.sourceIndex}-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={mutedInk} strokeWidth={settings.lineWidth} markerEnd="url(#uml-navigable)" />;
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
        ? { x: to.x - directionX * usecaseRx(relation.to), y: to.y }
        : { x: to.x, y: to.y - directionY * usecaseRy };
      const labelX = (start.x + end.x) / 2;
      const labelY = (start.y + end.y) / 2 - Math.max(10, settings.fontSize * .75);
      const label = relation.kind === "extend" ? "«extend»" : "«include»";
      return <g key={`${relation.sourceIndex}-${index}`}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={mutedInk} strokeWidth={Math.max(settings.lineWidth, 1.7)} strokeDasharray="10 5" strokeLinecap="round" markerEnd="url(#uml-navigable)" />
        <text x={labelX} y={labelY} textAnchor="middle" fontSize={Math.max(10, settings.fontSize - 3)} fill={ink} paintOrder="stroke" stroke={boundaryFill} strokeWidth="4" strokeLinejoin="round">{label}</text>
      </g>;
    })}
    {actors.map((actor) => {
      const p = actorPositions.get(actor)!;
      return <g key={actor} {...drag.bind(`usecase-actor:${actor}`, `${actor}角色`)}><g transform={`translate(${p.x} ${p.y})`}><circle cx="0" cy={-28 * figureScale} r={10 * figureScale} fill={boundaryFill} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={-18 * figureScale} x2="0" y2={20 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1={-20 * figureScale} y1={-5 * figureScale} x2={20 * figureScale} y2={-5 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={20 * figureScale} x2={-17 * figureScale} y2={43 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><line x1="0" y1={20 * figureScale} x2={17 * figureScale} y2={43 * figureScale} stroke={ink} strokeWidth={settings.lineWidth} /><text x="0" y={63 * figureScale} textAnchor="middle" fontSize={settings.fontSize} fontWeight="600" fill={ink}>{actor}</text></g></g>;
    })}
    {usecases.map((usecase) => {
      const p = usePositions.get(usecase)!;
      return <g key={usecase} {...drag.bind(`usecase-item:${usecase}`, `${usecase}用例`)} filter="url(#soft-shadow)"><ellipse cx={p.x} cy={p.y} rx={usecaseRx(usecase)} ry={usecaseRy} fill={usecaseFill} stroke={ink} strokeWidth={settings.lineWidth} /><text x={p.x} y={p.y + settings.fontSize * .34} textAnchor="middle" fontSize={settings.fontSize} fontWeight="600" fill={ink}>{usecase}</text></g>;
    })}
    {/* 手柄置于内容之上：边框缩小后角落可能压住用例椭圆，仍要能抓住。 */}
    <g data-export-ignore="true" transform={`translate(${boundaryOffset.x} ${boundaryOffset.y})`}>{boundaryHandles}</g>
  </CanvasFrame>;
}

function FunctionModuleDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const { system, groups } = parseModuleSource(source);
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
  const groupCenters = groups.reduce<number[]>((centers, _group, groupIndex) => {
    const left = centers.length ? centers[centers.length - 1] + spans[groupIndex - 1] / 2 + groupGap : (width - contentW) / 2;
    return [...centers, left + spans[groupIndex] / 2];
  }, []);
  const groupLayouts = groups.map((group, groupIndex) => {
    const centerX = groupCenters[groupIndex];
    const itemTotalW = group.items.length * leafW + Math.max(0, group.items.length - 1) * leafGap;
    const itemStartX = centerX - itemTotalW / 2 + leafW / 2;
    const items = group.items.map((item, itemIndex) => ({
      label: item,
      id: `module-item:${groupIndex}:${itemIndex}`,
      base: { x: itemStartX + itemIndex * (leafW + leafGap), y: leafCenterY } as DragPoint,
    }));
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
  const { layers } = parseArchitectureSource(source);
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

function ThreeLineTable({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const parsed = parseTableSource(source);
  const columns = Math.max(1, parsed.columns);
  const rows = parsed.rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ""));
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const weights = Array.from({ length: columns }, (_, index) => Math.max(
    68,
    Math.max(1, ...rows.map((row) => Array.from(row[index] ?? "").length)) * settings.fontSize * .62 + 26,
  ));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const tableW = Math.max(750 * spacing, weightTotal);
  const columnW = weights.map((weight) => (weight / weightTotal) * tableW);
  const width = Math.max(860, tableW + 110);
  const left = (width - tableW) / 2;
  const columnLeft = (index: number) => left + columnW.slice(0, index).reduce((sum, weight) => sum + weight, 0);
  const right = left + tableW;
  const showNote = settings.showTableNote;
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
    {rows.map((row, rowIndex) => <g key={rowIndex} {...drag.bind(`table-row:${rowIndex}`, `表格第${rowIndex + 1}行`)}>{row.map((cell, columnIndex) => <text key={`${rowIndex}-${columnIndex}`} x={columnLeft(columnIndex) + columnW[columnIndex] / 2} y={y + rowIndex * rowH + rowH / 2 + 6} textAnchor="middle" fontSize={settings.fontSize} fontWeight={rowIndex === 0 ? "700" : "400"} fill={ink}>{cell}</text>)}</g>)}
    <line x1={left} y1={y + rows.length * rowH} x2={right} y2={y + rows.length * rowH} stroke={ink} strokeWidth={outerLineWidth} />
    {showNote && <g {...drag.bind("table-note", "表格注释")}><text x={left} y={y + rows.length * rowH + 36} fontSize={settings.fontSize - 2} fill="#69727c">{TABLE_NOTE_TEXT}</text></g>}
  </CanvasFrame>;
}

function wrapCellText(value: string, width: number, fontSize: number) {
  const maxWidth = Math.max(24, width - 20);
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const character of Array.from(paragraph)) {
      if (line && estimateTextWidth(line + character, fontSize) > maxWidth) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else {
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines.length ? lines : [""];
}

function TestCaseTable({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const parsed = parseTestcaseSource(source);
  const columns = Math.max(1, parsed.columns);
  const rows = parsed.rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ""));
  const headers = rows[0] ?? [];
  const weights = Array.from({ length: columns }, (_, index) => {
    const header = headers[index] ?? "";
    if (header.includes("编号")) return .75;
    if (header.includes("功能")) return 1;
    if (header.includes("步骤")) return 1.45;
    if (header.includes("输入")) return 1.15;
    if (header.includes("预期")) return 1.65;
    if (header.includes("实际")) return 1.4;
    if (header.includes("结论")) return .75;
    return 1;
  });
  const tableW = Math.max(1120, columns * 140);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const columnW = weights.map((weight) => (weight / weightTotal) * tableW);
  const columnLeft = (index: number) => columnW.slice(0, index).reduce((sum, width) => sum + width, 0);
  const lineHeight = settings.fontSize + 5;
  const wrappedRows = rows.map((row) => row.map((cell, column) => wrapCellText(cell, columnW[column], settings.fontSize)));
  const rowHeights = wrappedRows.map((row) => Math.max(settings.fontSize + 22, Math.max(1, ...row.map((lines) => lines.length)) * lineHeight + 16));
  const top = 34;
  const tableHeight = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
  const width = Math.max(900, tableW + 100);
  const left = (width - tableW) / 2;
  const height = Math.max(440, top + tableHeight + 80);
  const ink = settings.monochrome ? "#000000" : "#26303a";
  // 本科论文三线表标准：顶线/底线 1.5pt，栏目线 0.75pt。按目标打印宽度换算成画布单位，
  // 保证导出后按 printWidthCm 插入 Word 时线宽符合磅值，而不是随线条粗细滑杆漂移。
  const unitsPerPt = width / ((settings.printWidthCm / 2.54) * 72);
  const outerLineWidth = unitsPerPt * 1.5;
  const headerLineWidth = unitsPerPt * 0.75;
  const rowTops = rowHeights.map((_, index) => top + rowHeights.slice(0, index).reduce((sum, rowHeight) => sum + rowHeight, 0));

  return <CanvasFrame title={titleFrom(source, "软件测试用例表")} settings={settings} width={width} height={height}>
    {wrappedRows.map((row, rowIndex) => {
      const currentTop = rowTops[rowIndex];
      const rowHeight = rowHeights[rowIndex];
      return <g key={rowIndex} {...drag.bind(`testcase-row:${rowIndex}`, rowIndex === 0 ? "测试用例表头" : `测试用例第${rowIndex}行`)}>
        {rowIndex === 0 && <rect x={left} y={currentTop} width={tableW} height={rowHeight} fill={settings.monochrome ? "#ffffff" : "#f4f6fa"} />}
        {row.map((lines, columnIndex) => {
          const isVerdict = headers[columnIndex]?.includes("结论");
          const cellText = rows[rowIndex][columnIndex];
          const verdictColor = settings.monochrome ? ink : /通过|成功|与预期一致|符合预期|pass/i.test(cellText) ? "#18794e" : /失败|未通过|待修复|fail/i.test(cellText) ? "#b42318" : /待测|未执行|进行中/i.test(cellText) ? "#9a6700" : ink;
          const firstBaseline = currentTop + rowHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + settings.fontSize * .34;
          return <text key={columnIndex} x={left + columnLeft(columnIndex) + columnW[columnIndex] / 2} y={firstBaseline} textAnchor="middle" fontSize={settings.fontSize} fontWeight={rowIndex === 0 || isVerdict ? "700" : "400"} fill={isVerdict ? verdictColor : ink}>
            {lines.map((line, lineIndex) => <tspan key={lineIndex} x={left + columnLeft(columnIndex) + columnW[columnIndex] / 2} dy={lineIndex === 0 ? 0 : lineHeight}>{line}</tspan>)}
          </text>;
        })}
        {rowIndex === 0 && <line x1={left} y1={currentTop + rowHeight} x2={left + tableW} y2={currentTop + rowHeight} stroke={ink} strokeWidth={headerLineWidth} />}
      </g>;
    })}
    {/* 顶线画在表头底色之后，避免被表头填充遮掉一半、看起来比底线细。 */}
    <line x1={left} y1={top} x2={left + tableW} y2={top} stroke={ink} strokeWidth={outerLineWidth} />
    <line x1={left} y1={top + tableHeight} x2={left + tableW} y2={top + tableHeight} stroke={ink} strokeWidth={outerLineWidth} />
  </CanvasFrame>;
}

function DataChart({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const { headers, values, series, minValue, maxValue } = parseChartSource(source);
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
  const domainMin = minValue === maxValue ? 0 : minValue;
  const domainMax = minValue === maxValue ? 1 : maxValue;
  const domainRange = domainMax - domainMin;
  const yForValue = (value: number) => top + ((domainMax - value) / domainRange) * chartH;
  const zeroY = yForValue(0);
  const formatTick = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return <CanvasFrame title={titleFrom(source, "实验数据图")} settings={settings} width={width} height={height}>
    {[0, 1, 2, 3, 4, 5].map((tick) => {
      const value = domainMax - (tick / 5) * domainRange;
      const y = yForValue(value);
      return <g key={tick}><line x1={left} y1={y} x2={left + chartW} y2={y} stroke={Math.abs(value) < domainRange * .001 ? "#aeb9c4" : "#d9dde2"} strokeWidth={Math.abs(value) < domainRange * .001 ? 1.5 : 1} /><text x={left - 13} y={y + 4} textAnchor="end" fontSize={settings.fontSize - 2} fill="#66717b">{formatTick(value)}</text></g>;
    })}
    <line x1={left} y1={top} x2={left} y2={top + chartH} stroke={ink} strokeWidth={settings.lineWidth} />
    <line x1={left} y1={zeroY} x2={left + chartW} y2={zeroY} stroke={ink} strokeWidth={settings.lineWidth} />
    {settings.chartType === "bar" && values.flatMap((row, rowIndex) => series.map((_, seriesIndex) => {
      const value = Number(row[seriesIndex + 1]) || 0;
      const groupW = xStep * 0.68;
      const barW = groupW / Math.max(1, series.length);
      const x = left + rowIndex * xStep + (xStep - groupW) / 2 + seriesIndex * barW;
      const valueY = yForValue(value);
      const barY = Math.min(zeroY, valueY);
      const barH = Math.max(1, Math.abs(valueY - zeroY));
      return <g key={`${rowIndex}-${seriesIndex}`} {...drag.bind(`chart-bar:${rowIndex}:${seriesIndex}`, `${row[0]}的${series[seriesIndex]}柱形`)}><rect data-bw-preserve={settings.monochrome ? "true" : undefined} x={x} y={barY} width={Math.max(6, barW - 3)} height={barH} fill={colors[seriesIndex % colors.length]} stroke={settings.monochrome ? "#000" : "none"} strokeWidth={settings.monochrome ? 1.5 : 0} rx="2" /></g>;
    }))}
    {settings.chartType === "line" && series.map((_, seriesIndex) => {
      const points = values.map((row, rowIndex) => `${left + rowIndex * xStep + xStep / 2},${yForValue(Number(row[seriesIndex + 1]) || 0)}`).join(" ");
      const seriesColor = settings.monochrome ? "#000" : colors[seriesIndex % colors.length];
      return <g key={seriesIndex} {...drag.bind(`chart-line:${seriesIndex}`, `${series[seriesIndex]}折线`)}><polyline points={points} fill="none" stroke={seriesColor} strokeDasharray={settings.monochrome ? linePatterns[seriesIndex % linePatterns.length] : undefined} strokeWidth={settings.lineWidth + 1} /><>{values.map((row, rowIndex) => <circle key={rowIndex} cx={left + rowIndex * xStep + xStep / 2} cy={yForValue(Number(row[seriesIndex + 1]) || 0)} r="4" fill="#fff" stroke={seriesColor} strokeWidth="3" />)}</></g>;
    })}
    {values.map((row, index) => <g key={row[0]} {...drag.bind(`chart-label:${index}`, `${row[0]}横轴标签`)}><text x={left + index * xStep + xStep / 2} y={top + chartH + labelOffsetY} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#56616c">{row[0]}</text></g>)}
    {series.map((item, index) => <g key={item} {...drag.bind(`chart-legend:${index}`, `${item}图例`)}><g transform={`translate(${left + index * legendStep} ${top + chartH + legendOffsetY})`}>{settings.chartType === "bar" ? <rect data-bw-preserve={settings.monochrome ? "true" : undefined} width="18" height="10" rx="2" fill={colors[index % colors.length]} stroke={settings.monochrome ? "#000" : "none"} /> : <line x1="0" y1="5" x2="20" y2="5" stroke={settings.monochrome ? "#000" : colors[index % colors.length]} strokeDasharray={settings.monochrome ? linePatterns[index % linePatterns.length] : undefined} strokeWidth="3" />}<text x="27" y="10" fontSize={settings.fontSize - 1} fill={ink}>{item}</text></g></g>)}
    <g {...drag.bind("chart-axis-title", "横轴标题")}><text x={left + chartW / 2} y={top + chartH + axisTitleOffsetY} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#6a737d">{headers[0]}</text></g>
  </CanvasFrame>;
}

function DataFlowDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const { externals, processes, stores, flows } = parseDfdSource(source);
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const fill = settings.monochrome ? "#ffffff" : "#f6f9ff";
  const processFill = settings.monochrome ? "#ffffff" : "#fff5d8";
  const boxH = Math.max(settings.fontSize + 24, 56 * borderScale);
  const boxW = (name: string) => Math.max(Array.from(name).length * settings.fontSize * .72 + 34, 152 * borderScale);
  const processR = Math.max(settings.fontSize * 2.2, 46 * borderScale);
  const rowStep = Math.max(boxH + 54 * spacing, processR * 2 + 34 * spacing);
  const gapX = 150 * spacing;
  const columnW = [
    Math.max(170 * borderScale, ...externals.map((element) => boxW(element.name))),
    processR * 2,
    Math.max(170 * borderScale, ...stores.map((element) => boxW(element.name))),
  ];
  const totalW = columnW[0] + columnW[1] + columnW[2] + gapX * 2;
  const width = Math.max(900, totalW + 160);
  const leftEdge = (width - totalW) / 2;
  const columnCenter = [
    leftEdge + columnW[0] / 2,
    leftEdge + columnW[0] + gapX + columnW[1] / 2,
    leftEdge + columnW[0] + columnW[1] + gapX * 2 + columnW[2] / 2,
  ];
  const top = 34;
  const rowCount = Math.max(1, externals.length, processes.length, stores.length);
  const height = Math.max(520, top + rowCount * rowStep + 90);

  type Geo = { id: string; center: DragPoint; halfW: number; halfH: number; shape: "box" | "process" | "store" };
  const geometry = new Map<string, Geo>();
  ([[externals, 0, "box"], [processes, 1, "process"], [stores, 2, "store"]] as const).forEach(([list, column, shape]) => {
    list.forEach((element, index) => {
      const id = `dfd:${dfdName(element)}`;
      const center = { x: columnCenter[column], y: top + rowStep / 2 + index * rowStep };
      const geo: Geo = shape === "process"
        ? { id, center, halfW: processR, halfH: processR, shape }
        : { id, center, halfW: boxW(element.name) / 2, halfH: boxH / 2, shape };
      geometry.set(dfdName(element), geo);
      geometry.set(element.name, geo);
    });
  });
  const movedCenter = (geo: Geo): DragPoint => {
    const offset = drag.getOffset(geo.id);
    return { x: geo.center.x + offset.x, y: geo.center.y + offset.y };
  };
  const edgeOf = (geo: Geo, toward: DragPoint): DragPoint => {
    const center = movedCenter(geo);
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (geo.shape === "process") {
      const distance = Math.max(1, Math.hypot(dx, dy));
      return { x: center.x + (dx / distance) * geo.halfW, y: center.y + (dy / distance) * geo.halfH };
    }
    return edgePoint(center, toward, geo.halfW, geo.halfH);
  };

  return <CanvasFrame title={titleFrom(source, "系统数据流图")} settings={settings} width={width} height={height}>
    {flows.map((flow, index) => {
      const from = geometry.get(flow.from);
      const to = geometry.get(flow.to);
      if (!from || !to) return null;
      const start = edgeOf(from, movedCenter(to));
      const end = edgeOf(to, movedCenter(from));
      return <g key={`dfd-flow-${index}`}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={ink} strokeWidth={settings.lineWidth} strokeDasharray={flow.dashed ? "7 5" : undefined} markerEnd="url(#arrow)" />
        {flow.label && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7} textAnchor="middle" fontSize={settings.fontSize - 2} fill={ink} paintOrder="stroke" stroke="#fff" strokeWidth="5">{flow.label}</text>}
      </g>;
    })}
    {externals.map((element) => {
      const geo = geometry.get(dfdName(element))!;
      return <g key={`external-${element.name}`} {...drag.bind(geo.id, `${element.name}外部实体`)}><g transform={`translate(${geo.center.x} ${geo.center.y})`}><rect x={-geo.halfW} y={-geo.halfH} width={geo.halfW * 2} height={geo.halfH * 2} fill={fill} stroke={ink} strokeWidth={settings.lineWidth} /><text textAnchor="middle" y={settings.fontSize * .34} fontSize={settings.fontSize} fontWeight="700" fill={ink}>{element.name}</text></g></g>;
    })}
    {processes.map((element) => {
      const geo = geometry.get(dfdName(element))!;
      return <g key={`process-${dfdName(element)}`} {...drag.bind(`dfd:${dfdName(element)}`, `${element.name}处理过程`)}><g transform={`translate(${geo.center.x} ${geo.center.y})`}><circle r={processR} fill={processFill} stroke={ink} strokeWidth={settings.lineWidth} />{element.id && <text textAnchor="middle" y={-settings.fontSize * .5} fontSize={settings.fontSize - 3} fill={ink}>{element.id}</text>}<text textAnchor="middle" y={settings.fontSize * .55} fontSize={settings.fontSize - 1} fontWeight="700" fill={ink}>{element.name}</text></g></g>;
    })}
    {stores.map((element) => {
      const geo = geometry.get(dfdName(element))!;
      const idW = Math.min(geo.halfW * .45, 46);
      return <g key={`store-${dfdName(element)}`} {...drag.bind(`dfd:${dfdName(element)}`, `${element.name}数据存储`)}><g transform={`translate(${geo.center.x} ${geo.center.y})`}><rect x={-geo.halfW} y={-geo.halfH} width={geo.halfW * 2} height={geo.halfH * 2} fill={fill} stroke="none" /><rect x={-geo.halfW} y={-geo.halfH} width={geo.halfW * 2} height={geo.halfH * 2} fill="none" stroke={ink} strokeWidth={settings.lineWidth} /><line x1={-geo.halfW + idW} y1={-geo.halfH} x2={-geo.halfW + idW} y2={geo.halfH} stroke={ink} strokeWidth={settings.lineWidth} /><text x={-geo.halfW + idW / 2} textAnchor="middle" y={settings.fontSize * .34} fontSize={settings.fontSize - 2} fontWeight="700" fill={ink}>{element.id}</text><text x={(idW - geo.halfW) / 2} textAnchor="middle" y={settings.fontSize * .34} fontSize={settings.fontSize - 1} fontWeight="600" fill={ink}>{element.name}</text></g></g>;
    })}
    {!processes.length && <text x={width / 2} y="120" textAnchor="middle" fontSize={settings.fontSize} fill="#687b8f">请使用 process 1.0 处理名、external 外部实体、store D1 数据存储</text>}
  </CanvasFrame>;
}

function DeploymentDiagram({ source, settings }: { source: string; settings: DiagramSettings }) {
  const drag = useSvgDragPositions();
  const { nodes, links } = parseDeploymentSource(source);
  const spacing = Math.min(3, Math.max(.3, settings.spacingScale / 100));
  const borderScale = Math.min(2.6, Math.max(.4, settings.borderScale / 100));
  const ink = settings.monochrome ? "#000000" : "#26303a";
  const nodeFill = settings.monochrome ? "#ffffff" : "#f3f7fc";
  const componentFill = settings.monochrome ? "#ffffff" : "#eef6ff";
  const titleH = Math.max(settings.fontSize + 22, 46 * borderScale);
  const componentH = Math.max(settings.fontSize + 14, 34 * borderScale);
  const componentGap = Math.max(8, 12 * spacing);
  const textW = (value: string) => Array.from(value).length * settings.fontSize * .68 + 44;
  const nodeW = (node: typeof nodes[number]) => Math.max(
    textW(node.name),
    ...node.components.map(textW),
    220 * borderScale,
  );
  const nodeH = (node: typeof nodes[number]) => titleH + 16 + Math.max(1, node.components.length) * (componentH + componentGap) + 12;
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const gapX = 110 * spacing;
  const gapY = 92 * spacing;
  const width = Math.max(880, cols * Math.max(220 * borderScale, ...nodes.map(nodeW)) + (cols - 1) * gapX + 100);
  const rowCount = Math.ceil(nodes.length / cols);
  const rowTops: number[] = [];
  let rowCursor = 30;
  for (let row = 0; row < rowCount; row += 1) {
    rowTops[row] = rowCursor;
    rowCursor += Math.max(1, ...nodes.slice(row * cols, (row + 1) * cols).map(nodeH)) + gapY;
  }
  const height = Math.max(520, rowCursor + 50);
  const positions = new Map(nodes.map((node, index) => {
    const column = index % cols;
    const columnW = Math.max(220 * borderScale, ...nodes.map(nodeW));
    return [node.name, { x: (width - (cols * columnW + (cols - 1) * gapX)) / 2 + column * (columnW + gapX) + (columnW - nodeW(node)) / 2, y: rowTops[Math.floor(index / cols)] }] as const;
  }));

  const movedRect = (node: typeof nodes[number]) => {
    const base = positions.get(node.name)!;
    const offset = drag.getOffset(`deployment:${node.name}`);
    return {
      x: base.x + offset.x,
      y: base.y + offset.y,
      w: nodeW(node),
      h: nodeH(node),
      center: { x: base.x + offset.x + nodeW(node) / 2, y: base.y + offset.y + nodeH(node) / 2 },
    };
  };

  return <CanvasFrame title={titleFrom(source, "UML 部署图")} settings={settings} width={width} height={height}>
    {links.map((link, index) => {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      if (!from || !to) return null;
      const a = movedRect(nodes.find((node) => node.name === link.from)!);
      const b = movedRect(nodes.find((node) => node.name === link.to)!);
      const start = edgePoint(a.center, b.center, a.w / 2, a.h / 2);
      const end = edgePoint(b.center, a.center, b.w / 2, b.h / 2);
      return <g key={`deployment-link-${index}`}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={ink}
          strokeWidth={settings.lineWidth}
          markerStart={link.arrow === "-->" ? undefined : "url(#uml-navigable)"}
          markerEnd={link.arrow === "---" ? undefined : "url(#uml-navigable)"}
        />
        {link.label && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle" fontSize={settings.fontSize - 2} fill="#59636e" paintOrder="stroke" stroke="#fff" strokeWidth="5">{link.label}</text>}
      </g>;
    })}
    {nodes.map((node) => {
      const base = positions.get(node.name)!;
      const boxW = nodeW(node);
      const boxH = nodeH(node);
      return <g key={node.name} {...drag.bind(`deployment:${node.name}`, `${node.name}节点`)}>
        <g transform={`translate(${base.x} ${base.y})`}>
          <rect width={boxW} height={boxH} fill={nodeFill} stroke={ink} strokeWidth={settings.lineWidth} />
          <path d={`M ${boxW - 16} 0 L ${boxW} 0 L ${boxW} 16 Z`} fill={settings.monochrome ? "#ffffff" : "#dce6f2"} stroke={ink} strokeWidth={settings.lineWidth} />
          <text x={12} y={titleH / 2 + settings.fontSize * .4} fontSize={settings.fontSize} fontWeight="700" fill={ink}>{node.name}</text>
          <text x={12} y={titleH / 2 - settings.fontSize * .7} fontSize={Math.max(9, settings.fontSize - 4)} fill={ink}>«node»</text>
          {node.components.map((component, index) => {
            const capsuleW = Math.min(boxW - 28, textW(component));
            const capsuleY = titleH + 12 + index * (componentH + componentGap);
            return <g key={`${node.name}-${component}`}>
              <rect x={(boxW - capsuleW) / 2} y={capsuleY} width={capsuleW} height={componentH} rx={componentH / 2} fill={componentFill} stroke={ink} strokeWidth={Math.max(1, settings.lineWidth * .8)} />
              <text x={boxW / 2} y={capsuleY + componentH / 2 + settings.fontSize * .34} textAnchor="middle" fontSize={settings.fontSize - 1} fill={ink}>{component}</text>
            </g>;
          })}
        </g>
      </g>;
    })}
    {!nodes.length && <text x={width / 2} y="120" textAnchor="middle" fontSize={settings.fontSize} fill="#687b8f">请使用 node 节点名 | 构件1; 构件2</text>}
  </CanvasFrame>;
}


export function Diagram({ tool, source, settings }: { tool: ToolId; source: string; settings: DiagramSettings }) {
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
  if (tool === "dataflow") return <DataFlowDiagram source={source} settings={outputSettings} />;
  if (tool === "deployment") return <DeploymentDiagram source={source} settings={outputSettings} />;
  if (tool === "testcase") return <TestCaseTable source={source} settings={outputSettings} />;
  if (tool === "environment") return <ThreeLineTable source={source} settings={outputSettings} />;
  if (tool === "table") return <ThreeLineTable source={source} settings={outputSettings} />;
  return <DataChart source={source} settings={outputSettings} />;
}
