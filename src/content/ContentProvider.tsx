import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_CONTENT } from "./defaults";
import { CONTENT_CHANNEL, CONTENT_STORAGE_KEY } from "./live";
import { adoptPublishedAddresses, adoptRealPortfolio } from "./normalize";
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
  adoptRealPortfolio(
    adoptPublishedAddresses(mergeContent(DEFAULT_CONTENT, stored ?? {}) as SiteContent),
  );

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

  /**
   * The document the page is currently showing. `updatedAt` is the store's own
   * stamp, so a refetch that changes nothing changes nothing here either: no
   * re-render, no reflow, no lost scroll position.
   */
  const stamp = useRef<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    lastAttempt.current = Date.now();
    try {
      const response = await fetch("/api/content", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (controller.signal.aborted || !payload?.ok) return;
      const next = payload.updatedAt ?? null;
      if (next && next === stamp.current) return;
      stamp.current = next;
      if (payload.content) {
        setContent(resolveContent(payload.content));
        setCustomised(true);
      } else {
        /* The panel can also put the site back on its own copy. An open page
           has to follow that too, or "reset" would only exist for whoever
           reloads. The default document is the same object the page started
           with, so this is a no-op for a visitor who never saw a saved one. */
        setContent(DEFAULT_CONTENT);
        setCustomised(false);
      }
    } catch {
      /* offline, cold start, storage outage: the page keeps its defaults and
         tries again next time it is focused */
    } finally {
      if (!controller.signal.aborted) setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();

    /**
     * A page that is already open stays current: when the tab comes back into
     * view, when the window is focused, when the connection returns, and the
     * instant the panel in another tab announces a save. All of it is one small
     * request at most every couple of seconds, and nothing at all while the
     * reader is reading.
     */
    const refresh = () => {
      if (document.hidden) return;
      if (Date.now() - lastAttempt.current < 1500) return;
      void load();
    };
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONTENT_STORAGE_KEY) refresh();
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel === "function") {
        channel = new BroadcastChannel(CONTENT_CHANNEL);
        channel.onmessage = () => refresh();
      }
    } catch {
      channel = null;
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", onStorage);
      channel?.close();
      inflight.current?.abort();
    };
  }, [load]);

  // Keep the document head in step with the editable meta fields. The social
  // cards are edited from the same panel, so they follow the same values: a
  // shared link that still shows the seeded description is a lie about the page.
  useEffect(() => {
    const { meta } = content;
    const setMeta = (selector: string, value: string) => {
      const node = document.querySelector<HTMLMetaElement>(selector);
      if (node) node.content = value;
    };

    if (meta.seoTitle) {
      document.title = meta.seoTitle;
      setMeta('meta[property="og:title"]', meta.seoTitle);
      setMeta('meta[name="twitter:title"]', meta.seoTitle);
    }

    if (!meta.seoDescription) return;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = meta.seoDescription;
    setMeta('meta[property="og:description"]', meta.seoDescription);
    setMeta('meta[name="twitter:description"]', meta.seoDescription);
  }, [content.meta.seoDescription, content.meta.seoTitle]);

  const value = useMemo(
    () => ({ content, customised, ready }),
    [content, customised, ready]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext).content;
export const useContentState = () => useContext(ContentContext);
