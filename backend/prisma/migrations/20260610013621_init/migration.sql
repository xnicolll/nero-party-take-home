-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "joinCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "maxSongs" INTEGER NOT NULL,
    "chillsBudget" INTEGER NOT NULL,
    "songLengthMode" TEXT NOT NULL DEFAULT 'full',
    "phase" TEXT NOT NULL DEFAULT 'lobby',
    "hostToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "chillsLeft" INTEGER NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueuedSong" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "artworkUrl" TEXT,
    "genre" TEXT,
    "streamUrl" TEXT NOT NULL,
    "hue" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueuedSong_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueuedSong_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "frac" REAL NOT NULL,
    "positionMs" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_songId_fkey" FOREIGN KEY ("songId") REFERENCES "QueuedSong" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Result_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_joinCode_key" ON "Party"("joinCode");

-- CreateIndex
CREATE INDEX "Participant_partyId_idx" ON "Participant"("partyId");

-- CreateIndex
CREATE INDEX "QueuedSong_partyId_idx" ON "QueuedSong"("partyId");

-- CreateIndex
CREATE INDEX "Reaction_partyId_songId_idx" ON "Reaction"("partyId", "songId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_partyId_key" ON "Result"("partyId");
