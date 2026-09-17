import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { Reservation } from "../types";
import { CountdownTimer } from "../components/CountdownTimer";
import {
  Bookmark,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  XCircle,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Ticket,
} from "lucide-react";

export const ReservationsPage: React.FC = () => {
  const { user, refreshReservations } = useAuth();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "HELD" | "CONFIRMED" | "EXPIRED">("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.reservations.list();
      setReservations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load reservations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login?redirect=/reservations");
      return;
    }
    fetchReservations();
  }, [user, navigate]);

  const handleCancelReservation = async (reservationId: string) => {
    try {
      setActionLoadingId(reservationId);
      await api.reservations.cancel(reservationId);
      await refreshReservations();
      await fetchReservations();
    } catch (err: any) {
      setError(err.message || "Failed to cancel reservation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredReservations = useMemo(() => {
    const now = new Date();
    return reservations.filter((r) => {
      const isStillHeld = r.status === "HELD" && new Date(r.expires_at) > now;
      if (activeTab === "HELD") return isStillHeld;
      if (activeTab === "CONFIRMED") return r.status === "CONFIRMED";
      if (activeTab === "EXPIRED") return r.status === "EXPIRED" || r.status === "CANCELLED" || (r.status === "HELD" && !isStillHeld);
      return true;
    });
  }, [reservations, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="border-b border-neutral-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-2">
            Personal Registry
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            My Reservations
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600">
            Track temporary seat holds, view expiration countdowns, and proceed to checkout.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 border border-neutral-300 rounded-lg p-1 bg-neutral-50 text-xs font-mono">
          {(["ALL", "HELD", "CONFIRMED", "EXPIRED"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === tab
                  ? "bg-neutral-900 text-white font-semibold"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50"
              }`}
            >
              {tab === "EXPIRED" ? "EXPIRED / CANCELLED" : tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-mono underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mb-4" />
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            Querying reservation ledger...
          </p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center max-w-md mx-auto">
          <Bookmark className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">
            No Reservations Found
          </h3>
          <p className="text-xs text-neutral-500 mb-6">
            {activeTab === "ALL"
              ? "You currently have no active or previous seat reservations."
              : `No reservations matching status "${activeTab}".`}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800"
          >
            <span>Explore Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReservations.map((res) => {
            const now = new Date();
            const isHeldActive =
              res.status === "HELD" && new Date(res.expires_at) > now;
            const isConfirmed = res.status === "CONFIRMED";
            const isActionLoading = actionLoadingId === res.id;
            const eventDate = new Date(res.event.starts_at);

            return (
              <div
                key={res.id}
                className="border border-neutral-200 rounded-lg p-6 bg-white hover:border-neutral-400 transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 mb-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                        isHeldActive
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : isConfirmed
                          ? "border-neutral-400 bg-neutral-100 text-neutral-900"
                          : "border-neutral-200 bg-neutral-50 text-neutral-400"
                      }`}
                    >
                      {isHeldActive ? "HELD // ACTIVE" : res.status}
                    </span>

                    {isHeldActive && (
                      <div className="flex items-center gap-1.5">
                        <CountdownTimer
                          expiresAt={res.expires_at}
                          onExpire={() => fetchReservations()}
                        />
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-neutral-900 leading-snug">
                    {res.event.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-neutral-600 font-mono mt-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{res.event.venue_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>
                        {eventDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Seat Detail Strip */}
                  <div className="mt-4 p-3 rounded bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-neutral-400 block text-[10px] uppercase">
                        Assigned Seat
                      </span>
                      <span className="font-bold text-neutral-900">
                        Sec {res.seat.section} • Row {res.seat.row_label} • Seat {res.seat.seat_number}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-400 block text-[10px] uppercase">
                        Amount
                      </span>
                      <span className="font-bold text-neutral-900">
                        ${(res.price_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-100">
                  <span className="text-[10px] font-mono text-neutral-400 truncate">
                    ID: {res.id.slice(0, 8)}...
                  </span>

                  <div className="flex items-center gap-2">
                    {isHeldActive ? (
                      <>
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={() => handleCancelReservation(res.id)}
                          className="px-3 py-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                        >
                          {isActionLoading ? "Cancelling..." : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/checkout/${res.id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Pay Now</span>
                        </button>
                      </>
                    ) : isConfirmed ? (
                      <Link
                        to="/tickets"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold rounded border border-neutral-300 hover:border-neutral-900 text-neutral-900 transition-colors"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>View Ticket Pass</span>
                      </Link>
                    ) : (
                      <span className="text-xs font-mono text-neutral-400">
                        Non-actionable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
