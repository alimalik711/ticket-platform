import type {
  MigrationBuilder,
} from "node-pg-migrate";

export async function up(
  pgm: MigrationBuilder,
): Promise<void> {
  /*
   * Internal payment states used by our application.
   */
  pgm.createType("payment_status", [
    "CREATING",
    "PENDING",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "CANCELLED",
    "REFUND_PENDING",
    "REFUNDED",
  ]);

  /*
   * Stores the relationship between one reservation
   * and its Stripe PaymentIntent.
   */
  pgm.createTable("payments", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    reservation_id: {
      type: "uuid",
      notNull: true,
      unique: true,
      references: "reservations",
      onDelete: "RESTRICT",
    },

    /*
     * Nullable while our backend is creating the
     * PaymentIntent at Stripe.
     */
    stripe_payment_intent_id: {
      type: "text",
      unique: true,
    },

    amount_cents: {
      type: "integer",
      notNull: true,
    },

    currency: {
      type: "char(3)",
      notNull: true,
      default: pgm.func("'USD'"),
    },

    status: {
      type: "payment_status",
      notNull: true,
      default: pgm.func(
        "'CREATING'::payment_status",
      ),
    },

    failure_code: {
      type: "text",
    },

    failure_message: {
      type: "text",
    },

    paid_at: {
      type: "timestamptz",
    },

    refunded_at: {
      type: "timestamptz",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.addConstraint(
    "payments",
    "payments_amount_must_be_positive",
    {
      check: "amount_cents > 0",
    },
  );

  pgm.addConstraint(
    "payments",
    "payments_currency_must_be_uppercase",
    {
      check:
        "currency ~ '^[A-Z]{3}$'",
    },
  );

  pgm.createIndex(
    "payments",
    ["status", "created_at"],
    {
      name: "payments_status_created_at_index",
    },
  );

  /*
   * Stripe can deliver the same webhook more than
   * once. Its unique event ID lets us recognize a
   * webhook that has already been processed.
   */
  pgm.createTable(
    "stripe_webhook_events",
    {
      stripe_event_id: {
        type: "text",
        primaryKey: true,
      },

      event_type: {
        type: "text",
        notNull: true,
      },

      stripe_payment_intent_id: {
        type: "text",
      },

      processed_at: {
        type: "timestamptz",
        notNull: true,
        default: pgm.func(
          "CURRENT_TIMESTAMP",
        ),
      },
    },
  );

  pgm.createIndex(
    "stripe_webhook_events",
    "stripe_payment_intent_id",
    {
      name:
        "stripe_webhook_events_payment_intent_index",
    },
  );
}

export async function down(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.dropTable(
    "stripe_webhook_events",
  );

  pgm.dropTable("payments");

  pgm.dropType("payment_status");
}