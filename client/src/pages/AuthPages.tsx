import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Ticket, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export const AuthPage: React.FC<{ initialMode?: "signin" | "signup" }> = ({
  initialMode = "signin",
}) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) {
          throw new Error("Full name is required.");
        }
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }

      navigate(redirect);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (mode === "signup"
            ? "Failed to register account. Ensure password is at least 8 characters."
            : "Invalid email or password. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Top */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded bg-neutral-900 text-white flex items-center justify-center mx-auto shadow-sm">
            <Ticket className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
            {mode === "signin" ? "Sign in to PASSAGE" : "Create your Account"}
          </h2>
          <p className="text-xs text-neutral-500 font-mono">
            {mode === "signin"
              ? "Access reservations and secured tickets"
              : "Register to reserve seats in real time"}
          </p>
        </div>

        {/* Form Card */}
        <div className="border border-neutral-200 rounded-lg p-6 sm:p-8 bg-white shadow-sm space-y-6">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-md border border-neutral-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded text-center transition-all ${
                mode === "signin"
                  ? "bg-white font-bold text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded text-center transition-all ${
                mode === "signup"
                  ? "bg-white font-bold text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMessage && (
            <div className="rounded border border-neutral-300 bg-neutral-50 p-3.5 text-xs text-neutral-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-neutral-700 block">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-md focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-mono font-semibold text-neutral-700 block">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-md focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-semibold text-neutral-700 block">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-md focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors text-xs"
              />
              {mode === "signup" && (
                <p className="text-[10px] text-neutral-500 font-mono">
                  Must be at least 8 characters long.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm pt-3"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign In" : "Register"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
