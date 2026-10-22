import { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { AdminRole, AdminUser } from "../content/types";
import { api, ApiFailure } from "./api";
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, timeAgo } from "./draft";
import { ConfirmButton, Field, Modal, useToast } from "./ui";

interface Props {
  accounts: AdminUser[];
  current: AdminUser;
  onChanged: () => void;
}

const BADGE: Record<AdminRole, string> = {
  owner: "abadge--brand",
  editor: "abadge--ok",
  viewer: "abadge--muted",
};

const ROLES: AdminRole[] = ["owner", "editor", "viewer"];

export function TeamPanel({ accounts, current, onChanged }: Props) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ email: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = current.role === "owner";

  const closeCreate = () => {
    setCreating(false);
    setEmail("");
    setName("");
    setRole("editor");
    setMode("invite");
    setPassword("");
    setError(null);
  };

  const submitCreate = async () => {
    setError(null);
    if (!name.trim()) return setError("نام را وارد کنید.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("ایمیل معتبر نیست.");
    if (mode === "password" && password.length < 12) {
      return setError("گذرواژه باید حداقل ۱۲ نویسه باشد.");
    }
    setBusy(true);
    try {
      const result = await api.createAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        mode,
        ...(mode === "password" ? { password } : {}),
      });
      toast("حساب ساخته شد.");
      closeCreate();
      if (result.oneTimePassword) {
        setSecret({ email: result.account.email, value: result.oneTimePassword });
      }
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiFailure ? caught.message : "ساخت حساب انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (account: AdminUser, patch: Partial<Pick<AdminUser, "role" | "active" | "name">>) => {
    try {
      await api.updateAccount(account.id, patch);
      toast("حساب به‌روزرسانی شد.");
      onChanged();
    } catch (caught) {
      toast(caught instanceof ApiFailure ? caught.message : "به‌روزرسانی انجام نشد.", "error");
    }
  };

  const resetPassword = async (account: AdminUser) => {
    try {
      const result = await api.resetAccountPassword(account.id);
      setSecret({ email: account.email, value: result.oneTimePassword });
      onChanged();
    } catch (caught) {
      toast(caught instanceof ApiFailure ? caught.message : "تغییر گذرواژه انجام نشد.", "error");
    }
  };

  const remove = async (account: AdminUser) => {
    try {
      await api.deleteAccount(account.id);
      toast("حساب حذف شد.");
      onChanged();
    } catch (caught) {
      toast(caught instanceof ApiFailure ? caught.message : "حذف انجام نشد.", "error");
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("کپی انجام نشد؛ گذرواژه را دستی بردارید.", "error");
    }
  };

  return (
    <>
      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ACCESS / ROLES
            </span>
            <h2>مدیران و دسترسی‌ها</h2>
          </div>
          {isOwner ? (
            <button type="button" className="abtn abtn--primary abtn--sm" onClick={() => setCreating(true)}>
              <UserPlus />
              افزودن مدیر
            </button>
          ) : null}
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
                {isOwner ? <th aria-label="عملیات" /> : null}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const self = account.id === current.id;
                const fromEnv = account.source === "env";
                return (
                  <tr key={account.id} data-off={account.active === false}>
                    <td>
                      <strong>{account.name}</strong>
                      {self ? (
                        <span className="afield__hint" style={{ display: "block" }}>
                          حساب شما
                        </span>
                      ) : null}
                    </td>
                    <td dir="ltr" className="atable__mono">
                      {account.email}
                    </td>
                    <td>
                      {isOwner && !fromEnv && !self ? (
                        <select
                          className="aselect aselect--sm"
                          value={account.role}
                          onChange={(event) => void update(account, { role: event.target.value as AdminRole })}
                          aria-label={`نقش ${account.name}`}
                        >
                          {ROLES.map((value) => (
                            <option key={value} value={value}>
                              {ROLE_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`abadge ${BADGE[account.role]}`}>{ROLE_LABELS[account.role]}</span>
                      )}
                    </td>
                    <td title={formatDate(account.lastLoginAt)}>{timeAgo(account.lastLoginAt)}</td>
                    <td>
                      {fromEnv ? (
                        <span className="abadge abadge--muted" dir="ltr">
                          ENV
                        </span>
                      ) : (
                        <span className={`abadge ${account.active === false ? "abadge--danger" : "abadge--ok"}`}>
                          {account.active === false ? "غیرفعال" : "فعال"}
                        </span>
                      )}
                    </td>
                    {isOwner ? (
                      <td>
                        <div className="atable__tools">
                          {!fromEnv ? (
                            <>
                              <button
                                type="button"
                                className="abtn abtn--ghost abtn--sm"
                                onClick={() => void resetPassword(account)}
                                title="گذرواژهٔ تازه"
                              >
                                <KeyRound />
                              </button>
                              {!self ? (
                                <>
                                  <button
                                    type="button"
                                    className="abtn abtn--ghost abtn--sm"
                                    onClick={() => void update(account, { active: account.active === false })}
                                  >
                                    {account.active === false ? "فعال‌سازی" : "غیرفعال"}
                                  </button>
                                  <ConfirmButton
                                    label=""
                                    confirmLabel="حذف"
                                    ariaLabel={`حذف ${account.name}`}
                                    onConfirm={() => void remove(account)}
                                  />
                                </>
                              ) : null}
                            </>
                          ) : (
                            <span className="afield__hint" dir="ltr">
                              ENV
                            </span>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ROLES
            </span>
            <h2>نقش‌ها</h2>
          </div>
        </div>
        <div className="aroles">
          {ROLES.map((value) => (
            <div className="arole" key={value}>
              {value === "owner" ? <ShieldCheck /> : <Users />}
              <div>
                <strong>{ROLE_LABELS[value]}</strong>
                <p>{ROLE_DESCRIPTIONS[value]}</p>
              </div>
              <span className="afield__count" dir="ltr">
                {accounts.filter((account) => account.role === value).length}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={creating}
        title="افزودن مدیر"
        onClose={closeCreate}
        footer={
          <>
            <button type="button" className="abtn abtn--ghost" onClick={closeCreate} disabled={busy}>
              انصراف
            </button>
            <button type="button" className="abtn abtn--primary" onClick={() => void submitCreate()} disabled={busy}>
              {busy ? <LoaderCircle style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus />}
              ساختن حساب
            </button>
          </>
        }
      >
        <div className="aform">
          <Field label="نام">
            <input className="ainput" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </Field>
          <Field label="ایمیل">
            <input
              className="ainput"
              dir="ltr"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="نقش">
            <select className="aselect" value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="گذرواژه">
            <div className="aradio">
              <label>
                <input
                  type="radio"
                  name="account-mode"
                  checked={mode === "invite"}
                  onChange={() => setMode("invite")}
                />
                ساخت گذرواژهٔ یک‌بارمصرف
              </label>
              <label>
                <input
                  type="radio"
                  name="account-mode"
                  checked={mode === "password"}
                  onChange={() => setMode("password")}
                />
                تعیین گذرواژه
              </label>
            </div>
            {mode === "password" ? (
              <input
                className="ainput"
                dir="ltr"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
              />
            ) : null}
          </Field>
          {error ? (
            <p className="auth__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(secret)}
        title="گذرواژهٔ تازه"
        onClose={() => setSecret(null)}
        footer={
          <button type="button" className="abtn abtn--primary" onClick={() => setSecret(null)}>
            ذخیره شد
          </button>
        }
      >
        <div className="aform">
          <p className="afield__hint">
            این گذرواژه فقط یک بار نمایش داده می‌شود. آن را به‌صورت امن به {secret?.email} برسانید.
          </p>
          <div className="asecret">
            <code dir="ltr">{secret?.value}</code>
            <button type="button" className="abtn abtn--ghost abtn--sm" onClick={() => void copySecret()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
