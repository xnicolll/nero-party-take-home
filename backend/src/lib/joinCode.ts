import { CODE_WORDS } from '../constants.js';
import { prisma } from '../db.js';

// EMBER-4417 style code: a flavor word + 4 digits.
function randomCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${digits}`;
}

// Generate a code not already taken by a live party.
export async function generateJoinCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = randomCode();
    const existing = await prisma.party.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  // Vanishingly unlikely; fall back to a longer code.
  return `${randomCode()}-${Math.floor(Math.random() * 1000)}`;
}
