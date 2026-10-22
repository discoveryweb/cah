import { useState } from "react";
import { Download, LogOut, ShieldAlert, Sparkles } from "lucide-react";
import type { AdminUser, MediaEntry, SiteContent } from "../content/types";
import { api, ApiFailure } from "./api";
import { formatBytes, formatDate, ROLE_LABELS } from "./draft";
import { PasswordForm } from "./PasswordForm";
import { ConfirmButton, useToast } from "./ui";

interface Props {
  content: SiteContent;
  admin: AdminUser;
  media: MediaEntry[];
  updatedAt: string | null;
  updatedBy: string | null;
  session: { expiresAt: string; sessionHours: number };
  dirty: boolean;
  onReset: () => Promise<void> | void;
  onLogout: () => void;
  onLogoutAll: () => void;
}

export function SettingsPanel({
  content,
  admin,
  media,
  updatedAt,
  updatedBy,
  session,
  dirty,
  onReset,
  onLogout,
  onLogoutAll,
}: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isOwner = admin.role === "owner";
  const storage = media.reduce((total, entry) => total + entry.size, 0);

  const exportJson = async () => {
    setBusy(true);
    try {
      const result = await api.exportContent();
      const payload = {
        exportedAt: result.exportedAt,
        content: result.content ?? content,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cah-content-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("نسخهٔ پشتیبان دانلود شد.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "تهیهٔ پشتیبان انجام نشد.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await api.resetContent();
      await onReset();
      toast("محتوا به نسخهٔ پیش‌فرض بازگشت.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "بازنشانی انجام نشد.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="agrid" style={{ gap: 18 }}>
      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ACCOUNT
            </span>
            <h2>حساب شما</h2>
          </div>
        </div>
        <div className="acard__body">
          <div className="akv">
            <div>
              <span>نام</span>
              <strong>{admin.name}</strong>
            </div>
            <div>
              <span>ایمیل</span>
              <strong dir="ltr">{admin.email}</strong>
            </div>
            <div>
              <span>نقش</span>
              <strong>{ROLE_LABELS[admin.role]}</strong>
            </div>
            <div>
              <span>آخرین ورود</span>
              <strong>{formatDate(admin.lastLoginAt)}</strong>
            </div>
            <div>
              <span>پایان نشست</span>
              <strong>{formatDate(session.expiresAt)}</strong>
            </div>
            <div>
              <span>آخرین ذخیرهٔ محتوا</span>
              <strong>{updatedAt ? `${formatDate(updatedAt)}${updatedBy ? ` — ${updatedBy}` : ""}` : "—"}</strong>
            </div>
          </div>
          <div className="anote">
            <ShieldAlert />
            <span>
              نشست شما {session.sessionHours} ساعت اعتبار دارد و در کوکی HttpOnly با SameSite=Strict
              نگه‌داری می‌شود؛ جاوااسکریپت صفحه به آن دسترسی ندارد. گذرواژه در پنل قابل تغییر نیست و از
              متغیرهای محیطی سرور خوانده می‌شود.
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="abtn" onClick={onLogout}>
              <LogOut />
              خروج از این دستگاه
            </button>
            <ConfirmButton
              className="abtn abtn--danger"
              label="پایان همهٔ نشست‌ها"
              confirmLabel="تأیید خروج همه؟"
              icon={false}
              onConfirm={onLogoutAll}
            />
          </div>
        </div>
      </section>

      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              PASSWORD
            </span>
            <h2>گذرواژه</h2>
          </div>
        </div>
        <div className="acard__body acard__body--narrow">
          <PasswordForm admin={admin} onDone={() => undefined} />
        </div>
      </section>

      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              BACKUP
            </span>
            <h2>پشتیبان‌گیری</h2>
            <p>یک فایل JSON از تمام متن‌ها و نمونه‌کارها بگیرید و در جای امن نگه دارید.</p>
          </div>
          <button type="button" className="abtn abtn--primary" onClick={() => void exportJson()} disabled={busy}>
            <Download />
            دانلود پشتیبان
          </button>
        </div>
        <div className="acard__body">
          <div className="akv">
            <div>
              <span>نمونه‌کارها</span>
              <strong>{content.work.items.length}</strong>
            </div>
            <div>
              <span>خدمت‌ها</span>
              <strong>{content.services.items.length}</strong>
            </div>
            <div>
              <span>کانال‌ها</span>
              <strong>{content.socials.length}</strong>
            </div>
            <div>
              <span>تصاویر</span>
              <strong>{media.length}</strong>
            </div>
            <div>
              <span>حجم رسانه‌ها</span>
              <strong dir="ltr">{formatBytes(storage)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="acard acard--danger">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              DANGER ZONE
            </span>
            <h2>بازنشانی محتوا</h2>
            <p>
              همهٔ متن‌ها، نمونه‌کارها و پیوندها به نسخهٔ اولیهٔ سایت برمی‌گردند. تصاویر کتابخانه حذف
              نمی‌شوند، اما این کار قابل بازگشت نیست.
            </p>
          </div>
          {isOwner ? (
            <ConfirmButton
              className="abtn abtn--danger"
              label="بازنشانی محتوا"
              confirmLabel="تأیید بازنشانی؟"
              icon={false}
              onConfirm={() => void reset()}
              disabled={busy || dirty}
            />
          ) : (
            <span className="abadge abadge--muted">فقط مالک</span>
          )}
        </div>
        <div className="acard__body">
          <div className="anote">
            {isOwner ? <ShieldAlert /> : <Sparkles />}
            <span>
              {isOwner
                ? dirty
                  ? "برای بازنشانی، ابتدا تغییرات ذخیره‌نشده را ذخیره یا نادیده بگیرید."
                  : "پیشنهاد می‌کنیم پیش از بازنشانی یک پشتیبان دانلود کنید."
                : "بازنشانی محتوا فقط برای مالک فعال است."}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
