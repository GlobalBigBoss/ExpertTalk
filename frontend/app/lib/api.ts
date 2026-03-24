import type { TaskCreate, TaskProgress, ConnectivityResult, ProjectSummary } from "~/types";

const API_BASE = "http://localhost:8000";

export async function createTask(data: TaskCreate): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
  return res.json();
}

export async function getTaskStatus(taskId: string): Promise<TaskProgress> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (!res.ok) throw new Error(`Failed to get task: ${res.statusText}`);
  return res.json();
}

export function getDownloadUrl(taskId: string, videoId: string): string {
  return `${API_BASE}/api/tasks/${taskId}/download/${videoId}`;
}

export function getPdfDownloadUrl(taskId: string, videoId: string): string {
  return `${API_BASE}/api/tasks/${taskId}/download/${videoId}/pdf`;
}

export function getWebSocketUrl(taskId: string): string {
  return `ws://localhost:8000/ws/tasks/${taskId}`;
}

export async function testConnectivity(): Promise<ConnectivityResult> {
  const res = await fetch(`${API_BASE}/api/test-connectivity`);
  if (!res.ok) throw new Error(`Connectivity test failed: ${res.statusText}`);
  return res.json();
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to list projects: ${res.statusText}`);
  return res.json();
}

export async function getProject(id: string): Promise<TaskProgress> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`);
  if (!res.ok) throw new Error(`Failed to get project: ${res.statusText}`);
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
}
