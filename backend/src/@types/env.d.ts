// src/@types/env.d.ts
export {}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: number
      NEON_CUSTOM_STRING: string
      GOOGLE_SAFE_BROWSING_API_KEY: string
    }
  }
}