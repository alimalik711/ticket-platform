export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

export type SeatStatus = "AVAILABLE" | "HELD" | "SOLD";

export type ReservationStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";

export type PaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EventSummary {
  id: string;
  title: string;
  description: string | null;
  venueName: string;
  startsAt: string;
  status: EventStatus;
}

export interface SeatSummary {
  id: string;
  section: string;
  rowLabel: string;
  seatNumber: string;
  priceCents: number;
  status: SeatStatus;
  heldUntil: string | null;
}

export interface Reservation {
  id: string;
  seat_id: string;
  user_id: string;
  price_cents: number;
  status: ReservationStatus;
  expires_at: string;
  confirmed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  seat: {
    section: string;
    row_label: string;
    seat_number: string;
  };
  event: {
    id: string;
    title: string;
    venue_name: string;
    starts_at: string;
  };
}

export interface Payment {
  id: string;
  reservation_id: string;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  failure_code: string | null;
  failure_message: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  reservationId: string;
  issuedAt: string;
  event: {
    id: string;
    title: string;
    description: string | null;
    venueName: string;
    startsAt: string;
    status: EventStatus;
  };
  seat: {
    id: string;
    section: string;
    rowLabel: string;
    seatNumber: string;
  };
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: "SUCCEEDED";
    paidAt: string;
  };
}

export interface HealthResponse {
  status: string;
  message: string;
}

export interface SeatUpdatedPayload {
  eventId: string;
  seatId: string;
  status: SeatStatus;
  heldUntil: string | null;
}
