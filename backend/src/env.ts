import dotenv from 'dotenv';
import path from 'path';

// Load the repo-root .env without __dirname so this works under both CommonJS
// and ESM. The backend always runs with cwd = backend/, so root .env is one up.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  // Music: the iTunes Search API needs no key or auth.
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
