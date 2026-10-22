import { useState } from "react";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import type { AdminRole, AdminUser } from "../content/types";
import { api, ApiFailure } from "./api";
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, timeAgo } from "./draft";
import { ConfirmButton, Field, Modal, TextInput, useToast } from "./ui";

interface Props {
  admins: AdminUser[];
  current: AdminUser;
  onRefresh: () => Promise<void> | void;
  disabled: boolean;
}

const BADGE: Record<AdminRole, string> = {
  owner: "abadge--brand",
  editor: "abadge--ok",
  viewer: "abadge--muted",
};

export function TeamPanel({ admins, current, onRefresh, disabled }: Props) {
  const toast = useToast();
  const isOwner = current.role === "owner";
  const [creating, setCreating] = useState(false);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", username: "", password: "", role: "editor" as AdminRole });
  const [password, setPassword] = useState({ next: "", repeat: "", current: "" });

  const resetForm = () => setForm({ name: "", username: "", password: "", role: "editor" });

  const create = async () => {
    if (!/^[a-z0-9._-]{3,32}$/.test(form.username)) {
      toast("نام کاربری باید ۳ تا ۳۲ نویسهٔ لاتین کوچک، رقم، نقطه، خط تیره یا زیرخط باشد.", "error");
      return;
    }
    if (form.password.length < 8) {
      toast("گذرواژه باید حداقل ۸ نویسه باشد.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.createAdmin(form);
      await onRefresh();
      toast(`دسترسی «${form.name || form.username}» ساخته شد.`);
      setCreating(false);
      resetForm();
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "ساخت دسترسی انجام نشد.", "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (admin: AdminUser, body: Record<string, unknown>, message: string) => {
    setSaving(true);
    try {
      await api.updateAdmin(admin.id, body);
      await onRefresh();
      toast(message);
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "ذخیره نشد.", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!passwordFor) return;
    if (password.next.length < 8) {
      toast("گذرواژه باید حداقل ۸ نویسه باشد.", "error");
      return;
    }
    if (password.next !== password.repeat) {
      toast("دو گذرواژه یکسان نیستند.", "error");
      return;
    }
    const self = passwordFor.id === current.id;
    await patch(
      passwordFor,
      self ? { password: password.next, currentPassword: password.current } : { password: password.next },
      "گذرواژه به‌روز شد."
    );
    setPasswordFor(null);
    setPassword({ next: "", repeat: "", current: "" });
  };

  const remove = async (admin: AdminUser) => {
    try {
      await api.deleteAdmin(admin.id);
      await onRefresh();
      toast("دسترسی حذف شد.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "حذف انجام نشد.", "error");
    }
  };

  return (
    <>
      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              TEAM / ACCESS
            </span>
            <h2>مدیران و دسترسی‌ها</h2>
            <p>
              {isOwner
                ? "می‌توانید همکار اضافه کنید، نقش‌ها را تغییر دهید یا دسترسی‌ها را غیرفعال کنید."
                : "فقط مالک می‌تواند دسترسی‌ها را تغییر دهد؛ شما می‌توانید فهرست را ببینید."}
            </p>
          </div>
          <button
            type="button"
            className="abtn abtn--primary"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
            disabled={!isOwner || disabled}
          >
            <UserPlus />
            افزودن مدیر
          </button>
        </div>

        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>نام</th>
                <th>نام کاربری</th>
                <th>نقش</th>
                <th>وضعیت</th>
                <th>آخرین ورود</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const self = admin.id === current.id;
                return (
                  <tr key={admin.id}>
                    <td>
                      <strong>{admin.name}</strong>
                      {self ? (
                        <span className="afield__hint" style={{ display: "block" }}>
                          حساب شما
                        </span>
                      ) : null}
                    </td>
                    <td dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      {admin.username}
                    </td>
                    <td>
                      <span className={`abadge ${BADGE[admin.role]}`}>{ROLE_LABELS[admin.role]}</span>
                    </td>
                    <td>
                      <span className={`abadge ${admin.active ? "abadge--ok" : "abadge--off"}`}>
                        {admin.active ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td title={formatDate(admin.lastLoginAt)}>{timeAgo(admin.lastLoginAt)}</td>
                    <td>
                      <span className="atable__tools">
                        {isOwner && !self ? (
                          <select
                            className="aselect aselect--sm"
                            value={admin.role === "owner" ? "editor" : admin.role}
                            aria-label={`نقش ${admin.name}`}
                            disabled={disabled || saving || admin.role === "owner"}
                            onChange={(event) =>
                              void patch(admin, { role: event.target.value }, "نقش به‌روز شد.")
                            }
                          >
                            <option value="editor">ویرایشگر</option>
                            <option value="viewer">بازدیدکننده</option>
                          </select>
                        ) : null}

                        {isOwner && !self ? (
                          <button
                            type="button"
                            className="abtn abtn--ghost abtn--sm"
                            disabled={disabled}
                            onClick={() =>
                              void patch(
                                admin,
                                { active: !admin.active },
                                admin.active ? "دسترسی غیرفعال شد." : "دسترسی فعال شد."
                              )
                            }
                          >
                            {admin.active ? "غیرفعال" : "فعال"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="abtn abtn--ghost abtn--sm"
                          disabled={disabled || (!self && !isOwner)}
                          onClick={() => {
                            setPassword({ next: "", repeat: "", current: "" });
                            setPasswordFor(admin);
                          }}
                        >
                          <KeyRound />
                          گذرواژه
                        </button>

                        {isOwner && !self ? (
                          <ConfirmButton
                            label="حذف"
                            confirmLabel="حذف قطعی"
                            onConfirm={() => void remove(admin)}
                            disabled={disabled || saving}
                          />
                        ) : null}
                      </span>
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
                {admins.filter((admin) => admin.role === role).length}
              </span>
            </div>
          ))}
        </div>
        <p className="afield__hint" style={{ marginTop: 12 }}>
          امکان ساخت مالک تازه از پنل وجود ندارد؛ این کار فقط از مسیر راه‌اندازی اولیه یا ویرایش فایل
          داده انجام می‌شود.
        </p>
      </div>

      <Modal
        open={creating}
        title="افزودن مدیر"
        description="برای همکاران دسترسی ویرایشگر یا فقط‌مشاهده بسازید."
        onClose={() => setCreating(false)}
        footer={
          <>
            <button type="button" className="abtn abtn--ghost" onClick={() => setCreating(false)}>
              انصراف
            </button>
            <button type="button" className="abtn abtn--primary" onClick={() => void create()} disabled={saving}>
              ساخت دسترسی
            </button>
          </>
        }
      >
        <Field label="نام نمایشی" hint="نامی که در فهرست مدیران دیده می‌شود.">
          <TextInput value={form.name} onChange={(value) => setForm((c) => ({ ...c, name: value }))} />
        </Field>
        <Field label="نام کاربری" hint="لاتین کوچک، ۳ تا ۳۲ نویسه.">
          <TextInput
            value={form.username}
            onChange={(value) => setForm((c) => ({ ...c, username: value.toLowerCase() }))}
            ltr
            autoComplete="off"
          />
        </Field>
        <Field label="گذرواژه" hint="حداقل ۸ نویسه؛ به همکار تحویل دهید تا بعداً تغییر دهد.">
          <TextInput
            value={form.password}
            onChange={(value) => setForm((c) => ({ ...c, password: value }))}
            type="password"
            ltr
            autoComplete="new-password"
          />
        </Field>
        <Field label="نقش">
          <select
            className="aselect"
            value={form.role}
            onChange={(event) => setForm((c) => ({ ...c, role: event.target.value as AdminRole }))}
          >
            <option value="editor">ویرایشگر — محتوا و نمونه‌کار</option>
            <option value="viewer">بازدیدکننده — فقط مشاهده</option>
          </select>
        </Field>
      </Modal>

      <Modal
        open={passwordFor !== null}
        title="تغییر گذرواژه"
        description={passwordFor ? `برای حساب ${passwordFor.username}` : undefined}
        onClose={() => setPasswordFor(null)}
        footer={
          <>
            <button type="button" className="abtn abtn--ghost" onClick={() => setPasswordFor(null)}>
              انصراف
            </button>
            <button type="button" className="abtn abtn--primary" onClick={() => void savePassword()} disabled={saving}>
              ذخیرهٔ گذرواژه
            </button>
          </>
        }
      >
        {passwordFor?.id === current.id ? (
          <Field label="گذرواژهٔ فعلی">
            <TextInput
              value={password.current}
              onChange={(value) => setPassword((c) => ({ ...c, current: value }))}
              type="password"
              ltr
              autoComplete="current-password"
            />
          </Field>
        ) : null}
        <Field label="گذرواژهٔ تازه" hint="حداقل ۸ نویسه باشد.">
          <TextInput
            value={password.next}
            onChange={(value) => setPassword((c) => ({ ...c, next: value }))}
            type="password"
            ltr
            autoComplete="new-password"
          />
        </Field>
        <Field label="تکرار گذرواژه">
          <TextInput
            value={password.repeat}
            onChange={(value) => setPassword((c) => ({ ...c, repeat: value }))}
            type="password"
            ltr
            autoComplete="new-password"
          />
        </Field>
      </Modal>

    </>
  );
}
