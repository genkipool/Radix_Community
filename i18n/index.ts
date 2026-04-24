// radix-next/i18n/index.ts
import { en } from './locales/en';
import { es } from './locales/es';

export const translations = {
  en,
  // Al castear 'es' como 'typeof en', le decimos a TypeScript que ambas
  // tienen exactamente la misma estructura, eliminando el error gigante de 
  // propiedades faltantes y conservando la propiedad '.en' estática.
  es: es as typeof en,
};