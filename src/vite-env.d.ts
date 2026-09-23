/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public, non-secret URL of the Turanslate Worker API. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
