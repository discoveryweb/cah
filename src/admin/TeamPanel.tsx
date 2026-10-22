import { KeyRound, ShieldCheck, Terminal } from "lucide-react";
import type { AdminRole, AdminUser } from "../content/types";
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, timeAgo } from "./draft";

interface Props {
  accounts: AdminUser[];
  current: AdminUser;
}

const BADGE: Record<AdminRole, string> = {
  owner: "abadge--brand",
  editor: "abadge--ok",
  viewer: "abadge--muted",
};

export function TeamPanel({ accounts, current }: Props) {
  const ownerCount = accounts.filter((account) => account.role === "owner").length;

  return (
    <>
      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ACCESS / ENVIRONMENT
            </span>
            <h2>مدیران و دسترسی‌ها</h2>
            <p>
              حساب‌ها فقط از متغیرهای محیطی سرور خوانده می‌شوند؛ هیچ گذرواژه‌ای در پایگاه‌داده یا مرورگر
              ذخیره نمی‌شود. برای تغییر افراد، متغیرها را در میزبان به‌روزرسانی و دوباره مستقر کنید.
            </p>
          </div>
          <span className="abadge abadge--brand">
            <ShieldCheck style={{ width: 12, height: 12 }} />
            فقط سمت سرور
          </span>
        </div>

        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نقش</th>
                <th>آخرین ورود</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const self = account.id === current.id;
                return (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.name}</strong>
                      {self ? (
                        <span className="afield__hint" style={{ display: "block" }}>
                          حساب شما
                        </span>
                      ) : null}
                    </td>
                    <td dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      {account.email}
                    </td>
                    <td>
                      <span className={`abadge ${BADGE[account.role]}`}>{ROLE_LABELS[account.role]}</span>
                    </td>
                    <td title={formatDate(account.lastLoginAt)}>{timeAgo(account.lastLoginAt)}</td>
                    <td>
                      <span className="abadge abadge--ok">فعال</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ROLES
            </span>
            <h2>نقش‌ها و مجوزها</h2>
          </div>
        </div>
        <div className="aroles">
          {(["owner", "editor", "viewer"] as AdminRole[]).map((role) => (
            <div className="arole" key={role}>
              <ShieldCheck />
              <div>
                <strong>{ROLE_LABELS[role]}</strong>
                <p>{ROLE_DESCRIPTIONS[role]}</p>
              </div>
              <span className="afield__count" dir="ltr">
                {accounts.filter((account) => account.role === role).length}
              </span>
            </div>
          ))}
        </div>
        <div className="anote" style={{ marginTop: 12 }}>
          <KeyRound />
          <span>
            {ownerCount > 1
              ? "بیش از یک مالک تعریف شده است؛ بهتر است فقط یک مالک فعال بماند."
              : "تنها یک مالک تعریف شده است؛ برای افزودن همکار، از بخش ADMIN_TEAM در متغیرهای محیطی استفاده کنید."}
          </span>
        </div>
      </div>

      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              HOW TO EDIT
            </span>
            <h2>افزودن یا حذف دسترسی</h2>
            <p>همهٔ این کارها بیرون از پنل و فقط از پنل میزبان انجام می‌شود.</p>
          </div>
        </div>
        <div className="acard__body">
          <ol className="asteps">
            <li>
              <b>گذرواژهٔ تازه را هش کنید</b>
              <code dir="ltr">npm run admin:hash -- "your long passphrase"</code>
            </li>
            <li>
              <b>متغیرها را تنظیم کنید</b>
              <span dir="ltr">
                ADMIN_EMAIL · ADMIN_PASSWORD_HASH · ADMIN_SESSION_SECRET · ADMIN_NAME
              </span>
            </li>
            <li>
              <b>برای همکاران، فهرست را اضافه کنید</b>
              <code dir="ltr">{`ADMIN_TEAM=[{"email":"editor@studio.com","role":"editor","passwordHash":"scrypt$…"}]`}</code>
            </li>
            <li>
              <b>دوباره مستقر کنید</b>
              <span>با ری‌استارت، نشست‌های قبلی با تغییر ADMIN_SESSION_SECRET باطل می‌شوند.</span>
            </li>
          </ol>
          <div className="anote">
            <Terminal />
            <span>
              ایمیل مالک با ADMIN_EMAIL و گذرواژهٔ او با ADMIN_PASSWORD_HASH تعریف می‌شود؛ مقدار خام
              گذرواژه هرگز در فایل‌ها یا مرورگر نگه‌داری نمی‌شود.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
