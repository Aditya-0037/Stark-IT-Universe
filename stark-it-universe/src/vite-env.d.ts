/// <reference types="vite/client" />

declare module 'virtual:siu-assets' {
  /** File names present in public/brand at build (or dev-server) time. */
  export const brandFiles: string[];
  /** File names present in public/models at build (or dev-server) time. */
  export const modelFiles: string[];
}

interface NetworkInformation {
  saveData?: boolean;
}

interface Navigator {
  deviceMemory?: number;
  connection?: NetworkInformation;
}
