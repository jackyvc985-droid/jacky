// Móvil: los archivos viven en el directorio de documentos de la app.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const dir = () => {
  const d = new Directory(Paths.document, 'canville-files');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};

export async function saveFile(key: string, uri: string): Promise<void> {
  new File(uri).copy(new File(dir(), key));
}
export async function openFile(key: string, _name: string, _mime: string): Promise<void> {
  const f = new File(dir(), key);
  if (!f.exists) throw new Error('El archivo ya no está en este dispositivo');
  await Sharing.shareAsync(f.uri);
}
export async function removeFile(key: string): Promise<void> {
  const f = new File(dir(), key);
  if (f.exists) f.delete();
}
export async function exportText(name: string, text: string, mime = 'text/csv'): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: mime });
}

export async function readUri(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
export async function readBytes(key: string): Promise<Uint8Array | null> {
  const f = new File(dir(), key);
  return f.exists ? f.bytes() : null;
}
export async function writeBytes(key: string, bytes: Uint8Array): Promise<void> {
  const f = new File(dir(), key);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
}
export async function saveBytes(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const f = new File(Paths.cache, name.replace(/[^\w.\-]+/g, '_'));
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  await Sharing.shareAsync(f.uri, { mimeType: mime || undefined });
}
export async function requestPersistence(): Promise<boolean> { return true; }
