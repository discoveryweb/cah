import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_CONTENT } from "./defaults";
import type { SiteContent } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Merge a stored document over the designed defaults. Arrays are taken whole
 * when present (so admins can remove items), objects merge key by key (so a
 * document saved before a field existed still gets that field).
 */
export function mergeContent(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeContent(base[key], value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

export const resolveContent = (stored: unknown): SiteContent =>
  mergeContent(DEFAULT_CONTENT, stored ?? {}) as SiteContent;

interface ContentContextValue {
  content: SiteContent;
  /** True once a saved document came back from the server. */
  customised: boolean;
  ready: boolean;
}

const ContentContext = createContext<ContentContextValue>({
  content: DEFAULT_CONTENT,
  customised: false,
  ready: false,
});

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [customised, setCustomised] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/content", { signal: controller.signal, headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (controller.signal.aborted || !payload?.ok) return;
        if (payload.content) {
          setContent(resolveContent(payload.content));
          setCustomised(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, []);

  // Keep the document head in step with the editable meta fields.
  useEffect(() => {
    const { meta } = content;
    if (meta.seoTitle) document.title = meta.seoTitle;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    if (meta.seoDescription) description.content = meta.seoDescription;
  }, [content.meta.seoDescription, content.meta.seoTitle]);

  const value = useMemo(
    () => ({ content, customised, ready }),
    [content, customised, ready]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext).content;
export const useContentState = () => useContext(ContentContext);
