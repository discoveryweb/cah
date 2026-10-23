import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpLeft, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { normalizePhoneNumber } from "../utils/phone.mjs";
import { cn } from "../utils/cn";

type FieldName = "name" | "phone" | "email" | "service" | "message";
type Errors = Partial<Record<FieldName, string>>;
type Status = "idle" | "sending" | "success" | "error";
type ApiResponse = {
  ok?: boolean;
  code?: string;
  fields?: Errors;
  duplicate?: boolean;
  queued?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OrderModal({
  open,
  onClose,
  initialService,
}: {
  open: boolean;
  onClose: () => void;
  initialService?: string;
}) {
  const content = useContent();
  const serviceOptions = content.services.items.map((item) => item.option || item.title);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setName("");
    setPhone("");
    setEmail("");
    setService(initialService ?? "");
    setMessage("");
    setWebsite("");
    setErrors({});
    setStatus("idle");
    setStatusMessage("");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /*
     * On a phone the keyboard must not ambush the sheet as it slides up, so the
     * focus lands on the close control inside the dialog instead of a field.
     */
    const focusTimer = window.setTimeout(() => {
      if (window.matchMedia("(pointer: coarse)").matches) {
        dialogRef.current?.querySelector<HTMLElement>(".modal__close")?.focus();
        return;
      }
      firstFieldRef.current?.focus();
    }, 90);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusRef.current?.focus?.();
    };
  }, [open, initialService, onClose]);

  if (!open) return null;

  const validate = (): Errors => {
    const nextErrors: Errors = {};
    if (name.trim().length < 2) nextErrors.name = "لطفاً نام و نام خانوادگی خود را وارد کنید.";
    if (!phone.trim()) nextErrors.phone = "واردکردن شماره موبایل لازم است.";
    else if (!normalizePhoneNumber(phone)) nextErrors.phone = "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷).";
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) nextErrors.email = "نشانی ایمیل معتبر نیست.";
    if (service && !serviceOptions.includes(service)) {
      nextErrors.service = "نوع خدمت انتخاب‌شده معتبر نیست.";
    }
    if (message.trim().length > 400) nextErrors.message = "توضیح پروژه حداکثر ۴۰۰ نویسه باشد.";
    return nextErrors;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setStatusMessage("");
    if (Object.keys(nextErrors).length) return;

    setStatus("sending");
    try {
      const response = await fetch("/api/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhoneNumber(phone),
          email: email.trim(),
          service: service.trim(),
          message: message.trim(),
          website,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || result.ok !== true) {
        if (result.fields) setErrors(result.fields);
        setStatus("error");
        if (response.status === 503 || result.code === "not_configured") {
          setStatusMessage("سرویس دریافت درخواست هنوز تنظیم نشده است. لطفاً کمی بعد دوباره تلاش کنید.");
        } else if (response.status === 429) {
          setStatusMessage("درخواست‌های زیادی ثبت شده؛ لطفاً کمی بعد دوباره تلاش کنید.");
        } else if (result.fields) {
          setStatusMessage("اطلاعات مشخص‌شده را بررسی کنید و دوباره بفرستید.");
        } else {
          setStatusMessage("ارسال درخواست انجام نشد. لطفاً اتصال را بررسی و دوباره تلاش کنید.");
        }
        return;
      }

      setStatus("success");
      setStatusMessage(
        result.duplicate
          ? "این درخواست پیش‌تر ثبت شده است؛ به‌زودی با شما تماس می‌گیریم."
          : "درخواست شما با موفقیت ثبت شد. به‌زودی با شما تماس می‌گیریم."
      );
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setStatusMessage("ارتباط برقرار نشد. لطفاً اینترنت را بررسی و دوباره تلاش کنید.");
    }
  };

  const fieldClass = (invalid: boolean, extra?: string) =>
    cn("field__input", extra, invalid && "field__input--invalid");

  return (
    <div className="modal">
      <button
        type="button"
        className="modal__backdrop"
        onClick={onClose}
        aria-label="بستن پنجرهٔ ثبت درخواست"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-title"
        aria-describedby="order-description"
        className="modal__panel"
      >
        <div className="modal__bar">
          <span dir="ltr">CAHEN / START A PROJECT</span>
          <button type="button" onClick={onClose} className="modal__close" aria-label="بستن">
            <span>بستن</span>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="modal__scroll">
          <span className="modal__eyebrow" dir="ltr">
            LET&apos;S BUILD SOMETHING
          </span>
          <h2 id="order-title" className="modal__title">
            {content.order.title}
          </h2>
          <p id="order-description" className="modal__desc">
            {content.order.description}
          </p>

          {status === "success" ? (
            <div role="status" className="modal__success">
              <span className="modal__success-icon" aria-hidden="true">
                <CheckCircle2 />
              </span>
              <p>{statusMessage}</p>
              <button type="button" onClick={onClose} className="btn btn--light btn--sm">
                <span>بستن پنجره</span>
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="modal__form">
              <div className="field">
                <label htmlFor="o-name" className="field__label">
                  نام و نام خانوادگی <span className="field__req">*</span>
                </label>
                <input
                  id="o-name"
                  ref={firstFieldRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "e-name" : undefined}
                  className={fieldClass(Boolean(errors.name))}
                />
                {errors.name ? (
                  <p id="e-name" className="field__error">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="o-phone" className="field__label">
                  شماره موبایل <span className="field__req">*</span>
                </label>
                <input
                  id="o-phone"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="09123456789"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={24}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "e-phone" : undefined}
                  className={fieldClass(Boolean(errors.phone), "field__input--ltr")}
                />
                {errors.phone ? (
                  <p id="e-phone" className="field__error">
                    {errors.phone}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="o-email" className="field__label">
                  ایمیل <small>اختیاری</small>
                </label>
                <input
                  id="o-email"
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "e-email" : undefined}
                  className={fieldClass(Boolean(errors.email), "field__input--ltr")}
                />
                {errors.email ? (
                  <p id="e-email" className="field__error">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="o-service" className="field__label">
                  نوع خدمت <small>اختیاری</small>
                </label>
                <select
                  id="o-service"
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  aria-invalid={Boolean(errors.service)}
                  aria-describedby={errors.service ? "e-service" : undefined}
                  className={fieldClass(Boolean(errors.service), "field__select")}
                >
                  <option value="">انتخاب کنید…</option>
                  {serviceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.service ? (
                  <p id="e-service" className="field__error">
                    {errors.service}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="o-msg" className="field__label">
                  توضیح کوتاه پروژه <small>اختیاری</small>
                </label>
                <textarea
                  id="o-msg"
                  rows={3}
                  maxLength={400}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "e-message" : undefined}
                  className={fieldClass(Boolean(errors.message), "field__input--area")}
                />
                {errors.message ? (
                  <p id="e-message" className="field__error">
                    {errors.message}
                  </p>
                ) : null}
              </div>

              <div className="modal__honeypot" aria-hidden="true">
                <label htmlFor="o-website">وب‌سایت</label>
                <input
                  id="o-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {status === "error" ? (
                <div role="alert" className="modal__alert">
                  <AlertCircle aria-hidden="true" />
                  <p>{statusMessage}</p>
                </div>
              ) : null}

              <button type="submit" disabled={status === "sending"} className="modal__submit">
                {status === "sending" ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    <span>در حال ارسال…</span>
                  </>
                ) : (
                  <>
                    <span>{content.order.submitLabel}</span>
                    <ArrowUpLeft aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
