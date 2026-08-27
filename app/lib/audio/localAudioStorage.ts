const DB_NAME = "marvedge-audio";
const DB_VERSION = 1;
const STORE_NAME = "local-audio";

export interface LocalAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: number;
  blob: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalAudio(file: File): Promise<LocalAudioFile> {
  const db = await openDB();
  const entry: LocalAudioFile = {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || "audio/mpeg",
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listLocalAudio(): Promise<LocalAudioFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const files = (req.result as LocalAudioFile[]).sort((a, b) => b.addedAt - a.addedAt);
      resolve(files);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalAudio(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function audioBlobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
