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
export async function exportText(name: string, text: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: 'text/csv' });
}
