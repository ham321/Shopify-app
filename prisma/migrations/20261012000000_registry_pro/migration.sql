-- Registry Pro: themes, photos, delivery address, tracker + analytics events.

-- AlterTable: store-wide settings
ALTER TABLE "RegistrySettings" ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#1f2937';
ALTER TABLE "RegistrySettings" ADD COLUMN "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "RegistrySettings" ADD COLUMN "surfaceColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "RegistrySettings" ADD COLUMN "textColor" TEXT NOT NULL DEFAULT '#1f2328';
ALTER TABLE "RegistrySettings" ADD COLUMN "fontStyle" TEXT NOT NULL DEFAULT 'THEME';
ALTER TABLE "RegistrySettings" ADD COLUMN "cornerStyle" TEXT NOT NULL DEFAULT 'SOFT';
ALTER TABLE "RegistrySettings" ADD COLUMN "heroStyle" TEXT NOT NULL DEFAULT 'GRADIENT';
ALTER TABLE "RegistrySettings" ADD COLUMN "defaultLayout" TEXT NOT NULL DEFAULT 'GRID';
ALTER TABLE "RegistrySettings" ADD COLUMN "customCss" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RegistrySettings" ADD COLUMN "allowCustomization" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistrySettings" ADD COLUMN "allowPhotos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistrySettings" ADD COLUMN "allowAddress" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistrySettings" ADD COLUMN "showTracker" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistrySettings" ADD COLUMN "showGifterWall" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistrySettings" ADD COLUMN "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: registries
ALTER TABLE "Registry" ADD COLUMN "story" TEXT;
ALTER TABLE "Registry" ADD COLUMN "palette" TEXT NOT NULL DEFAULT 'STORE';
ALTER TABLE "Registry" ADD COLUMN "colorAccent" TEXT;
ALTER TABLE "Registry" ADD COLUMN "colorSecondary" TEXT;
ALTER TABLE "Registry" ADD COLUMN "colorBackground" TEXT;
ALTER TABLE "Registry" ADD COLUMN "fontStyle" TEXT;
ALTER TABLE "Registry" ADD COLUMN "heroStyle" TEXT;
ALTER TABLE "Registry" ADD COLUMN "layout" TEXT;
ALTER TABLE "Registry" ADD COLUMN "showGifterWall" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Registry" ADD COLUMN "shipEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registry" ADD COLUMN "shipShowFull" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registry" ADD COLUMN "shipName" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipLine1" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipLine2" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipCity" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipRegion" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipPostal" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipCountry" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipPhone" TEXT;
ALTER TABLE "Registry" ADD COLUMN "shipNote" TEXT;

-- AlterTable: purchases
ALTER TABLE "Purchase" ADD COLUMN "shippedToRegistry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Purchase" ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RegistryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BLOB NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistryImage_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "itemId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "visitor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistryEvent_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RegistryImage_registryId_kind_idx" ON "RegistryImage"("registryId", "kind");
CREATE INDEX "RegistryImage_shop_idx" ON "RegistryImage"("shop");
CREATE INDEX "RegistryEvent_shop_createdAt_idx" ON "RegistryEvent"("shop", "createdAt");
CREATE INDEX "RegistryEvent_registryId_createdAt_idx" ON "RegistryEvent"("registryId", "createdAt");
CREATE INDEX "RegistryEvent_shop_type_createdAt_idx" ON "RegistryEvent"("shop", "type", "createdAt");
