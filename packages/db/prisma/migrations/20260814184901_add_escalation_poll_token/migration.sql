-- AlterTable
ALTER TABLE "escalations" ADD COLUMN "pollToken" TEXT;

-- Backfill nem szükséges: a tábla ezen migráció előtt kiürítve (csak
-- teszt-eszkalációk voltak benne, valódi ügyféladat nem veszett el).

-- AlterTable (kötelezővé tétel a backfill/üresítés után)
ALTER TABLE "escalations" ALTER COLUMN "pollToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "escalations_pollToken_key" ON "escalations"("pollToken");
