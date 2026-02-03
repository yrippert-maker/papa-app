/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTAL_API_URL: string;
  readonly VITE_PORTAL_API_KEY: string;
  readonly VITE_PORTAL_BEARER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
