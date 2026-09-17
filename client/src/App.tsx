import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { AuthPage } from "./pages/AuthPages";
import { HealthPage } from "./pages/HealthPage";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<EventsPage />} />
              <Route path="/events/:eventId" element={<EventDetailPage />} />
              <Route path="/checkout/:reservationId" element={<CheckoutPage />} />
              <Route path="/reservations" element={<ReservationsPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/login" element={<AuthPage initialMode="signin" />} />
              <Route path="/register" element={<AuthPage initialMode="signup" />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};
