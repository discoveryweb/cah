import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import mark from "../assets/cahen-mark.png";
import type { AdminUser } from "../content/types";
import { api, ApiFailure, type SessionInfo } from "./api";
import { Field, TextInput, useToast } from "./ui";

interface Props {
  session: SessionInfo;
  onAuthed: (admin: AdminUser) => void;
}

export function AuthScreen({ session, onAuthed }: Props) {
  const toast = useToast();
  const setup = session.setupRequired;
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);

  useEffect(() => {
    setError(null);
  }, [setup]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (setup) {
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        setError("نام کاربری باید ۳ تا ۳۲ نویسهٔ لاتین کوچک، رقم، نقطه، خط تیره یا زیرخط باشد.");
        return;
      }
      if (password.length < 8) {
        setError("گذرواژه باید حداقل ۸ نویسه باشد.");
        return;
      }
      if (password !== repeat) {
        setError("دو گذرواژه یکسان نیستند.");
        return;
      }
    }

    setBusy(true);
    try {
      const result = setup
        ? await api.setup({ username, password, name: name.trim() || username })
        : await api.login({ username: username.trim().toLowerCase(), password });
      toast(setup ? "حساب مالک ساخته شد. خوش آمدید." : "خوش آمدید.");
      onAuthed(result.admin);
    } catch (caught) {
      setError(caught instanceof ApiFailure ? caught.message : "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin">
      <span className="admin__grain" aria-hidden="true" />
      <div className="auth">
        <div className="auth__panel">
          <aside className="auth__aside">
            <div>
              <img className="auth__mark" src={mark} alt="" />
              <span className="aeyebrow" dir="ltr">
                CAHEN STUDIO / CONTROL ROOM
              </span>
              <h1>اتاق فرمان استودیو</h1>
              <p>
                اینجا متن‌ها، نمونه‌کارها و تصاویر سایت را مستقیم ویرایش می‌کنید. هر تغییر پس از ذخیره
                روی نسخهٔ زنده اعمال می‌شود.
              </p>
            </div>
            <div className="auth__aside-foot">
              <span dir="ltr">SHENATAISONI · ADMIN</span>
              <span dir="ltr">EST. 1404 — TEHRAN</span>
            </div>
          </aside>

          <form className="auth__form" onSubmit={submit}>
            <span className="aeyebrow" dir="ltr">
              {setup ? "FIRST RUN / OWNER SETUP" : "SECURE SIGN IN"}
            </span>
            <h2>{setup ? "ساخت حساب مالک" : "ورود به پنل"}</h2>
            <p>
              {setup
                ? "این نخستین اجراست. یک حساب مالک بسازید؛ بعد از این، همهٔ دسترسی‌ها از همین پنل مدیریت می‌شوند."
                : "نام کاربری و گذرواژهٔ خود را وارد کنید."}
            </p>

            {error ? (
              <p className="auth__error" role="alert">
                {error}
              </p>
            ) : null}

            {setup ? (
              <Field label="نام نمایشی" hint="مثلاً «سارا احمدی» یا نام استودیو.">
                <TextInput
                  value={name}
                  onChange={setName}
                  placeholder="نام شما"
                  autoComplete="name"
                  disabled={busy}
                />
              </Field>
            ) : null}

            <Field label="نام کاربری" hint={setup ? "لاتین کوچک؛ همین نام برای ورود استفاده می‌شود." : undefined}>
              <TextInput
                value={username}
                onChange={(value) => setUsername(setup ? value.toLowerCase() : value)}
                ltr
                placeholder="studio"
                autoComplete="username"
                disabled={busy}
              />
            </Field>

            <Field label="گذرواژه" hint={setup ? "حداقل ۸ نویسه؛ ترکیبی از حرف و رقم." : undefined}>
              <div style={{ position: "relative", display: "flex" }}>
                <input
                  className="ainput"
                  style={{ paddingInlineEnd: 44 }}
                  type={reveal ? "text" : "password"}
                  value={password}
                  dir="ltr"
                  autoComplete={setup ? "new-password" : "current-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyUp={(event) =>
                    setCapsLock(event.getModifierState ? event.getModifierState("CapsLock") : false)
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="abtn abtn--ghost abtn--icon abtn--sm"
                  style={{ position: "absolute", insetInlineEnd: 4, top: 4 }}
                  onClick={() => setReveal((current) => !current)}
                  aria-label={reveal ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                >
                  {reveal ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>

            {capsLock ? <p className="afield__hint">Caps Lock روشن است.</p> : null}

            {setup ? (
              <Field label="تکرار گذرواژه">
                <TextInput
                  value={repeat}
                  onChange={setRepeat}
                  type="password"
                  ltr
                  autoComplete="new-password"
                  disabled={busy}
                />
              </Field>
            ) : null}

            <button type="submit" className="abtn abtn--primary" disabled={busy} style={{ minHeight: 44 }}>
              {busy ? (
                <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
              ) : setup ? (
                <ShieldCheck />
              ) : (
                <LockKeyhole />
              )}
              {setup ? "ساخت حساب و ورود" : "ورود"}
            </button>

            <div className="auth__foot">
              <a href="/" className="abtn abtn--ghost abtn--sm">
                <ArrowLeft />
                بازگشت به سایت
              </a>
              <a href="/#contact" className="abtn abtn--ghost abtn--sm">
                پشتیبانی
                <ArrowUpRight />
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
