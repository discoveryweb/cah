import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { OrderRecord, SmsStatus, SmsSummary } from "../content/types";
import { api, ApiFailure } from "./api";
import { formatDate } from "./draft";
import { ConfirmButton, useToast } from "./ui";

const STATUS: Record<SmsStatus, { label: string; className: string }> = {
  sent: { label: "ارسال شد", className: "abadge--ok" },
  partial: { label: "ناقص", className: "abadge--warn" },
  failed: { label: "ناموفق", className: "abadge--danger" },
  pending: { label: "در صف", className: "abadge--muted" },
};

const toLocalPhone = (value: string) => {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+98")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
};

interface Props {
  sms: SmsSummary | null;
  viewerBlocked: boolean;
  onChanged: () => void;
}

export function OrdersPanel({ sms, viewerBlocked, onChanged }: Props) {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (viewerBlocked) return;
    setLoading(true);
    try {
      const result = await api.orders();
      setOrders(result.orders);
    } catch (error) {
      if (!(error instanceof ApiFailure && error.status === 401)) {
        toast(error instanceof ApiFailure ? error.message : "خواندن سفارش‌ها انجام نشد.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [toast, viewerBlocked]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) =>
      [order.name, order.phone, order.code, order.service, order.email]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [orders, query]);

  const pending = orders.filter((order) => order.sms?.status !== "sent").length;

  const retry = async (order: OrderRecord) => {
    setBusyId(order.id);
    try {
      const result = await api.retryOrder(order.id);
      setOrders((current) => current.map((entry) => (entry.id === order.id ? result.order : entry)));
      toast(
        result.order.sms?.status === "sent"
          ? "پیامک سفارش ارسال شد."
          : "ارسال انجام نشد؛ سفارش در صف ماند.",
        result.order.sms?.status === "sent" ? "ok" : "error"
      );
      onChanged();
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "ارسال دوباره انجام نشد.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (order: OrderRecord) => {
    setBusyId(order.id);
    try {
      await api.deleteOrder(order.id);
      setOrders((current) => current.filter((entry) => entry.id !== order.id));
      toast("سفارش حذف شد.");
      onChanged();
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "حذف انجام نشد.", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (viewerBlocked) {
    return (
      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">ORDERS</span>
            <h2>سفارش‌ها</h2>
          </div>
        </div>
        <div className="acard__body">
          <p className="afield__hint">برای دیدن سفارش‌ها دسترسی ویرایشگر لازم است.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {sms && !sms.configured ? (
        <div className="anote anote--warn" role="status">
          <ShieldAlert />
          <span>
            پیامک تنظیم نشده است؛ سفارش‌ها ذخیره می‌شوند و پس از تنظیم، دستی یا خودکار ارسال می‌شوند.
          </span>
        </div>
      ) : null}

      <section className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              ORDERS / SMS DELIVERY
            </span>
            <h2>سفارش‌ها</h2>
          </div>
          <div className="atoolbar">
            <span className="abadge abadge--muted">{orders.length} سفارش</span>
            {pending > 0 ? <span className="abadge abadge--warn">{pending} در صف</span> : null}
            <button
              type="button"
              className="abtn abtn--ghost abtn--sm"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <RefreshCw />
              )}
              تازه‌سازی
            </button>
          </div>
        </div>

        <div className="acard__body">
          <label className="asearch">
            <Search aria-hidden="true" />
            <input
              className="ainput"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی نام، شماره یا کد"
              aria-label="جست‌وجوی سفارش"
            />
          </label>

          {loading && orders.length === 0 ? (
            <div className="admin-loading">
              <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
              <span>در حال خواندن سفارش‌ها…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="aempty">
              <Inbox />
              <span>{orders.length === 0 ? "سفارشی ثبت نشده است." : "نتیجه‌ای پیدا نشد."}</span>
            </div>
          ) : (
            <ul className="aorders">
              {filtered.map((order) => {
                const status = STATUS[order.sms?.status ?? "pending"];
                const expanded = openId === order.id;
                return (
                  <li className="aorder" key={order.id} data-open={expanded}>
                    <button
                      type="button"
                      className="aorder__head"
                      onClick={() => setOpenId(expanded ? null : order.id)}
                      aria-expanded={expanded}
                    >
                      <span className="aorder__code" dir="ltr">
                        {order.code}
                      </span>
                      <span className="aorder__name">
                        <b>{order.name}</b>
                        <em dir="ltr">{toLocalPhone(order.phone)}</em>
                      </span>
                      <span className="aorder__service">{order.service || "—"}</span>
                      <span className={`abadge ${status.className}`}>{status.label}</span>
                      <time dateTime={order.at}>{formatDate(order.at)}</time>
                      <ChevronDown aria-hidden="true" />
                    </button>

                    {expanded ? (
                      <div className="aorder__body">
                        <dl className="akv">
                          <div>
                            <dt><Phone aria-hidden="true" /> موبایل</dt>
                            <dd dir="ltr">{toLocalPhone(order.phone)}</dd>
                          </div>
                          <div>
                            <dt><Mail aria-hidden="true" /> ایمیل</dt>
                            <dd dir="ltr">{order.email || "—"}</dd>
                          </div>
                          <div>
                            <dt><MessageSquare aria-hidden="true" /> خدمت</dt>
                            <dd>{order.service || "—"}</dd>
                          </div>
                          <div>
                            <dt><Send aria-hidden="true" /> پیامک</dt>
                            <dd>
                              {status.label} · {order.sms?.sentParts ?? 0}/{order.sms?.parts ?? 0} بخش
                              {order.sms?.attempts ? ` · ${order.sms.attempts} تلاش` : ""}
                            </dd>
                          </div>
                        </dl>

                        {order.message ? <p className="aorder__message">{order.message}</p> : null}
                        {order.sms?.error ? (
                          <p className="aorder__error" dir="auto">
                            <AlertTriangle aria-hidden="true" />
                            {order.sms.error}
                          </p>
                        ) : null}
                        {order.sms?.status === "sent" ? (
                          <p className="aorder__ok" dir="auto">
                            <CheckCircle2 aria-hidden="true" />
                            {formatDate(order.sms.sentAt)}
                          </p>
                        ) : null}

                        <div className="aorder__actions">
                          {order.sms?.status !== "sent" ? (
                            <button
                              type="button"
                              className="abtn abtn--primary abtn--sm"
                              onClick={() => void retry(order)}
                              disabled={busyId === order.id}
                            >
                              {busyId === order.id ? (
                                <LoaderCircle style={{ animation: "spin 1s linear infinite" }} />
                              ) : (
                                <Send />
                              )}
                              ارسال دوباره
                            </button>
                          ) : null}
                          <ConfirmButton
                            label="حذف"
                            confirmLabel="حذف قطعی"
                            onConfirm={() => void remove(order)}
                            disabled={busyId === order.id}
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
