import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { Reservation, Payment } from "../types";
import { CountdownTimer } from "../components/CountdownTimer";
import {
  CreditCard,
  ShieldCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  MapPin,
  Calendar,
  Ticket,
  Lock,
} from "lucide-react";

export const CheckoutPage: React.FC = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const { user, refreshReservations } = useAuth();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Load reservation and create payment intent
  const initCheckout = useCallback(async () => {
    if (!reservationId || !user) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // 1. Fetch user's reservations to find this one
      const reservations = await api.reservations.list();
      const current = reservations.find((r) => r.id === reservationId);

      if (!current) {
        setErrorMessage("Reservation not found for current user.");
        return;
      }

      setReservation(current);

      // Check expiration
      if (new Date(current.expires_at).getTime() <= Date.now()) {
        setIsExpired(true);
        return;
      }

      if (current.status === "CONFIRMED") {
        setIsSuccess(true);
        return;
      }

      if (current.status === "CANCELLED" || current.status === "EXPIRED") {
        setIsExpired(true);
        return;
      }

      // 2. Initialize PaymentIntent
      const intentRes = await api.payments.createIntent(reservationId);
      setPayment(intentRes.payment);
      setClientSecret(intentRes.clientSecret);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize checkout session.");
    } finally {
      setIsLoading(false);
    }
  }, [reservationId, user]);

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/checkout/${reservationId}`);
      return;
    }
    initCheckout();
  }, [user, reservationId, initCheckout, navigate]);

  // Handle Dev Mode Webhook Simulation
  const handleSimulateWebhook = async () => {
    if (!payment || !payment.stripe_payment_intent_id) {
      setErrorMessage("No active Stripe payment intent found to confirm.");
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      await api.payments.simulateWebhook({
        paymentIntentId: payment.stripe_payment_intent_id,
        amountReceived: payment.amount_cents,
        currency: payment.currency,
      });

      // Refresh state
      await refreshReservations();
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process simulation webhook.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Cancel Hold
  const handleCancelHold = async () => {
    if (!reservationId) return;
    try {
      await api.reservations.cancel(reservationId);
      await refreshReservations();
      navigate(-1);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to release reservation.");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mb-4" />
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
          Securing Reservation & Initializing Payment Gateway...
        </p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-900 text-white flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-1">
          Transaction Succeeded
        </span>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          Your Ticket Has Been Confirmed!
        </h2>
        <p className="text-xs text-neutral-600 mb-8 max-w-md mx-auto leading-relaxed">
          Your payment has been processed and your seat is officially confirmed in the database.
          A formal digital pass has been issued.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/tickets"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>View Ticket Pass</span>
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-xs font-mono font-semibold rounded border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 transition-colors"
          >
            Browse More Events
          </Link>
        </div>
      </div>
    );
  }

  if (isExpired || !reservation) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Clock className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Reservation Expired</h2>
        <p className="text-xs text-neutral-600 mb-6 max-w-sm mx-auto">
          The temporary hold on this seat has expired and the seat has been released back into the
          available pool.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Events</span>
        </Link>
      </div>
    );
  }

  const eventDate = new Date(reservation.event.starts_at);
  const amountFormatted = (reservation.price_cents / 100).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-500">Hold Expires:</span>
          <CountdownTimer
            expiresAt={reservation.expires_at}
            onExpire={() => setIsExpired(true)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-neutral-200 rounded-lg p-6 bg-neutral-50/50 space-y-5">
            <div className="border-b border-neutral-200 pb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-1">
                Order Summary
              </span>
              <h2 className="text-lg font-bold text-neutral-900 leading-snug">
                {reservation.event.title}
              </h2>
            </div>

            <div className="space-y-2 text-xs font-mono text-neutral-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{reservation.event.venue_name}</span>
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

            {/* Seat Badge */}
            <div className="border border-neutral-200 bg-white rounded p-3.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-neutral-400">
                Seat Assignment
              </div>
              <div className="text-sm font-mono font-bold text-neutral-900">
                Section {reservation.seat.section} • Row {reservation.seat.row_label} • Seat{" "}
                {reservation.seat.seat_number}
              </div>
              <div className="text-[11px] font-mono text-neutral-500">
                Reservation ID: {reservation.id.slice(0, 8)}...
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-neutral-200 pt-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-neutral-600">
                <span>Standard Seat Price</span>
                <span>${amountFormatted} USD</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Processing & Platform Fee</span>
                <span>$0.00 USD</span>
              </div>
              <div className="border-t border-neutral-200 pt-2 flex justify-between text-sm font-bold text-neutral-900">
                <span>Total Amount Due</span>
                <span>${amountFormatted} USD</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelHold}
            className="w-full text-center py-2 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Release Seat & Cancel Reservation
          </button>
        </div>

        {/* Right Column: Payment Execution */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-neutral-200 rounded-lg p-6 sm:p-8 bg-white space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-neutral-700" />
                <h3 className="text-base font-bold text-neutral-900">Payment Authorization</h3>
              </div>
              <p className="text-xs text-neutral-500">
                Transactions are secured via Stripe and protected against duplicate charges.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Stripe Payment Intent Info */}
            <div className="space-y-4">
              <div className="p-4 rounded border border-neutral-200 bg-neutral-50/70 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Stripe Intent ID:</span>
                  <span className="text-neutral-900 font-semibold truncate max-w-[200px]">
                    {payment?.stripe_payment_intent_id || "pi_local_pending"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Payment Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
                    {payment?.status || "PENDING"}
                  </span>
                </div>
              </div>

              {/* Dev Simulation Option */}
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-5 bg-neutral-50 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-neutral-800" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900">
                    Developer Test Confirmation
                  </span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Triggers the backend Stripe webhook simulation payload signed with the local
                  webhook secret, finalizing the database transaction and confirming your ticket.
                </p>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSimulateWebhook}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming Transaction...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm Payment & Issue Ticket (${amountFormatted})</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-neutral-400 pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                <span>256-Bit Encrypted Database Concurrency Lock</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
