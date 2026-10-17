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
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 50);

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
      const result = await response.json().catch(() => ({})) as ApiResponse;

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

  const field =
    "h-11 w-full rounded-xl border bg-ink/70 px-3.5 text-sm text-txt placeholder:text-muted transition-colors focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#03051a]/80 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 h-full w-full cursor-default border-0 bg-transparent"
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
        className="order-modal-panel relative z-10 max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-txt-2 transition-colors hover:bg-white/10 hover:text-txt focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <h2 id="order-title" className="pe-10 text-xl font-extrabold text-txt">
          ثبت درخواست مشاوره و سفارش
        </h2>
        <p id="order-description" className="mt-1 text-xs leading-6 text-txt-2">
          اطلاعات پروژه را بنویسید تا برای ادامه با شما تماس بگیریم.
        </p>

        {status === "success" ? (
          <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{statusMessage}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="o-name" className="mb-1.5 block text-xs font-medium text-txt-2">
                نام و نام خانوادگی <span className="text-lav">*</span>
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
                className={cn(field, errors.name ? "border-red-400/70" : "border-line")}
              />
              {errors.name && <p id="e-name" className="mt-1 text-xs text-red-300">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="o-phone" className="mb-1.5 block text-xs font-medium text-txt-2">
                شماره موبایل <span className="text-lav">*</span>
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
                className={cn(field, "text-right placeholder:text-right", errors.phone ? "border-red-400/70" : "border-line")}
              />
              {errors.phone && <p id="e-phone" className="mt-1 text-xs text-red-300">{errors.phone}</p>}
            </div>

            <div>
              <label htmlFor="o-email" className="mb-1.5 block text-xs font-medium text-txt-2">
                ایمیل <span className="text-muted">(اختیاری)</span>
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
                className={cn(field, errors.email ? "border-red-400/70" : "border-line")}
              />
              {errors.email && <p id="e-email" className="mt-1 text-xs text-red-300">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="o-service" className="mb-1.5 block text-xs font-medium text-txt-2">
                نوع خدمت <span className="text-muted">(اختیاری)</span>
              </label>
              <select
                id="o-service"
                value={service}
                onChange={(event) => setService(event.target.value)}
                aria-invalid={Boolean(errors.service)}
                aria-describedby={errors.service ? "e-service" : undefined}
                className={cn(field, errors.service ? "border-red-400/70" : "border-line")}
              >
                <option value="">انتخاب کنید…</option>
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {errors.service && <p id="e-service" className="mt-1 text-xs text-red-300">{errors.service}</p>}
            </div>

            <div>
              <label htmlFor="o-msg" className="mb-1.5 block text-xs font-medium text-txt-2">
                توضیح کوتاه پروژه <span className="text-muted">(اختیاری)</span>
              </label>
              <textarea
                id="o-msg"
                rows={4}
                maxLength={400}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "e-message" : undefined}
                className={cn(field, "h-auto resize-y py-2.5 leading-7", errors.message ? "border-red-400/70" : "border-line")}
              />
              {errors.message && <p id="e-message" className="mt-1 text-xs text-red-300">{errors.message}</p>}
            </div>

            <div className="order-modal__honeypot" aria-hidden="true">
              <label htmlFor="o-website">وب‌سایت</label>
              <input id="o-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </div>

            {status === "error" && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs leading-6 text-red-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{statusMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="order-modal__submit flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-all disabled:cursor-wait disabled:opacity-60"
            >
              {status === "sending" ? (
                <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> در حال ارسال…</>
              ) : "ارسال درخواست"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
