import { retryPendingOrders } from "../../server/orders.mjs";
import { createBlobsStorage } from "../../server/storage-blobs.mjs";

/**
 * Safety net for orders that were stored while Melipayamak settings were
 * missing or the provider was down. The panel also retries on demand; this
 * hourly sweep keeps the queue moving even if nobody opens the panel.
 */
export const config = { schedule: "@hourly" };

export default async function retryOrdersFunction() {
  try {
    const sent = await retryPendingOrders(createBlobsStorage(), { limit: 10 });
    if (sent > 0) console.log(`[retry-orders] delivered ${sent} queued order(s)`);
  } catch (error) {
    // Never fail the scheduled invocation; the next run retries.
    console.error("[retry-orders]", error?.name ?? error?.code ?? "unknown");
  }
}
