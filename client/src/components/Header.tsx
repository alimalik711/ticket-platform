import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Ticket, Calendar, Bookmark, Activity, User as UserIcon, LogOut, Menu, X } from "lucide-react";

export const Header: React.FC = () => {
  const { user, logout, activeHoldCount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate("/login");
  };

  const navItems = [
    { name: "Events", path: "/", icon: Calendar },
    {
      name: "Reservations",
      path: "/reservations",
      icon: Bookmark,
      badge: activeHoldCount > 0 ? activeHoldCount : null,
    },
    { name: "My Tickets", path: "/tickets", icon: Ticket },
    { name: "Health", path: "/health", icon: Activity },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded bg-neutral-900 flex items-center justify-center text-white transition-transform group-hover:scale-105">
                <Ticket className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-wider text-neutral-900 leading-tight">
                  PASSAGE
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">
                  Ticket Platform
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? "bg-neutral-100 text-neutral-900 border border-neutral-300"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-neutral-500" />
                    <span>{item.name}</span>
                    {item.badge !== null && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-mono font-semibold bg-neutral-900 text-white rounded-full min-w-[18px]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section / Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-200 hover:border-neutral-400 bg-neutral-50 text-sm font-medium transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-mono">
                    {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                  <span className="max-w-[130px] truncate text-neutral-800 text-xs font-mono">
                    {user.name || user.email}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                      <p className="text-xs font-medium text-neutral-900 truncate">
                        {user.name || "Authenticated User"}
                      </p>
                      <p className="text-[11px] font-mono text-neutral-500 truncate">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      to="/reservations"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 rounded"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>My Reservations</span>
                      {activeHoldCount > 0 && (
                        <span className="ml-auto text-[10px] bg-neutral-900 text-white px-1.5 py-0.2 rounded-full font-mono">
                          {activeHoldCount} held
                        </span>
                      )}
                    </Link>

                    <Link
                      to="/tickets"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 rounded"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Purchased Tickets</span>
                    </Link>

                    <div className="border-t border-neutral-100 my-1" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-900 hover:bg-neutral-100 rounded text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-sm font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 pt-2 pb-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                  active ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-neutral-500" />
                  <span>{item.name}</span>
                </div>
                {item.badge !== null && (
                  <span className="text-[10px] font-mono font-semibold bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="border-t border-neutral-100 pt-2">
            {user ? (
              <div className="space-y-2">
                <div className="px-3 py-1">
                  <p className="text-xs font-semibold text-neutral-900">{user.name || user.email}</p>
                  <p className="text-[11px] font-mono text-neutral-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-100 rounded-md"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-3 py-2 text-sm font-medium border border-neutral-300 rounded-md"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-3 py-2 text-sm font-medium bg-neutral-900 text-white rounded-md"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
