import { TOOLS } from "./catalog.ts";
import { normalizeWorkspace, STORAGE_VERSION, type Workspace } from "./storage.ts";

export const WORKSPACE_BACKUP_FORMAT = "thesis-figure-lab-workspace";
export const WORKSPACE_BACKUP_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createWorkspaceBackup(workspace: Workspace) {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    storageVersion: STORAGE_VERSION,
    workspace,
  };
}

export function serializeWorkspaceBackup(workspace: Workspace) {
  return JSON.stringify(createWorkspaceBackup(workspace), null, 2);
}

export function parseWorkspaceBackup(text: string, defaults: Workspace): Workspace {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON 备份");
  }
  if (!isRecord(raw) || raw.format !== WORKSPACE_BACKUP_FORMAT) {
    throw new Error("无法识别此文件，请选择图研工作区备份文件");
  }
  if (raw.version !== WORKSPACE_BACKUP_VERSION) {
    throw new Error(`不支持此备份版本：${String(raw.version)}`);
  }
  if (!Number.isInteger(raw.storageVersion) || Number(raw.storageVersion) < 1 || Number(raw.storageVersion) > STORAGE_VERSION) {
    throw new Error("备份的工作区版本不受当前应用支持");
  }
  const rawWorkspace = raw.workspace;
  if (!isRecord(rawWorkspace) || !isRecord(rawWorkspace.sources)) {
    throw new Error("备份缺少工作区内容");
  }
  const rawSources = rawWorkspace.sources;
  if (!TOOLS.every(({ id }) => typeof rawSources[id] === "string")) {
    throw new Error("备份中的图表源文本不完整");
  }
  return normalizeWorkspace({
    ...rawWorkspace,
    version: raw.storageVersion,
    layout: { editorWidth: rawWorkspace.editorWidth, editorCollapsed: rawWorkspace.editorCollapsed },
  }, defaults);
}
