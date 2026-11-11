-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'CLOSED', 'FINALIZED');

-- CreateTable
CREATE TABLE "destination_polls" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "recommendation_snapshot_id" UUID NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
    "destination_ids" TEXT[],
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "destination_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_poll_votes" (
    "id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "destination_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_destination_decisions" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "destination_id" TEXT NOT NULL,
    "recommendation_snapshot_id" UUID NOT NULL,
    "finalized_by_id" UUID NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligible_member_count" INTEGER NOT NULL,
    "voted_member_count" INTEGER NOT NULL,
    "results_snapshot_json" JSONB NOT NULL,

    CONSTRAINT "trip_destination_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destination_poll_votes_poll_id_user_id_key" ON "destination_poll_votes"("poll_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_destination_decisions_poll_id_key" ON "trip_destination_decisions"("poll_id");

-- CreateIndex
CREATE INDEX "destination_polls_trip_id_status_idx" ON "destination_polls"("trip_id", "status");

-- CreateIndex
CREATE INDEX "destination_polls_recommendation_snapshot_id_idx" ON "destination_polls"("recommendation_snapshot_id");

-- CreateIndex
CREATE INDEX "destination_poll_votes_poll_id_idx" ON "destination_poll_votes"("poll_id");

-- CreateIndex
CREATE INDEX "trip_destination_decisions_trip_id_finalized_at_idx" ON "trip_destination_decisions"("trip_id", "finalized_at" DESC);

-- One open poll per trip
CREATE UNIQUE INDEX "destination_polls_one_open_per_trip" ON "destination_polls"("trip_id") WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "destination_polls" ADD CONSTRAINT "destination_polls_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_polls" ADD CONSTRAINT "destination_polls_recommendation_snapshot_id_fkey" FOREIGN KEY ("recommendation_snapshot_id") REFERENCES "recommendation_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_polls" ADD CONSTRAINT "destination_polls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_poll_votes" ADD CONSTRAINT "destination_poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "destination_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_poll_votes" ADD CONSTRAINT "destination_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_destination_decisions" ADD CONSTRAINT "trip_destination_decisions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_destination_decisions" ADD CONSTRAINT "trip_destination_decisions_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "destination_polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_destination_decisions" ADD CONSTRAINT "trip_destination_decisions_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
