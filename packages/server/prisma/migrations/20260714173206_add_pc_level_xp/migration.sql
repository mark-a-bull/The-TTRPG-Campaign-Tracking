-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pcs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portraitImageUrl" TEXT,
    "roleOrClass" TEXT NOT NULL DEFAULT '',
    "background" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "inventory" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pcs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pcs" ("background", "campaignId", "createdAt", "id", "inventory", "name", "notes", "portraitImageUrl", "roleOrClass", "updatedAt") SELECT "background", "campaignId", "createdAt", "id", "inventory", "name", "notes", "portraitImageUrl", "roleOrClass", "updatedAt" FROM "pcs";
DROP TABLE "pcs";
ALTER TABLE "new_pcs" RENAME TO "pcs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
