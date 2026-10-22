import path from "node:path";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

/**
 * File-system storage used by the self-hosted Node server and the Vite dev
 * middleware. Data never leaves the machine; the directory is git-ignored.
 */
export function createFsStorage({ dataDirectory }) {
  const uploadsDirectory = path.join(dataDirectory, "uploads");
  const storePath = path.join(dataDirectory, "admin.json");
  let writeQueue = Promise.resolve();

  const ensureDirectories = () => mkdir(uploadsDirectory, { recursive: true });

  return {
    kind: "fs",
    uploadsDirectory,
    storePath,
    async readStore() {
      try {
        return JSON.parse(await readFile(storePath, "utf8"));
      } catch {
        return null;
      }
    },
    writeStore(value) {
      writeQueue = writeQueue.then(async () => {
        await ensureDirectories();
        const temporary = `${storePath}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
        await rename(temporary, storePath);
      });
      return writeQueue;
    },
    async readMedia(name) {
      try {
        return await readFile(path.join(uploadsDirectory, path.basename(name)));
      } catch {
        return null;
      }
    },
    async writeMedia(name, buffer) {
      await ensureDirectories();
      await writeFile(path.join(uploadsDirectory, path.basename(name)), buffer, { mode: 0o644 });
    },
    async deleteMedia(name) {
      await unlink(path.join(uploadsDirectory, path.basename(name))).catch(() => undefined);
    },
  };
}
