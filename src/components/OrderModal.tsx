import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { SERVICE_OPTIONS } from "../data";
import { normalizePhoneNumber } from "../utils/phone.mjs";
import { cn } from "../utils/cn";

type FieldName = "name" | "phone" | "email" | "service" | "message";
type Errors = Partial<Record<FieldName, string>>;
type Status = "idle" | "sending" | "success" | "error";
type ApiResponse = { ok?: boolean; code?: string; fields?: Errors };

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
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 80);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("hidden") && element.tabIndex >= 0);
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
    if (service && !SERVICE_OPTIONS.includes(service as (typeof SERVICE_OPTIONS)[number])) {
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
      setStatusMessage("درخواست شما با موفقیت ثبت شد. به‌زودی با شما تماس می‌گیریم.");
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
    cn("modal-input", extra, invalid && "modal-input--invalid");

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop"
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
        className="modal-panel"
      >
        <button type="button" onClick={onClose} aria-label="بستن" className="modal-close">
          <X aria-hidden="true" />
        </button>

        <div className="modal-body">
          <div className="modal-head">
            <span className="modal-eyebrow" dir="ltr">
              CAHEN / START A PROJECT
            </span>
            <h2 id="order-title" className="modal-title">
              ثبت درخواست مشاوره و سفارش
            </h2>
            <p id="order-description" className="modal-description">
              اطلاعات پروژه را بنویسید تا برای ادامه با شما تماس بگیریم.
            </p>
          </div>

          {status === "success" ? (
            <div role="status" className="modal-success">
              <span className="modal-success__icon" aria-hidden="true">
                <CheckCircle2 />
              </span>
              <p>{statusMessage}</p>
              <button type="button" onClick={onClose} className="btn btn--ghost">
                بستن پنجره
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="modal-form">
              <div className="modal-field">
                <label htmlFor="o-name" className="modal-label">
                  نام و نام خانوادگی <span className="req">*</span>
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
                {errors.name && (
                  <p id="e-name" className="modal-error">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="o-phone" className="modal-label">
                  شماره موبایل <span className="req">*</span>
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
                  className={fieldClass(Boolean(errors.phone), "modal-input--ltr")}
                />
                {errors.phone && (
                  <p id="e-phone" className="modal-error">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="o-email" className="modal-label">
                  ایمیل <small>(اختیاری)</small>
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
                  className={fieldClass(Boolean(errors.email), "modal-input--ltr")}
                />
                {errors.email && (
                  <p id="e-email" className="modal-error">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="o-service" className="modal-label">
                  نوع خدمت <small>(اختیاری)</small>
                </label>
                <select
                  id="o-service"
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  aria-invalid={Boolean(errors.service)}
                  aria-describedby={errors.service ? "e-service" : undefined}
                  className={fieldClass(Boolean(errors.service), "modal-select")}
                >
                  <option value="">انتخاب کنید…</option>
                  {SERVICE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.service && (
                  <p id="e-service" className="modal-error">
                    {errors.service}
                  </p>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="o-msg" className="modal-label">
                  توضیح کوتاه پروژه <small>(اختیاری)</small>
                </label>
                <textarea
                  id="o-msg"
                  rows={3}
                  maxLength={400}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "e-message" : undefined}
                  className={fieldClass(Boolean(errors.message), "modal-input--area")}
                />
                {errors.message && (
                  <p id="e-message" className="modal-error">
                    {errors.message}
                  </p>
                )}
              </div>

              <div className="modal-honeypot" aria-hidden="true">
                <label htmlFor="o-website">وب‌سایت</label>
                <input
                  id="o-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {status === "error" && (
                <div role="alert" className="modal-alert">
                  <AlertCircle aria-hidden="true" />
                  <p>{statusMessage}</p>
                </div>
              )}

              <button type="submit" disabled={status === "sending"} className="modal-submit">
                {status === "sending" ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    در حال ارسال…
                  </>
                ) : (
                  "ارسال درخواست"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
