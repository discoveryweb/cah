import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  Images,
  LayoutGrid,
  Plus,
  Save,
  Users,
} from "lucide-react";
import type { ActivityEntry, AdminUser, MediaEntry, SiteContent } from "../content/types";
import { formatDate, timeAgo } from "./draft";
import type { AdminTab } from "./tabs";

interface Props {
  content: SiteContent;
  admin: AdminUser;
  updatedAt: string | null;
  updatedBy: string | null;
  admins: AdminUser[];
  media: MediaEntry[];
  activity: ActivityEntry[];
  dirty: boolean;
  disabled: boolean;
  onNavigate: (tab: AdminTab, intent?: "new-work" | "upload") => void;
  onSave: () => void;
}

const SITE_LINKS = [
  { href: "#about", label: "درباره", latin: "ABOUT" },
  { href: "#work", label: "کارها", latin: "WORK" },
  { href: "#services", label: "توانمندی‌ها", latin: "SERVICES" },
  { href: "#studio", label: "استودیو", latin: "STUDIO" },
  { href: "#contact", label: "تماس", latin: "CONTACT" },
];

export function Dashboard({
  content,
  admin,
  updatedAt,
  updatedBy,
  admins,
  media,
  activity,
  dirty,
  disabled,
  onNavigate,
  onSave,
}: Props) {
  const published = content.work.items.filter((item) => item.published !== false);
  const drafts = content.work.items.length - published.length;
  const missingAlt = [...published.map((item) => item.image), content.hero.figure.image, content.about.portrait.image].filter(
    (value) => !value
  ).length;

  const checks = [
    {
      ok: content.meta.seoDescription.trim().length >= 60,
      label: "توضیح سئو نوشته شده",
      hint: "برای دیده‌شدن در نتایج جست‌وجو حداقل چند جمله بنویسید.",
      tab: "links" as AdminTab,
    },
    {
      ok: published.length >= 3,
      label: "حداقل سه نمونه‌کار منتشرشده",
      hint: "گالری با سه کار به بالا کامل‌تر دیده می‌شود.",
      tab: "work" as AdminTab,
    },
    {
      ok: missingAlt === 0,
      label: "همهٔ تصاویر اصلی انتخاب شده‌اند",
      hint: missingAlt ? `${missingAlt} تصویر خالی است.` : "تصویر هیرو، درباره و کارها کامل است.",
      tab: "content" as AdminTab,
    },
    {
      ok: content.socials.every((social) => /^https?:\/\//i.test(social.href)),
      label: "نشانی کانال‌ها کامل است",
      hint: "هر کانال باید با https:// شروع شود.",
      tab: "links" as AdminTab,
    },
    {
      ok: content.contact.email.includes("@"),
      label: "ایمیل تماس معتبر است",
      hint: content.contact.email || "ایمیل ثبت نشده.",
      tab: "links" as AdminTab,
    },
  ];

  return (
    <div className="agrid" style={{ gap: 18 }}>
      <section className="adash-hero">
        <div className="adash-hero__text">
          <span className="aeyebrow" dir="ltr">
            CONTROL ROOM / SHENATAISONI
          </span>
          <h1>
            سلام {admin.name.split(" ")[0]}
            <span className="adash-hero__dot" />
          </h1>
          <p>
            {dirty
              ? "تغییرات ذخیره‌نشده دارید؛ تا پیش از ذخیره، سایت همان نسخهٔ قبلی را نشان می‌دهد."
              : updatedAt
                ? `آخرین ذخیره: ${formatDate(updatedAt)}${updatedBy ? ` توسط ${updatedBy}` : ""}.`
                : "هنوز محتوایی ذخیره نشده است؛ سایت روی نسخهٔ پیش‌فرض است."}
          </p>
          <div className="adash-hero__actions">
            <button
              type="button"
              className="abtn abtn--primary"
              onClick={onSave}
              disabled={disabled || !dirty}
            >
              <Save />
              ذخیرهٔ تغییرات
            </button>
            <a className="abtn" href="/" target="_blank" rel="noreferrer">
              دیدن سایت
              <ArrowUpRight />
            </a>
          </div>
        </div>
        <div className="adash-hero__clock" aria-hidden="true">
          <span dir="ltr">{new Date().toLocaleDateString("fa-IR", { weekday: "long" })}</span>
          <strong dir="ltr">{new Intl.DateTimeFormat("fa-IR").format(new Date())}</strong>
        </div>
      </section>

      <div className="astats">
        <button type="button" className="astat" onClick={() => onNavigate("work")}>
          <span className="astat__icon">
            <LayoutGrid />
          </span>
          <b>{published.length}</b>
          <span>نمونه‌کار منتشرشده</span>
          <small>{drafts > 0 ? `${drafts} پیش‌نویس` : "ALL PUBLISHED"}</small>
        </button>
        <button type="button" className="astat" onClick={() => onNavigate("media")}>
          <span className="astat__icon">
            <Images />
          </span>
          <b>{media.length}</b>
          <span>تصویر در کتابخانه</span>
          <small>WEBP OPTIMISED</small>
        </button>
        <button type="button" className="astat" onClick={() => onNavigate("content")}>
          <span className="astat__icon">
            <FileText />
          </span>
          <b>{content.services.items.length}</b>
          <span>خدمت فعال</span>
          <small dir="ltr">{content.principles.length} PRINCIPLES</small>
        </button>
        <button type="button" className="astat" onClick={() => onNavigate("team")}>
          <span className="astat__icon">
            <Users />
          </span>
          <b>{admins.filter((entry) => entry.active).length}</b>
          <span>مدیر فعال</span>
          <small dir="ltr">{admins.length} ACCOUNTS</small>
        </button>
      </div>

      <div className="agrid agrid--wide">
        <section className="acard">
          <div className="acard__head">
            <div>
              <span className="aeyebrow" dir="ltr">
                QUICK ACTIONS
              </span>
              <h2>کارهای سریع</h2>
            </div>
          </div>
          <div className="acard__body">
            <div className="aquick">
              <button type="button" onClick={() => onNavigate("work", "new-work")} disabled={disabled}>
                <Plus />
                <span>نمونه‌کار تازه</span>
                <em>افزودن پروژه با تصویر و متن</em>
              </button>
              <button type="button" onClick={() => onNavigate("media", "upload")} disabled={disabled}>
                <Images />
                <span>بارگذاری تصویر</span>
                <em>کتابخانهٔ رسانه‌ها</em>
              </button>
              <button type="button" onClick={() => onNavigate("content")} disabled={disabled}>
                <FileText />
                <span>ویرایش متن‌ها</span>
                <em>هیرو، درباره، توانمندی‌ها…</em>
              </button>
              <button type="button" onClick={() => onNavigate("team")}>
                <Users />
                <span>مدیران و دسترسی</span>
                <em>نقش‌ها و گذرواژه‌ها</em>
              </button>
            </div>

            <div className="adivider" />

            <span className="aeyebrow" dir="ltr">
              SITE MAP
            </span>
            <div className="achips">
              {SITE_LINKS.map((link) => (
                <a key={link.href} href={`/${link.href}`} target="_blank" rel="noreferrer" className="achip">
                  <span>{link.label}</span>
                  <em dir="ltr">{link.latin}</em>
                  <ArrowUpRight />
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="acard">
          <div className="acard__head">
            <div>
              <span className="aeyebrow" dir="ltr">
                HEALTH CHECK
              </span>
              <h2>وضعیت محتوا</h2>
            </div>
          </div>
          <div className="acard__body">
            <ul className="achecks">
              {checks.map((check) => (
                <li key={check.label} data-ok={check.ok}>
                  {check.ok ? <CheckCircle2 /> : <CircleDashed />}
                  <span>
                    {check.label}
                    <em>{check.hint}</em>
                  </span>
                  <button type="button" onClick={() => onNavigate(check.tab)} aria-label="رفتن به بخش">
                    <ArrowUpRight />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              RECENT ACTIVITY
            </span>
            <h2>آخرین رخدادها</h2>
          </div>
          <button type="button" className="abtn abtn--ghost abtn--sm" onClick={() => onNavigate("activity")}>
            همهٔ تاریخچه
            <ArrowUpRight />
          </button>
        </div>
        <div className="acard__body">
          {activity.length === 0 ? (
            <p className="afield__hint">هنوز رخدادی ثبت نشده است.</p>
          ) : (
            <ul className="arecent">
              {activity.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <span>{entry.actor}</span>
                  <p dir="auto">{entry.detail}</p>
                  <time dateTime={entry.at}>{timeAgo(entry.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
