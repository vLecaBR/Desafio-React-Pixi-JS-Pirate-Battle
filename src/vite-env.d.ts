/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to disable the MSW mocks (enabled by default, also in production). */
  readonly VITE_ENABLE_MOCKS?: string;
  /** Axios timeout for the ranking/history API, in milliseconds (default 4000). */
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
