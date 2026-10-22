import { randomBytes } from "node:crypto";
import { sendOrderSms, readSmsConfiguration } from "./order-sms.mjs";

export const ORDERS_KEY = "orders";
const MAX_ORDERS = 500;

export const emptyOrders = () => ({ version: 1, items: [] });

const normaliseOrderDocument = (document) => {
  if (!document || typeof document !== "object" || !Array.isArray(document.items)) {
    return emptyOrders();
  }
  return { version: 1, items: document.items.filter((entry) => entry && typeof entry.id === "string") };
};

export async function readOrders(storage) {
  try {
    return normaliseOrderDocument(await storage.readJson(ORDERS_KEY));
  } catch {
    return emptyOrders();
  }
}

const matches = (entry, id) => entry.id === id || entry.code === id;

/** Stores the order first so a notification failure can never lose a lead. */
export async function appendOrder(storage, data) {
  const now = new Date().toISOString();
  const id = randomBytes(10).toString("hex");
  const order = {
    id,
    code: `C-${id.slice(0, 6).toUpperCase()}`,
    at: now,
    name: data.name,
    phone: data.phone,
    email: data.email,
    service: data.service,
    message: data.message,
    sms: {
      status: "pending",
      attempts: 0,
      parts: 0,
      sentParts: 0,
      error: null,
      lastAttemptAt: null,
      sentAt: null,
    },
  };

  await storage.updateJson(ORDERS_KEY, (current) => {
    const document = normaliseOrderDocument(current);
    document.items.unshift(order);
    document.items = document.items.slice(0, MAX_ORDERS);
    return document;
  });

  return order;
}

export async function updateOrder(storage, id, patch) {
  let updated = null;
  await storage.updateJson(ORDERS_KEY, (current) => {
    const document = normaliseOrderDocument(current);
    document.items = document.items.map((entry) => {
      if (!matches(entry, id)) return entry;
      updated = { ...entry, ...patch };
      return updated;
    });
    return document;
  });
  return updated;
}

export async function findOrder(storage, id) {
  const document = await readOrders(storage);
  return document.items.find((entry) => matches(entry, id)) ?? null;
}

export async function deleteOrder(storage, id) {
  let removed = false;
  await storage.updateJson(ORDERS_KEY, (current) => {
    const document = normaliseOrderDocument(current);
    const before = document.items.length;
    document.items = document.items.filter((entry) => !matches(entry, id));
    removed = document.items.length < before;
    return document;
  });
  return removed;
}

/** Sends (or re-sends) the SMS and records the result on the stored order. */
export async function deliverOrder(storage, order, options = {}) {
  if (!order) return null;
  const result = await sendOrderSms(order, options);
  const now = new Date().toISOString();
  const patch = {
    sms: {
      status: result.status,
      attempts: (order.sms?.attempts ?? 0) + 1,
      parts: result.parts,
      sentParts: result.sentParts,
      error: result.error,
      lastAttemptAt: now,
      sentAt: result.status === "sent" ? now : order.sms?.sentAt ?? null,
      references: result.references ?? [],
    },
  };
  return updateOrder(storage, order.id, patch);
}

export async function retryOrder(storage, id, options = {}) {
  const order = await findOrder(storage, id);
  if (!order) return null;
  return deliverOrder(storage, order, options);
}

/**
 * Delivers orders that could not be texted earlier (missing settings, provider
 * outage). Called opportunistically when the operator opens the Orders tab and
 * when a new order arrives, so a late configuration heals the queue without a
 * cron job or a manual click per order.
 */
export async function retryPendingOrders(storage, { limit = 3, env = process.env, fetchImpl = fetch } = {}) {
  if (!readSmsConfiguration(env).configured) return 0;
  const document = await readOrders(storage);
  const queued = document.items
    .filter((entry) => ["pending", "failed"].includes(entry.sms?.status) && (entry.sms?.attempts ?? 0) < 5)
    .slice(-limit);
  let sent = 0;
  for (const order of queued) {
    const updated = await deliverOrder(storage, order, { env, fetchImpl });
    if (updated?.sms?.status === "sent") sent += 1;
  }
  return sent;
}

export function smsSummary(env = process.env) {
  const configuration = readSmsConfiguration(env);
  return { configured: configuration.configured, missing: configuration.missing };
}

export async function pendingOrderCount(storage) {
  const document = await readOrders(storage);
  return document.items.filter((entry) => entry.sms?.status !== "sent").length;
}
