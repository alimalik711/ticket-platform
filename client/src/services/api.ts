import type {
  EventSummary,
  HealthResponse,
  Payment,
  Reservation,
  SeatSummary,
  Ticket,
  User,
} from "../types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    // Ensure cookies are always sent and received (Better Auth sessions)
    credentials: "include",
  });

  let json: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      json?.message ||
      json?.error?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, errorMessage, json);
  }

  return json as T;
}

// Generate a compliant UUID v4 for the Idempotency-Key header
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const api = {
  auth: {
    async signUp(params: { name: string; email: string; password: string }) {
      return request<{ user: User; token: string }>("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async signIn(params: { email: string; password: string }) {
      return request<{ user: User; token: string }>("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async signOut() {
      return request<{ success: boolean }>("/api/auth/sign-out", {
        method: "POST",
      });
    },

    async getSession() {
      try {
        return await request<{ session: any; user: User } | null>("/api/auth/get-session");
      } catch {
        return null;
      }
    },

    async getMe() {
      try {
        const res = await request<{ status: string; data: { user: User } }>("/api/v1/auth/me");
        return res.data?.user || null;
      } catch {
        return null;
      }
    },
  },

  events: {
    async list(): Promise<EventSummary[]> {
      const res = await request<{ status: string; data: { events: EventSummary[] } }>(
        "/api/v1/events",
      );
      return res.data.events;
    },

    async getById(eventId: string): Promise<EventSummary> {
      const res = await request<{ status: string; data: { event: EventSummary } }>(
        `/api/v1/events/${eventId}`,
      );
      return res.data.event;
    },

    async getSeats(eventId: string): Promise<SeatSummary[]> {
      const res = await request<{ status: string; data: { seats: SeatSummary[] } }>(
        `/api/v1/events/${eventId}/seats`,
      );
      return res.data.seats;
    },
  },

  reservations: {
    async create(seatId: string, idempotencyKey = generateUUID()): Promise<{
      reservation: Reservation;
      idempotentReplay: boolean;
    }> {
      const res = await request<{
        status: string;
        data: { reservation: Reservation; idempotentReplay: boolean };
      }>("/api/v1/reservations", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ seatId }),
      });
      return res.data;
    },

    async list(): Promise<Reservation[]> {
      const res = await request<{
        status: string;
        data: { reservations: Reservation[] };
      }>("/api/v1/reservations");
      return res.data.reservations;
    },

    async cancel(reservationId: string): Promise<{
      reservation: { id: string; status: "CANCELLED" };
      alreadyCancelled: boolean;
    }> {
      const res = await request<{
        status: string;
        data: {
          reservation: { id: string; status: "CANCELLED" };
          alreadyCancelled: boolean;
        };
      }>(`/api/v1/reservations/${reservationId}/cancel`, {
        method: "POST",
      });
      return res.data;
    },
  },

  payments: {
    async createIntent(reservationId: string): Promise<{
      payment: Payment;
      clientSecret: string;
      reused: boolean;
    }> {
      const res = await request<{
        status: string;
        data: {
          payment: Payment;
          clientSecret: string;
          reused: boolean;
        };
      }>(`/api/v1/payments/reservations/${reservationId}/intent`, {
        method: "POST",
      });
      return res.data;
    },

    async getById(paymentId: string): Promise<Payment> {
      const res = await request<{
        status: string;
        data: { payment: Payment };
      }>(`/api/v1/payments/${paymentId}`);
      return res.data.payment;
    },

    async simulateWebhook(params: {
      paymentIntentId: string;
      amountReceived?: number;
      currency?: string;
    }): Promise<any> {
      return request<any>("/api/v1/dev/simulate-webhook", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
  },

  tickets: {
    async list(): Promise<Ticket[]> {
      const res = await request<{
        status: string;
        data: { tickets: Ticket[] };
      }>("/api/v1/tickets");
      return res.data.tickets;
    },
  },

  health: {
    async check(): Promise<HealthResponse> {
      return request<HealthResponse>("/health");
    },
  },
};
