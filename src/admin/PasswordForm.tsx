import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import type { AdminUser } from "../content/types";
import { api, ApiFailure } from "./api";
import { Field, useToast } from "./ui";

interface Props {
  admin: AdminUser;
  onDone: (admin: AdminUser) => void;
  submitLabel?: string;
}

/**
 * Password changes happen entirely server-side: the current password is
 * verified against the stored scrypt hash and the new one is hashed before it
 * ever leaves the process.
 */
export function PasswordForm({ admin, onDone, submitLabel = "ذخیرهٔ گذرواژه" }: Props) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (admin.source !== "panel") {
    return <p className="afield__hint">گذرواژهٔ این حساب از محیط سرور خوانده می‌شود.</p>;
  }

  const submit = async () => {
    setError(null);
    if (!current) return setError("گذرواژهٔ فعلی را وارد کنید.");
    if (next.length < 12) return setError("گذرواژهٔ تازه باید حداقل ۱۲ نویسه باشد.");
    if (next !== confirm) return setError("گذرواژهٔ تازه و تکرار آن یکسان نیست.");
    setBusy(true);
    try {
      const result = await api.changePassword({ currentPassword: current, newPassword: next });
      toast("گذرواژه تغییر کرد.");
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone(result.admin);
    } catch (caught) {
      setError(caught instanceof ApiFailure ? caught.message : "تغییر گذرواژه انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aform">
      <Field label="گذرواژهٔ فعلی">
        <input
          className="ainput"
          dir="ltr"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </Field>
      <Field label="گذرواژهٔ تازه">
        <input
          className="ainput"
          dir="ltr"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </Field>
      <Field label="تکرار گذرواژهٔ تازه">
        <input
          className="ainput"
          dir="ltr"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>
      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="abtn abtn--primary"
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? <LoaderCircle style={{ animation: "spin 1s linear infinite" }} /> : <KeyRound />}
        {submitLabel}
      </button>
    </div>
  );
}
