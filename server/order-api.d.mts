import type { IncomingMessage, ServerResponse } from "node:http";

export function createOrderHandler(options?: { fetchImpl?: typeof fetch }): (
  request: IncomingMessage,
  response: ServerResponse,
  next?: (error?: Error) => void,
) => void | Promise<void>;
