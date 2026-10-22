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
  };
}
