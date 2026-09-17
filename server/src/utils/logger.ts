type LogContext = Record<
  string,
  unknown
>;

const log = (
  level: "info" | "error" | "warn",
  message: string,
  context: LogContext = {},
): void => {
  console.log(
    JSON.stringify({
      level,
      message,
      ...context,
      timestamp: new Date().toISOString(),
    }),
  );
};

export {
  log,
};