import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 3000,
  // Music: the iTunes Search API needs no key or auth.
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
