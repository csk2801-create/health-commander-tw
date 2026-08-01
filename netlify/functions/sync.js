import { getStore } from "@netlify/blobs";

const STORE_NAME = "health-commander-sync";
const MAX_BODY_BYTES = 5_500_000;

export default async (req, context) => {
  if (req.method === "OPTIONS") return response(null, 204);

  const key = context.params.key;
  if (!/^[a-f0-9]{48,64}$/.test(key || "")) {
    return response({ error: "同步碼格式不正確。" }, 400);
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const storageKey = `sync/${key}`;

  if (req.method === "GET") {
    const item = await store.get(storageKey, { type: "json" });
    if (!item) return response({ error: "找不到這組同步資料。" }, 404);
    return response(item);
  }

  if (req.method === "PUT") {
    const body = await req.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return response({ error: "同步資料太大，請改用匯出/匯入備份。" }, 413);
    }
    const parsed = JSON.parse(body);
    if (!parsed || parsed.version !== 1 || typeof parsed.payload !== "string") {
      return response({ error: "同步資料格式不正確。" }, 400);
    }
    const item = {
      version: 1,
      payload: parsed.payload,
      iv: parsed.iv,
      salt: parsed.salt,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(storageKey, item, {
      metadata: { updatedAt: item.updatedAt },
    });
    return response({ ok: true, updatedAt: item.updatedAt });
  }

  return response({ error: "不支援的操作。" }, 405);
};

export const config = {
  path: "/api/sync/:key",
  method: ["GET", "PUT", "OPTIONS"],
};

function response(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
