import type { ActivityEntry, AdminRole, AdminUser, MediaEntry, SiteContent } from "../content/types";

export class ApiFailure extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new ApiFailure(
      response.status,
      payload?.code ?? "request_failed",
      payload?.message ?? "درخواست انجام نشد."
    );
  }
  return payload as T;
}

export interface SessionInfo {
  ok: true;
  setupRequired: boolean;
  admin: AdminUser | null;
}

export interface AdminState {
  ok: true;
  admin: AdminUser;
  content: SiteContent | null;
  updatedAt: string | null;
  updatedBy: string | null;
  admins: AdminUser[];
  media: MediaEntry[];
  activity: ActivityEntry[];
}

export const api = {
  session: () => request<SessionInfo>("/api/admin/session"),
  setup: (body: { username: string; password: string; name: string }) =>
    request<{ ok: true; admin: AdminUser }>("/api/admin/setup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { username: string; password: string }) =>
    request<{ ok: true; admin: AdminUser }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: true }>("/api/admin/logout", { method: "POST" }),
  state: () => request<AdminState>("/api/admin/state"),
  saveContent: (content: SiteContent, message?: string) =>
    request<{ ok: true; updatedAt: string; updatedBy: string }>("/api/admin/content", {
      method: "PUT",
      body: JSON.stringify({ content, message }),
    }),
  resetContent: () =>
    request<{ ok: true }>("/api/admin/content/reset", { method: "POST" }),
  activity: () => request<{ ok: true; activity: ActivityEntry[] }>("/api/admin/activity"),
  upload: async (file: Blob, name: string) => {
    const response = await fetch(`/api/admin/media?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new ApiFailure(response.status, payload?.code ?? "upload_failed", payload?.message ?? "بارگذاری انجام نشد.");
    }
    return payload as { ok: true; media: MediaEntry; url: string };
  },
  deleteMedia: (name: string) =>
    request<{ ok: true }>(`/api/admin/media?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  createAdmin: (body: { username: string; password: string; name: string; role: AdminRole }) =>
    request<{ ok: true; admin: AdminUser }>("/api/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAdmin: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true; admin: AdminUser }>(`/api/admin/admins/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAdmin: (id: string) =>
    request<{ ok: true }>(`/api/admin/admins/${id}`, { method: "DELETE" }),
  exportContent: () => request<{ ok: true; exportedAt: string; content: SiteContent | null }>("/api/admin/export"),
};

/** Downscale and re-encode an image in the browser before it is uploaded. */
export async function prepareImage(file: File, maxEdge = 1800): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) {
    bitmap.close?.();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  return blob && blob.size < file.size ? blob : file;
}
