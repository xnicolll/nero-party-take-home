import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 3000,
  // Audius needs no key — just an app name passed on every request.
  AUDIUS_APP_NAME: process.env.AUDIUS_APP_NAME || 'NeroParty',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
