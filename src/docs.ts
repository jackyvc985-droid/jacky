import { useMemo } from 'react';
import { Doc } from './domain/types.ts';
import { uid, useStore } from './store';
import * as local from './files';
import { validateUpload, safeFileName } from './domain/uploads.ts';
import { deleteFileCloud, getFileCloud, portalUpload, putFileCloud } from './cloud';

export type Picked = { uri: string; name: string; mime: string; size: number };

/** Operaciones de archivos según el modo: dispositivo/demostración o nube. */
export function useDocFiles() {
  const { session, mode, role, readOnly, upsert, remove, refresh } = useStore();
  return useMemo(() => {
    const cloud = mode === 'cloud' && session ? session : null;
    return {
      async upload(p: Picked, meta: { clientId: string; category: string; period: string }) {
        const bytes = await local.readUri(p.uri);
        const name = safeFileName(p.name);
        const chk = validateUpload(name, bytes); // tipo, tamaño y contenido (el servidor lo vuelve a comprobar)
        if (!chk.ok) throw new Error(chk.error);
        if (cloud && readOnly) { // cliente del portal: el servidor asigna su expediente
          await portalUpload(cloud, bytes, { name, mime: chk.mime, category: meta.category, period: meta.period });
          await refresh();
          return;
        }
        const key = uid() + uid();
        let sha256: string | undefined;
        if (cloud) sha256 = (await putFileCloud(cloud, key, bytes, name, chk.mime)).sha256;
        else await local.saveFile(key, p.uri);
        const doc: Doc = { id: uid(), clientId: meta.clientId, category: meta.category, period: meta.period, name, mime: chk.mime, size: p.size || bytes.length, fileKey: key, status: 'En revisión', createdAt: new Date().toISOString(), uploadedBy: role === 'cliente' ? 'cliente' : 'despacho', ...(sha256 ? { sha256 } : {}) };
        upsert('docs', doc, x => x.id === doc.id);
      },
      async open(d: Doc) {
        if (cloud) return local.saveBytes(d.name, await getFileCloud(cloud, d.fileKey), d.mime);
        return local.openFile(d.fileKey, d.name, d.mime);
      },
      /** Elimina el archivo (físicamente en la nube) y su registro. */
      async delete(d: Doc) {
        if (cloud) await deleteFileCloud(cloud, d.fileKey).catch(() => {});
        else await local.removeFile(d.fileKey).catch(() => {});
        remove('docs', x => x.id === d.id);
      },
      async deleteFileOnly(d: Doc) {
        if (cloud) await deleteFileCloud(cloud, d.fileKey).catch(() => {});
        else await local.removeFile(d.fileKey).catch(() => {});
      },
      async readBytes(key: string): Promise<Uint8Array | null> {
        if (cloud) return getFileCloud(cloud, key).catch(() => null);
        return local.readBytes(key);
      },
    };
  }, [session, mode, role, readOnly, upsert, remove, refresh]);
}
