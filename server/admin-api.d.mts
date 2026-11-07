import type { IncomingMessage, ServerResponse } from "node:http";

export interface AdminStorage {
  kind?: string;
  readStore: () => Promise<unknown>;
  writeStore: (value: unknown) => Promise<unknown>;
  readMedia: (name: string) => Promise<Buffer | null>;
  writeMedia: (name: string, buffer: Buffer) => Promise<void>;
  deleteMedia: (name: string) => Promise<void>;
}

export interface AdminApi {
  handle: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  middleware: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  storage: AdminStorage;
  uploadsDirectory?: string;
  storePath?: string;
}

export interface AdminApiOptions {
  root?: string;
  storage?: AdminStorage;
  env?: Record<string, string | undefined>;
}

export declare function createAdminApi(options?: AdminApiOptions): AdminApi;
export declare function createAdminMiddleware(
  options?: AdminApiOptions
): (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
