const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STORAGE_KEY = "health-commander.syncCode.v1";
const CLOUD_MODE_KEY = "health-commander.cloudMode.v1";

export function loadSyncCode() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function saveSyncCode(code) {
  localStorage.setItem(STORAGE_KEY, code);
}

export function loadCloudMode() {
  return localStorage.getItem(CLOUD_MODE_KEY) === "on";
}

export function saveCloudMode(enabled) {
  localStorage.setItem(CLOUD_MODE_KEY, enabled ? "on" : "off");
}

export async function uploadEncryptedBackup(syncCode, backup) {
  const prepared = normalizeCode(syncCode);
  const encrypted = await encryptJson(prepared, backup);
  const response = await fetch(`/api/sync/${prepared.keyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encrypted),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "同步上傳失敗。");
  return body;
}

export async function downloadEncryptedBackup(syncCode) {
  const prepared = normalizeCode(syncCode);
  const response = await fetch(`/api/sync/${prepared.keyId}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "同步下載失敗。");
  return decryptJson(prepared, body);
}

export async function keyIdForCode(syncCode) {
  return normalizeCode(syncCode).keyId;
}

function normalizeCode(syncCode) {
  const code = syncCode.trim();
  if (code.length < 8) throw new Error("同步碼至少 8 個字。");
  return {
    code,
    keyId: bytesToHex(sha256Bytes(`health-commander-key:${code}`)).slice(0, 64),
  };
}

async function encryptJson(prepared, data) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(prepared.code, salt);
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return {
    version: 1,
    payload: bytesToBase64(new Uint8Array(payload)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}

async function decryptJson(prepared, encrypted) {
  const key = await deriveKey(prepared.code, base64ToBytes(encrypted.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encrypted.iv) },
    key,
    base64ToBytes(encrypted.payload),
  );
  return JSON.parse(decoder.decode(decrypted));
}

async function deriveKey(code, salt) {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function sha256Bytes(text) {
  // This small deterministic hash is only for the storage lookup key, not encryption.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
  return encoder.encode(hex.repeat(4));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
