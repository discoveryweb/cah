import type { IncomingMessage, ServerResponse } from "node:http";

export interface AdminApi {
  handle: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  middleware: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  uploadsDirectory: string;
  storePath: string;
}

export declare function createAdminApi(options: { root: string }): AdminApi;
export declare function createAdminMiddleware(options: {
  root: string;
}): (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
