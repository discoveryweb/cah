import type { AdminStorage } from "./admin-api.d.mts";

export interface JsonKeyStorage {
  readJson: (key: string) => Promise<unknown>;
  writeJson: (key: string, value: unknown) => Promise<unknown>;
  updateJson: (key: string, updater: (current: unknown) => unknown) => Promise<unknown>;
}

export declare function createFsStorage(options: {
  dataDirectory: string;
}): AdminStorage & JsonKeyStorage;
