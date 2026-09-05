import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'pnpm build',
  outputDirectory: 'dist',
};
