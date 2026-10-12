-- CreateTable
CREATE TABLE "RegistrySettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "accentColor" TEXT NOT NULL DEFAULT '#7c3aed',
    "eventTypes" TEXT NOT NULL DEFAULT 'Wedding,Baby shower,Birthday,Housewarming,Anniversary,Graduation,Holiday,Other',
    "defaultVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "maxItemsPerRegistry" INTEGER NOT NULL DEFAULT 100,
    "maxRegistriesPerUser" INTEGER NOT NULL DEFAULT 3,
    "allowGiftMessages" BOOLEAN NOT NULL DEFAULT true,
    "showPurchasedCounts" BOOLEAN NOT NULL DEFAULT true,
    "welcomeHeading" TEXT NOT NULL DEFAULT 'Gift registry',
    "welcomeText" TEXT NOT NULL DEFAULT 'Create a registry for your big day, or find a friend''s registry and give them something they truly want.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Registry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'Other',
    "eventDate" DATETIME,
    "message" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "password" TEXT,
    "surpriseMode" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RegistryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "handle" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantityWanted" INTEGER NOT NULL DEFAULT 1,
    "quantityPurchased" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistryItem_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemTitle" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "lineItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "gifterName" TEXT,
    "giftMessage" TEXT,
    "thanked" BOOLEAN NOT NULL DEFAULT false,
    "thankYouNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RegistryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Registry_shop_customerId_idx" ON "Registry"("shop", "customerId");

-- CreateIndex
CREATE INDEX "Registry_shop_status_idx" ON "Registry"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Registry_shop_slug_key" ON "Registry"("shop", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryItem_registryId_variantId_key" ON "RegistryItem"("registryId", "variantId");

-- CreateIndex
CREATE INDEX "Purchase_registryId_idx" ON "Purchase"("registryId");

-- CreateIndex
CREATE INDEX "Purchase_shop_idx" ON "Purchase"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_shop_orderId_lineItemId_key" ON "Purchase"("shop", "orderId", "lineItemId");
