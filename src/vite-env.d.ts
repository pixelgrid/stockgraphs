/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** IANA timezone for naive CSV datetimes (default America/New_York). */
  readonly VITE_FINVIZ_QUOTE_TZ: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
