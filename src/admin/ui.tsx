import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiFailure, prepareImage } from "./api";

/* ------------------------------- Toasts ------------------------------- */

type ToastTone = "ok" | "error";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="atoasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="atoast" key={toast.id} data-tone={toast.tone}>
            {toast.tone === "ok" ? <Check /> : <AlertTriangle />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------- Fields ------------------------------- */

export function Field({
  label,
  hint,
  error,
  path,
  children,
  counter,
}: {
  label: string;
  hint?: string;
  error?: string;
  path?: string;
  children: ReactNode;
  counter?: string;
}) {
  return (
    <label className="afield">
      <span className="afield__label">
        {label}
        {path ? <span className="afield__key" dir="ltr">{path}</span> : null}
      </span>
      {children}
      {hint ? <span className="afield__hint">{hint}</span> : null}
      {error ? <span className="afield__error">{error}</span> : null}
      {counter ? <span className="afield__count" dir="ltr">{counter}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ltr,
  required,
  error,
  type = "text",
  autoComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ltr?: boolean;
  required?: boolean;
  error?: boolean;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <input
      className={`ainput${error ? " ainput--invalid" : ""}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      dir={ltr ? "ltr" : undefined}
      required={required}
      type={type}
      autoComplete={autoComplete}
      disabled={disabled}
      spellCheck={false}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  ltr,
  error,
  hint,
  disabled,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  ltr?: boolean;
  error?: boolean;
  hint?: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <>
      <textarea
        className={`atextarea${error ? " atextarea--invalid" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        dir={ltr ? "ltr" : undefined}
        disabled={disabled}
        maxLength={maxLength}
      />
      {hint ? <span className="afield__hint">{hint}</span> : null}
    </>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="afield">
      <span className="afield__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          display: "inline-flex",
          width: 44,
          height: 24,
          alignItems: "center",
          padding: 3,
          border: "1px solid rgba(190,176,255,0.24)",
          borderRadius: 999,
          background: checked ? "rgba(129,84,246,0.6)" : "rgba(255,255,255,0.06)",
          transition: "background 240ms ease",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transform: `translateX(${checked ? -20 : 0}px)`,
            transition: "transform 240ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </button>
      {hint ? <span className="afield__hint">{hint}</span> : null}
    </label>
  );
}

/* ---------------------------- List editors ---------------------------- */

export function StringList({
  items,
  onChange,
  placeholder,
  addLabel = "افزودن",
  ltr,
  disabled,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  ltr?: boolean;
  disabled?: boolean;
}) {
  const update = (index: number, value: string) => {
    const next = items.slice();
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="alist">
      {items.map((item, index) => (
        <div className="arow" key={index}>
          <span className="arow__handle" dir="ltr">
            {String(index + 1).padStart(2, "0")}
          </span>
          <input
            className="ainput"
            value={item}
            dir={ltr ? "ltr" : undefined}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => update(index, event.target.value)}
          />
          <span className="arow__tools">
            <button
              type="button"
              className="abtn abtn--ghost abtn--icon abtn--sm"
              aria-label="بالا"
              disabled={disabled || index === 0}
              onClick={() => {
                const next = items.slice();
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              <ArrowUp />
            </button>
            <button
              type="button"
              className="abtn abtn--ghost abtn--icon abtn--sm"
              aria-label="پایین"
              disabled={disabled || index === items.length - 1}
              onClick={() => {
                const next = items.slice();
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                onChange(next);
              }}
            >
              <ArrowDown />
            </button>
            <button
              type="button"
              className="abtn abtn--ghost abtn--icon abtn--sm"
              aria-label="حذف"
              disabled={disabled}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
            >
              <Trash2 />
            </button>
          </span>
        </div>
      ))}
      <button
        type="button"
        className="abtn abtn--sm"
        disabled={disabled}
        onClick={() => onChange([...items, ""])}
        style={{ justifySelf: "start" }}
      >
        <Plus />
        {addLabel}
      </button>
    </div>
  );
}

/* ---------------------------- Image picker ---------------------------- */

export function ImagePicker({
  value,
  onChange,
  label = "تصویر",
  alt,
  hint,
  disabled,
  aspect,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  alt?: string;
  hint?: string;
  disabled?: boolean;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const toast = useToast();
  const errorId = useId();

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("فقط فایل تصویری قابل بارگذاری است.", "error");
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const result = await api.upload(prepared, file.name.replace(/\.[^.]+$/, ""));
      onChange(result.url);
      toast("تصویر بارگذاری شد.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "بارگذاری تصویر انجام نشد.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="afield">
      <span className="afield__label">{label}</span>
      <div className="amedia">
        <div
          className="amedia__preview"
          data-dragging={dragging}
          style={aspect ? { aspectRatio: aspect } : undefined}
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (disabled) return;
            const file = event.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
        >
          {value ? (
            <img src={value} alt={alt ?? ""} />
          ) : (
            <span className="amedia__empty">تصویری انتخاب نشده</span>
          )}
          {busy ? (
            <span className="amedia__drop amedia__drop--busy">
              <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
            </span>
          ) : null}
          {!disabled && !busy ? (
            <span className="amedia__drop amedia__drop--hint">برای بارگذاری، تصویر را اینجا رها کنید</span>
          ) : null}
        </div>

        <div className="amedia__tools">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="abtn abtn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            <Upload />
            بارگذاری تصویر
          </button>
          <button
            type="button"
            className="abtn abtn--ghost abtn--sm"
            onClick={() => setUrlMode((current) => !current)}
            disabled={disabled}
          >
            <ImagePlus />
            نشانی تصویر
          </button>
          {value ? (
            <button
              type="button"
              className="abtn abtn--ghost abtn--sm"
              onClick={() => onChange("")}
              disabled={disabled}
            >
              <Trash2 />
              حذف
            </button>
          ) : null}
        </div>

        {urlMode ? (
          <input
            className="ainput"
            dir="ltr"
            value={value}
            placeholder="/media/image.webp یا https://…"
            aria-describedby={errorId}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          />
        ) : null}
        {hint ? <span className="afield__hint" id={errorId}>{hint}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="amodal" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        className="amodal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        style={wide ? { width: "min(1040px, 100%)" } : undefined}
      >
        <div className="amodal__head">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="abtn abtn--ghost abtn--icon" onClick={onClose} aria-label="بستن">
            <X />
          </button>
        </div>
        <div className="amodal__body">{children}</div>
        {footer ? <div className="amodal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------- Confirm button ---------------------------- */

export function ConfirmButton({
  label,
  confirmLabel = "مطمئن‌اید؟",
  onConfirm,
  className = "abtn abtn--danger abtn--sm",
  disabled,
  icon = true,
  ariaLabel,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  icon?: boolean;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={ariaLabel ?? (label || confirmLabel)}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {icon ? <Trash2 /> : null}
      {armed ? confirmLabel : label}
    </button>
  );
}
