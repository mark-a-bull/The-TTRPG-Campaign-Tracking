-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentLocationId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "battle_encounters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'building',
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "battle_encounters_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "initiative_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "battleEncounterId" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "adHocName" TEXT,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "currentHp" INTEGER,
    "maxHp" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "initiative_entries_battleEncounterId_fkey" FOREIGN KEY ("battleEncounterId") REFERENCES "battle_encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "status_effect_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "initiativeEntryId" TEXT NOT NULL,
    "sourceEntryId" TEXT,
    "label" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "appliedAtTurn" INTEGER NOT NULL DEFAULT 0,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_effect_instances_initiativeEntryId_fkey" FOREIGN KEY ("initiativeEntryId") REFERENCES "initiative_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
