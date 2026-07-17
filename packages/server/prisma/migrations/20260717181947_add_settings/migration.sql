-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "primary" TEXT NOT NULL DEFAULT '#6750a4',
    "surface" TEXT NOT NULL DEFAULT '#fffbfe',
    "onSurface" TEXT NOT NULL DEFAULT '#1c1b1f',
    "background" TEXT NOT NULL DEFAULT '#fffbfe',
    "onBackground" TEXT NOT NULL DEFAULT '#1c1b1f',
    "surfaceVariant" TEXT NOT NULL DEFAULT '#e7e0ec',
    "onSurfaceVariant" TEXT NOT NULL DEFAULT '#49454f',
    "updatedAt" DATETIME NOT NULL
);
