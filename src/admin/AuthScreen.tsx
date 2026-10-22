import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import mark from "../assets/cahen-mark.png";
import type { AdminUser } from "../content/types";
import { api, ApiFailure, type SessionInfo } from "./api";
import { Field, useToast } from "./ui";

interface Props {
  session: SessionInfo;
  onAuthed: (admin: AdminUser) => void;
}

export function AuthScreen({ session, onAuthed }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("ایمیل و گذرواژه را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.login({ email: email.trim().toLowerCase(), password });
      toast("خوش آمدید.");
      onAuthed(result.admin);
    } catch (caught) {
      setError(
        caught instanceof ApiFailure ? caught.message : "ارتباط با سرور برقرار نشد."
      );
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
              <span dir="ltr">SECURED · SERVER-SIDE SESSION</span>
            </div>
          </aside>

          {session.configured ? (
            <form className="auth__form" onSubmit={submit} autoComplete="on">
              <span className="aeyebrow" dir="ltr">
                SECURE SIGN IN
              </span>
              <h2>ورود به پنل</h2>
              <p>با ایمیل و گذرواژهٔ تعریف‌شده در متغیرهای محیطی سرور وارد شوید.</p>

              {error ? (
                <p className="auth__error" role="alert">
                  {error}
                </p>
              ) : null}

              <Field label="ایمیل" hint="همان ایمیلی که در ADMIN_EMAIL تنظیم شده است.">
                <input
                  className="ainput"
                  dir="ltr"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={busy}
                  placeholder="you@studio.com"
                />
              </Field>

              <Field label="گذرواژه">
                <div style={{ position: "relative", display: "flex" }}>
                  <input
                    className="ainput"
                    style={{ paddingInlineEnd: 44 }}
                    type={reveal ? "text" : "password"}
                    value={password}
                    dir="ltr"
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={(event) =>
                      setCapsLock(event.getModifierState ? event.getModifierState("CapsLock") : false)
                    }
                    required
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

              <button type="submit" className="abtn abtn--primary" disabled={busy} style={{ minHeight: 44 }}>
                {busy ? <LoaderCircle style={{ animation: "spin 1s linear infinite" }} /> : <LockKeyhole />}
                ورود
              </button>

              <p className="afield__hint" style={{ lineHeight: 1.9 }}>
                نشست شما {session.sessionHours} ساعت معتبر است. گذرواژه در پنل قابل تغییر نیست و فقط از
                طریق متغیرهای محیطی سرور مدیریت می‌شود.
              </p>

              <div className="auth__foot">
                <a href="/" className="abtn abtn--ghost abtn--sm">
                  <ArrowLeft />
                  بازگشت به سایت
                </a>
                <span dir="ltr">SESSION {session.sessionHours}H</span>
              </div>
            </form>
          ) : (
            <div className="auth__form">
              <span className="aeyebrow" dir="ltr">
                CONFIGURATION REQUIRED
              </span>
              <h2>
                <ShieldAlert style={{ width: 20, height: 20, verticalAlign: "-3px", marginInlineEnd: 8 }} />
                پنل هنوز پیکربندی نشده
              </h2>
              <p>
                برای امنیت، هیچ حساب پیش‌فرض یا گذرواژهٔ داخلی وجود ندارد. این متغیرها را در تنظیمات
                محیطی سرور (برای Netlify در Site configuration → Environment variables) تعریف کنید و
                دوباره مستقر کنید:
              </p>
              <ul className="aenvlist" dir="ltr">
                <li><code>ADMIN_EMAIL</code></li>
                <li><code>ADMIN_PASSWORD_HASH</code> <span>← npm run admin:hash</span></li>
                <li><code>ADMIN_SESSION_SECRET</code> <span>← ۳۲+ نویسهٔ تصادفی</span></li>
                <li><code>ADMIN_NAME</code> <span>optional</span></li>
              </ul>

              <div className="anote">
                <ShieldCheck />
                <span>
                  گذرواژهٔ خام را در متغیرها نگه ندارید؛ از هش scrypt استفاده کنید. متغیرها فقط سمت سرور
                  خوانده می‌شوند و هرگز با پیشوند <code dir="ltr">VITE_</code> تعریف نمی‌شوند.
                </span>
              </div>

              {session.issues.length > 0 ? (
                <ul className="aissues">
                  {session.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
