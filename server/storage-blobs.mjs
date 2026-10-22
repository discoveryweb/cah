import { getStore } from "@netlify/blobs";

const STORE_KEY = "admin.json";
const MEDIA_PREFIX = "media/";

/**
 * Netlify Blobs storage for the serverless deployment. Content, media and the
 * activity log survive deploys; nothing is written to the function's ephemeral
 * file system. `client` can be injected for tests.
 */
export function createBlobsStorage({ storeName, client } = {}) {
  let store = client ?? null;
  // Resolve lazily so importing the module never fails outside the Netlify
  // runtime; a real storage problem surfaces as a 503 on the first request.
  const getClient = () => {
    if (!store) {
      store = getStore({
        name: storeName || process.env.ADMIN_BLOB_STORE || "cahen-admin",
        consistency: "strong",
      });
    }
    return store;
  };

  let writeQueue = Promise.resolve();
  const jsonQueues = new Map();
  const documentKey = (key) => {
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(String(key))) throw new Error("Invalid document key");
    return `${key}.json`;
  };

  return {
    kind: "blobs",
    async readStore() {
      const value = await getClient().get(STORE_KEY, { type: "json" });
      return value ?? null;
    },
    writeStore(value) {
      writeQueue = writeQueue.then(() => getClient().setJSON(STORE_KEY, value));
      return writeQueue;
    },
    async readMedia(name) {
      const buffer = await getClient().get(`${MEDIA_PREFIX}${name}`, { type: "arrayBuffer" });
      return buffer ? Buffer.from(buffer) : null;
    },
    async writeMedia(name, buffer) {
      await getClient().set(`${MEDIA_PREFIX}${name}`, buffer);
    },
    async deleteMedia(name) {
      await getClient().delete(`${MEDIA_PREFIX}${name}`);
    },
    async readJson(key) {
      const value = await getClient().get(documentKey(key), { type: "json" });
      return value ?? null;
    },
    async writeJson(key, value) {
      await getClient().setJSON(documentKey(key), value);
    },
    updateJson(key, updater) {
      const previous = jsonQueues.get(key) ?? Promise.resolve();
      const next = previous.then(async () => {
        const current = await getClient().get(documentKey(key), { type: "json" });
        const updated = await updater(current ?? null);
        await getClient().setJSON(documentKey(key), updated);
        return updated;
      });
      jsonQueues.set(key, next.catch(() => undefined));
      return next;
    },
  };
}
