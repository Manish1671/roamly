-- CreateEnum
CREATE TYPE "PreferenceStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateTable
CREATE TABLE "catalog_destinations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "destination_types" TEXT[],
    "interest_tags" TEXT[],
    "travel_style_tags" TEXT[],
    "climate_profile" TEXT NOT NULL,
    "activity_tags" TEXT[],
    "budget_min" DECIMAL(12,2) NOT NULL,
    "budget_max" DECIMAL(12,2) NOT NULL,
    "budget_currency" CHAR(3) NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_preferences" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PreferenceStatus" NOT NULL DEFAULT 'DRAFT',
    "budget_min" DECIMAL(12,2),
    "budget_max" DECIMAL(12,2),
    "budget_currency" CHAR(3),
    "budget_max_is_hard" BOOLEAN NOT NULL DEFAULT false,
    "availability_json" JSONB NOT NULL DEFAULT '[]',
    "interests" TEXT[],
    "travel_style" TEXT,
    "climate_preference" TEXT,
    "destination_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_snapshots" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "preference_snapshot_json" JSONB NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_destinations_slug_key" ON "catalog_destinations"("slug");

-- CreateIndex
CREATE INDEX "catalog_destinations_catalog_version_idx" ON "catalog_destinations"("catalog_version");

-- CreateIndex
CREATE UNIQUE INDEX "member_preferences_trip_id_user_id_key" ON "member_preferences"("trip_id", "user_id");

-- CreateIndex
CREATE INDEX "member_preferences_trip_id_idx" ON "member_preferences"("trip_id");

-- CreateIndex
CREATE INDEX "recommendation_snapshots_trip_id_created_at_idx" ON "recommendation_snapshots"("trip_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "member_preferences" ADD CONSTRAINT "member_preferences_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_preferences" ADD CONSTRAINT "member_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
