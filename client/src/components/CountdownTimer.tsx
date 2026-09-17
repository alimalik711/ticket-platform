import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  expiresAt,
  onExpire,
  className = "",
  showIcon = true,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft(0);
        if (!isExpired) {
          setIsExpired(true);
          onExpire?.();
        }
      } else {
        setTimeLeft(Math.floor(difference / 1000));
        setIsExpired(false);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire, isExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (isExpired || timeLeft <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded border border-neutral-300 bg-neutral-100 text-neutral-600 ${className}`}
      >
        {showIcon && <Clock className="w-3.5 h-3.5" />}
        <span>EXPIRED</span>
      </span>
    );
  }

  const isLowTime = timeLeft < 60;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded border tabular-nums ${
        isLowTime
          ? "border-neutral-900 bg-neutral-900 text-white animate-pulse"
          : "border-neutral-300 bg-white text-neutral-900"
      } ${className}`}
      title={`Reservation expires at ${new Date(expiresAt).toLocaleTimeString()}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      <span>{formattedTime}</span>
    </span>
  );
};
