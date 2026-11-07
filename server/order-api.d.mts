import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminStorage } from "./admin-api.d.mts";

export interface OrderHandlerOptions {
  storage?: AdminStorage;
  root?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export declare function createOrderHandler(
  options?: OrderHandlerOptions
): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
