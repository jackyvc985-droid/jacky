// Móvil: la sesión se guarda cifrada en el llavero del sistema.
import * as SecureStore from 'expo-secure-store';
export const secureGet = (k: string) => SecureStore.getItemAsync(k);
export const secureSet = (k: string, v: string) => SecureStore.setItemAsync(k, v);
export const secureDel = (k: string) => SecureStore.deleteItemAsync(k);
