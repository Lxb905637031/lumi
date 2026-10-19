/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LUMI_API_URL?: string;
  readonly VITE_LUMI_ADMIN_ACCESS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
