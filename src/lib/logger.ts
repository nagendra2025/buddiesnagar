type LogPayload = Record<string, unknown> | undefined;

function format(scope: string, message: string, payload?: LogPayload) {
  const base = `[BuddyNagar:${scope}] ${message}`;
  return payload ? `${base} ${JSON.stringify(payload)}` : base;
}

export const logger = {
  info(scope: string, message: string, payload?: LogPayload) {
    console.info(format(scope, message, payload));
  },
  warn(scope: string, message: string, payload?: LogPayload) {
    console.warn(format(scope, message, payload));
  },
  error(scope: string, message: string, payload?: LogPayload) {
    console.error(format(scope, message, payload));
  },
};
