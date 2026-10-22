import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  FileText,
  History,
  Images,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LoaderCircle,
  LogOut,
  Menu,
  Save,
  Settings,
  ShieldAlert,
  Undo2,
  Users,
  X,
} from "lucide-react";
import mark from "../assets/cahen-mark.png";
import { resolveContent } from "../content/ContentProvider";
import type { ActivityEntry, AdminUser, MediaEntry, SiteContent } from "../content/types";
import { ActivityPanel } from "./ActivityPanel";
import { api, ApiFailure, type SessionInfo } from "./api";
import { AuthScreen } from "./AuthScreen";
import { ContentEditor } from "./ContentEditor";
import { Dashboard } from "./Dashboard";
import { formatDate, ROLE_LABELS, setPath, validateContent } from "./draft";
import { LinksPanel } from "./LinksPanel";
import { MediaLibrary } from "./MediaLibrary";
import { SettingsPanel } from "./SettingsPanel";
import { ADMIN_TABS, tabFromHash, type AdminTab } from "./tabs";
import { TeamPanel } from "./TeamPanel";
import { ToastProvider, useToast } from "./ui";
import { WorkManager } from "./WorkManager";

const ICONS: Record<AdminTab, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  work: LayoutGrid,
  content: FileText,
  links: Link2,
  media: Images,
  team: Users,
  activity: History,
  settings: Settings,
};

const GROUPS: { label: string; tabs: AdminTab[] }[] = [
  { label: "CONTENT", tabs: ["dashboard", "work", "content", "links"] },
  { label: "SYSTEM", tabs: ["media", "team", "activity", "settings"] },
];

export function AdminApp() {
  return (
    <ToastProvider>
      <AdminRoot />
    </ToastProvider>
  );
}

type Intent = "new-work" | "upload" | undefined;

function AdminRoot() {
  const toast = useToast();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [content, setContent] = useState<SiteContent | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{ expiresAt: string; sessionHours: number } | null>(
    null
  );
  const [media, setMedia] = useState<MediaEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const [tab, setTab] = useState<AdminTab>(() => tabFromHash(window.location.hash));
  const [drawer, setDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createSignal, setCreateSignal] = useState(0);
  const [uploadSignal, setUploadSignal] = useState(0);

  const contentRef = useRef<SiteContent | null>(null);
  contentRef.current = content;

  const disabled = admin?.role === "viewer";

  /* ------------------------------ session ------------------------------ */

  useEffect(() => {
    let alive = true;
    api
      .session()
      .then((info) => {
        if (!alive) return;
        setSession(info);
        setAdmin(info.admin);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setBootError(
          error instanceof ApiFailure
            ? error.message
            : "ارتباط با سرور برقرار نشد. مطمئن شوید سرور در حال اجراست."
        );
        setSession({
          ok: true,
          configured: false,
          issues: ["ارتباط با سرور برقرار نشد."],
          sessionHours: 8,
          admin: null,
          expiresAt: null,
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadState = useCallback(async (adopt: boolean) => {
    setLoading(true);
    try {
      const state = await api.state();
      setAdmin(state.admin);
      setAccounts(state.accounts);
      setSessionInfo(state.session);
      setMedia(state.media);
      setActivity(state.activity);
      setUpdatedAt(state.updatedAt);
      setUpdatedBy(state.updatedBy);
      if (adopt || !contentRef.current) {
        const next = resolveContent(state.content ?? {});
        setContent(next);
        setSavedSnapshot(JSON.stringify(next));
      }
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) {
        setAdmin(null);
      } else {
        toast(error instanceof ApiFailure ? error.message : "خواندن داده‌های پنل انجام نشد.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (admin) void loadState(true);
    // Only when the signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  /* ------------------------------- routing ------------------------------ */

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((next: AdminTab, intent?: Intent) => {
    setTab(next);
    setDrawer(false);
    window.history.replaceState(null, "", `${window.location.pathname}#${next}`);
    if (next === "work" && intent === "new-work") setCreateSignal((value) => value + 1);
    if (next === "media" && intent === "upload") setUploadSignal((value) => value + 1);
  }, []);

  /* -------------------------------- saving ------------------------------ */

  const dirty = useMemo(
    () => Boolean(content) && JSON.stringify(content) !== savedSnapshot,
    [content, savedSnapshot]
  );
  const errors = useMemo(() => (content ? validateContent(content) : {}), [content]);

  const save = useCallback(async () => {
    if (!content || !admin || disabled) return;
    if (Object.keys(errors).length > 0) {
      toast("چند فیلد نیاز به اصلاح دارد؛ موارد مشخص‌شده را ببینید.", "error");
      return;
    }
    setSaving(true);
    try {
      const message =
        content.work.items.length !== JSON.parse(savedSnapshot || "{}").work?.items?.length
          ? "به‌روزرسانی محتوا و نمونه‌کارها"
          : "ذخیرهٔ محتوای سایت";
      const result = await api.saveContent(content, message);
      setSavedSnapshot(JSON.stringify(content));
      setUpdatedAt(result.updatedAt);
      setUpdatedBy(result.updatedBy);
      await loadState(false);
      toast("تغییرات ذخیره شد و روی سایت اعمال شد.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "ذخیره انجام نشد.", "error");
    } finally {
      setSaving(false);
    }
  }, [admin, content, disabled, errors, loadState, savedSnapshot, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, save, saving]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const update = useCallback((path: string, value: unknown) => {
    setContent((current) => (current ? setPath(current, path, value) : current));
  }, []);

  const dismissSession = (message: string) => {
    setAdmin(null);
    setContent(null);
    setSavedSnapshot("");
    setSession((current) => (current ? { ...current, admin: null } : current));
    toast(message);
  };

  const logout = async (allDevices = false) => {
    try {
      if (allDevices) await api.logoutAll();
      else await api.logout();
    } catch {
      // Even if the request fails the local session is dropped.
    }
    dismissSession(allDevices ? "همهٔ نشست‌ها بسته شد." : "از پنل خارج شدید.");
  };

  useEffect(() => {
    const onUnauthorized = () => dismissSession("نشست شما پایان یافت؛ دوباره وارد شوید.");
    window.addEventListener("cahen:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cahen:unauthorized", onUnauthorized);
    // dismissSession only touches stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  /* -------------------------------- views ------------------------------- */

  if (session === null) {
    return (
      <div className="admin">
        <span className="admin__grain" aria-hidden="true" />
        <div className="admin-boot">
          <img src={mark} alt="" />
          <span className="aeyebrow" dir="ltr">
            OPENING CONTROL ROOM
          </span>
          <p>در حال باز کردن اتاق فرمان…</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="admin">
        <span className="admin__grain" aria-hidden="true" />
        <div className="admin-boot">
          <ShieldAlert />
          <p>{bootError}</p>
          <button type="button" className="abtn" onClick={() => window.location.reload()}>
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <AuthScreen
        session={session}
        onAuthed={(next) => {
          setAdmin(next);
          setSession((current) =>
            current
              ? { ...current, admin: next, configured: true, issues: [], expiresAt: null }
              : current
          );
        }}
      />
    );
  }

  const currentTab = ADMIN_TABS.find((entry) => entry.id === tab) ?? ADMIN_TABS[0];

  return (
    <div className="admin">
      <span className="admin__grain" aria-hidden="true" />
      {drawer ? <button type="button" className="admin-scrim" aria-label="بستن منو" onClick={() => setDrawer(false)} /> : null}

      <div className="admin-shell">
        <main className="admin-main">
          <header className="admin-top">
            <button
              type="button"
              className="admin-burger"
              aria-label="منو"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Menu />
            </button>

            <div className="admin-crumb">
              <span dir="ltr">SHENATAISONI / {currentTab.latin}</span>
              <b>{currentTab.label}</b>
            </div>

            <div className="admin-top__actions">
              {dirty ? (
                <span className="abadge abadge--warn">
                  <span className="adirty-dot" />
                  ذخیره‌نشده
                </span>
              ) : (
                <span className="abadge abadge--ok">همه‌چیز ذخیره شده</span>
              )}
              <button
                type="button"
                className="abtn abtn--primary abtn--sm"
                onClick={() => void save()}
                disabled={disabled || saving || !dirty}
              >
                {saving ? <LoaderCircle style={{ animation: "spin 1s linear infinite" }} /> : <Save />}
                ذخیره
              </button>
            </div>
          </header>

          <div className="admin-body">
            {disabled ? (
              <div className="anote">
                <Eye />
                <span>
                  شما با نقش «بازدیدکننده» وارد شده‌اید؛ همه‌چیز را می‌بینید اما تغییرات ذخیره نمی‌شود.
                </span>
              </div>
            ) : null}

            {loading && !content ? (
              <div className="admin-loading">
                <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
                <span>در حال خواندن محتوا…</span>
              </div>
            ) : null}

            {content ? (
              <>
                {tab === "dashboard" ? (
                  <Dashboard
                    content={content}
                    admin={admin}
                    updatedAt={updatedAt}
                    updatedBy={updatedBy}
                    accounts={accounts}
                    media={media}
                    activity={activity}
                    dirty={dirty}
                    disabled={Boolean(disabled)}
                    onNavigate={go}
                    onSave={() => void save()}
                  />
                ) : null}

                {tab === "work" ? (
                  <WorkManager
                    items={content.work.items}
                    onChange={(items) => update("work.items", items)}
                    errors={errors}
                    disabled={Boolean(disabled)}
                    media={media.map((entry) => ({
                      name: entry.name,
                      url: `/media/${entry.name}`,
                      at: entry.at,
                      size: entry.size,
                    }))}
                    createSignal={createSignal}
                  />
                ) : null}

                {tab === "content" ? (
                  <ContentEditor
                    content={content}
                    update={update}
                    errors={errors}
                    disabled={Boolean(disabled)}
                  />
                ) : null}

                {tab === "links" ? (
                  <LinksPanel
                    content={content}
                    update={update}
                    errors={errors}
                    disabled={Boolean(disabled)}
                  />
                ) : null}

                {tab === "media" ? (
                  <MediaLibrary
                    media={media}
                    content={content}
                    onRefresh={() => loadState(false)}
                    disabled={Boolean(disabled)}
                    uploadSignal={uploadSignal}
                  />
                ) : null}

                {tab === "team" ? (
                  <TeamPanel accounts={accounts} current={admin} />
                ) : null}

                {tab === "activity" ? <ActivityPanel activity={activity} /> : null}

                {tab === "settings" ? (
                  <SettingsPanel
                    content={content}
                    admin={admin}
                    media={media}
                    updatedAt={updatedAt}
                    updatedBy={updatedBy}
                    session={sessionInfo ?? { expiresAt: new Date().toISOString(), sessionHours: 8 }}
                    dirty={dirty}
                    onReset={async () => {
                      await loadState(true);
                    }}
                    onLogout={() => void logout()}
                    onLogoutAll={() => void logout(true)}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          {dirty && content && !disabled ? (
            <div className="asave" role="status">
              <div className="asave__text">
                <b>تغییرات ذخیره‌نشده دارید</b>
                <span>
                  {Object.keys(errors).length > 0
                    ? `${Object.keys(errors).length} مورد نیاز به اصلاح دارد`
                    : `آخرین ذخیره: ${updatedAt ? formatDate(updatedAt) : "—"}`}
                </span>
              </div>
              <div className="asave__actions">
                <button
                  type="button"
                  className="abtn abtn--ghost abtn--sm"
                  onClick={() => setContent(JSON.parse(savedSnapshot))}
                  disabled={saving}
                >
                  <Undo2 />
                  بازگردانی
                </button>
                <button type="button" className="abtn abtn--primary abtn--sm" onClick={() => void save()} disabled={saving}>
                  ذخیره
                </button>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="admin-side" data-open={drawer}>
          <div className="admin-side__brand">
            <img src={mark} alt="" />
            <div className="admin-side__brand-type">
              <b dir="ltr">SHENATAISONI</b>
              <span dir="ltr">CAHEN CONTROL ROOM</span>
            </div>
            <button
              type="button"
              className="abtn abtn--ghost abtn--icon abtn--sm admin-side__close"
              aria-label="بستن منو"
              onClick={() => setDrawer(false)}
            >
              <X />
            </button>
          </div>

          {GROUPS.map((group) => (
            <nav className="admin-nav" key={group.label} aria-label={group.label}>
              <span className="admin-nav__label" dir="ltr">
                {group.label}
              </span>
              {group.tabs.map((id) => {
                const meta = ADMIN_TABS.find((entry) => entry.id === id)!;
                const Icon = ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="admin-nav__link"
                    data-active={tab === id}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => go(id)}
                  >
                    <Icon />
                    <span>
                      {meta.label}
                      <small style={{ display: "block" }}>{meta.hint}</small>
                    </span>
                    <small dir="ltr">{meta.latin}</small>
                  </button>
                );
              })}
            </nav>
          ))}

          <div className="admin-side__foot">
            <div className="admin-user">
              <span className="admin-user__avatar">{admin.name.trim().charAt(0) || "C"}</span>
              <div className="admin-user__type">
                <b>{admin.name}</b>
                <span dir="ltr">
                  {admin.email} · {ROLE_LABELS[admin.role]}
                </span>
              </div>
              <button
                type="button"
                className="abtn abtn--ghost abtn--icon abtn--sm"
                onClick={() => void logout()}
                aria-label="خروج"
                title="خروج"
              >
                <LogOut />
              </button>
            </div>
            <a className="admin-side__link" href="/" target="_blank" rel="noreferrer">
              <span>دیدن سایت</span>
              <ArrowUpRight />
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
