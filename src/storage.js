const RECORD_KEY = "health-commander.records.v1";
const SETTINGS_KEY = "health-commander.settings.v1";
const DB_NAME = "health-commander-media";
const DB_VERSION = 1;
const STORE_NAME = "images";

export const mealFields = ["breakfast", "lunch", "dinner"];
export const uploadFields = [...mealFields, "sleepImage", "exerciseImage"];

export function todayKey(date = new Date()) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function createEmptyRecord(date = todayKey()) {
  return {
    id: date,
    date,
    morningWeight: "",
    eveningWeight: "",
    waist: "",
    water: "",
    mood: "普通",
    knee: "正常",
    note: "",
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
    },
    sleepImages: [],
    exerciseImages: [],
    healthSync: {
      source: "manual",
      appleHealthReserved: true,
      lastSyncAt: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecords(records) {
  localStorage.setItem(RECORD_KEY, JSON.stringify(records));
}

export function upsertRecord(records, record) {
  const normalized = { ...record, updatedAt: new Date().toISOString() };
  const index = records.findIndex((item) => item.id === normalized.id);
  if (index === -1) return [normalized, ...records].sort((a, b) => b.date.localeCompare(a.date));
  const next = [...records];
  next[index] = normalized;
  return next.sort((a, b) => b.date.localeCompare(a.date));
}

export function deleteRecord(records, id) {
  return records.filter((record) => record.id !== id);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { waterGoal: 2500, weightGoal: "", waistGoal: "" };
  } catch {
    return { waterGoal: 2500, weightGoal: "", waistGoal: "" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putImage(file) {
  const db = await openMediaDb();
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const item = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await txStore(db, "readwrite", (store) => store.put(item));
  db.close();
  return { id, name: item.name, type: item.type, size: item.size, createdAt: item.createdAt };
}

export async function getImage(id) {
  const db = await openMediaDb();
  const item = await txStore(db, "readonly", (store) => store.get(id));
  db.close();
  return item || null;
}

export async function deleteImages(ids) {
  if (!ids.length) return;
  const db = await openMediaDb();
  await txStore(db, "readwrite", (store) => {
    ids.forEach((id) => store.delete(id));
  });
  db.close();
}

export async function exportBackup(records, settings, options = {}) {
  const includeMedia = options.includeMedia !== false;
  const exportedRecords = includeMedia ? records : records.map(stripMediaRefs);
  if (!includeMedia) {
    return {
      app: "Health Commander",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: exportedRecords,
      settings,
      media: [],
    };
  }
  const mediaIds = records.flatMap((record) => [
    ...record.meals.breakfast.map((item) => item.id),
    ...record.meals.lunch.map((item) => item.id),
    ...record.meals.dinner.map((item) => item.id),
    ...record.sleepImages.map((item) => item.id),
    ...record.exerciseImages.map((item) => item.id),
  ]);
  const media = [];
  for (const id of mediaIds) {
    const image = await getImage(id);
    if (image?.blob) {
      media.push({ ...image, dataUrl: await blobToDataUrl(image.blob), blob: undefined });
    }
  }
  return {
    app: "Health Commander",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: exportedRecords,
    settings,
    media,
  };
}

export async function importBackup(backup) {
  if (!backup || backup.version !== 1 || !Array.isArray(backup.records)) {
    throw new Error("這不是 Health Commander V1 備份檔。");
  }
  const db = await openMediaDb();
  for (const image of backup.media || []) {
    const blob = await dataUrlToBlob(image.dataUrl);
    await txStore(db, "readwrite", (store) =>
      store.put({ id: image.id, name: image.name, type: image.type, size: image.size, blob, createdAt: image.createdAt }),
    );
  }
  db.close();
  saveRecords(backup.records);
  saveSettings(backup.settings || loadSettings());
  return { records: backup.records, settings: backup.settings || loadSettings() };
}

function txStore(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);
    let result;
    if (request && "onsuccess" in request) request.onsuccess = () => (result = request.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function stripMediaRefs(record) {
  return {
    ...record,
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
    },
    sleepImages: [],
    exerciseImages: [],
  };
}
