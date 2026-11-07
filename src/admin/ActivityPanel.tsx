import { useMemo, useState } from "react";
import { FileText, Image, LogIn, RotateCcw, Search, Trash2 } from "lucide-react";
import type { ActivityEntry } from "../content/types";
import { formatDate, timeAgo } from "./draft";

const META: Record<string, { label: string; icon: typeof FileText; tone: string }> = {
  login: { label: "ورود", icon: LogIn, tone: "brand" },
  "content.save": { label: "ذخیرهٔ محتوا", icon: FileText, tone: "ok" },
  "content.reset": { label: "بازنشانی محتوا", icon: RotateCcw, tone: "warn" },
  "media.upload": { label: "بارگذاری تصویر", icon: Image, tone: "ok" },
  "media.delete": { label: "حذف تصویر", icon: Trash2, tone: "warn" },
};

export function ActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activity
      .filter((entry) => (onlyMine ? entry.action === onlyMine : true))
      .filter((entry) =>
        needle
          ? `${entry.actor} ${entry.detail} ${META[entry.action]?.label ?? entry.action}`
              .toLowerCase()
              .includes(needle)
          : true
      );
  }, [activity, query, onlyMine]);

  const actions = useMemo(
    () => Array.from(new Set(activity.map((entry) => entry.action))),
    [activity]
  );

  return (
    <div className="acard">
      <div className="acard__head">
        <div>
          <span className="aeyebrow" dir="ltr">
            ACTIVITY / AUDIT LOG
          </span>
          <h2>تاریخچهٔ فعالیت</h2>
          <p>هر تغییر محتوا، بارگذاری یا تغییر دسترسی اینجا ثبت می‌شود؛ {activity.length} رخداد.</p>
        </div>
      </div>

      <div className="atoolbar">
        <div className="asearch">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو در فعالیت‌ها…"
            aria-label="جست‌وجوی فعالیت"
          />
        </div>
        <select
          className="aselect aselect--sm"
          value={onlyMine}
          onChange={(event) => setOnlyMine(event.target.value)}
          aria-label="نوع رخداد"
          style={{ maxWidth: 220 }}
        >
          <option value="">همهٔ رخدادها</option>
          {actions.map((action) => (
            <option value={action} key={action}>
              {META[action]?.label ?? action}
            </option>
          ))}
        </select>
      </div>

      <ul className="aactivity">
        {filtered.map((entry) => {
          const meta = META[entry.action] ?? { label: entry.action, icon: FileText, tone: "muted" };
          return (
            <li key={entry.id}>
              <span className="aactivity__dot" data-tone={meta.tone} />
              <div className="aactivity__body">
                <b>
                  {entry.actor} <span>— {meta.label}</span>
                </b>
                <span dir="auto" title={entry.detail}>
                  {entry.detail}
                </span>
              </div>
              <time dateTime={entry.at} title={formatDate(entry.at)}>
                {timeAgo(entry.at)}
              </time>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <div className="aempty">
          <p>رخدادی با این فیلتر پیدا نشد.</p>
        </div>
      ) : null}
    </div>
  );
}
