// Web: los archivos viven en IndexedDB (separados del estado contable).
const DB = 'canville-files';
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('files');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const r = f(db.transaction('files', mode).objectStore('files'));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
};
const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export async function saveFile(key: string, uri: string): Promise<void> {
  const blob = await (await fetch(uri)).blob();
  await tx('readwrite', s => s.put(blob, key));
}
export async function openFile(key: string, name: string, _mime: string): Promise<void> {
  const blob = await tx<Blob | undefined>('readonly', s => s.get(key));
  if (!blob) throw new Error('El archivo ya no está en este navegador (¿se borró el almacenamiento?)');
  download(blob, name);
}
export async function removeFile(key: string): Promise<void> {
  await tx('readwrite', s => s.delete(key));
}
export async function exportText(name: string, text: string): Promise<void> {
  download(new Blob([text], { type: 'text/csv;charset=utf-8' }), name);
}
