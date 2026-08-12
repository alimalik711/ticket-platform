import type { MigrationBuilder } from "node-pg-migrate";

export async function up(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.sql(`
    CREATE TYPE "reservation_status" AS ENUM (
      'HELD',
      'CONFIRMED',
      'EXPIRED',
      'CANCELLED'
    );

    CREATE TABLE "reservations" (
      "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,

      "seat_id" uuid NOT NULL
        REFERENCES "seats" ("id")
        ON DELETE CASCADE,

      "user_id" text NOT NULL
        REFERENCES "user" ("id")
        ON DELETE CASCADE,

      "price_cents" integer NOT NULL,

      "status" "reservation_status"
        DEFAULT 'HELD'::"reservation_status"
        NOT NULL,

      "expires_at" timestamptz NOT NULL,
      "confirmed_at" timestamptz,

      "created_at" timestamptz
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

      "updated_at" timestamptz
        DEFAULT CURRENT_TIMESTAMP
        NOT NULL,

      CONSTRAINT "reservations_price_cannot_be_negative"
        CHECK ("price_cents" >= 0),

      CONSTRAINT "reservations_confirmed_at_matches_status"
        CHECK (
          (
            "status" = 'CONFIRMED'
            AND "confirmed_at" IS NOT NULL
          )
          OR
          (
            "status" <> 'CONFIRMED'
            AND "confirmed_at" IS NULL
          )
        )
    );

    CREATE UNIQUE INDEX
      "reservations_one_active_reservation_per_seat"
    ON "reservations" ("seat_id")
    WHERE "status" IN ('HELD', 'CONFIRMED');

    CREATE INDEX "reservations_user_id_created_at_index"
    ON "reservations" ("user_id", "created_at");
  `);
}

export async function down(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS "reservations";
    DROP TYPE IF EXISTS "reservation_status";
  `);
}