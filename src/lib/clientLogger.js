const MAX_LOG_ENTRIES = 2000;

const subscribers = new Set();
const buffer = [];

function notifySubscribers() {
  const snapshot = [...buffer];
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function addLogEntry(entry) {
  const full = {
    time: new Date().toISOString(),
    level: entry.level ?? "log",
    message: entry.message ?? "",
    tag: entry.tag,
    ...entry,
  };
  buffer.push(full);
  if (buffer.length > MAX_LOG_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_LOG_ENTRIES);
  }
  notifySubscribers();
}

/** Log a step/tag for every micro-action. Shown in Client Console Logs (System Status). */
export function logStep(tag, message, detail) {
  const msg = detail != null ? `${message} ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : message;
  addLogEntry({ tag, message: msg, level: "log" });
}

/**
 * Log a process step with a full JSON payload (statuses, actions, true/false, etc.).
 * Shown in System Status with formatted, copyable JSON.
 * @param {string} tag - e.g. "KB", "Agent", "Indexing"
 * @param {string} message - Short label for the step
 * @param {object} payload - Any serializable object (will be stored and shown as JSON)
 */
export function logStepJSON(tag, message, payload) {
  const safePayload = payload != null && typeof payload === "object" ? payload : { value: payload };
  addLogEntry({
    tag,
    message,
    level: "log",
    payload: safePayload,
  });
}

export function subscribeToLogs(cb) {
  subscribers.add(cb);
  cb([...buffer]);
  return () => {
    subscribers.delete(cb);
  };
}

export function installConsoleCapture() {
  if (typeof window === "undefined") return;
  if (window.__CLIENT_LOGGER_INSTALLED__) return;
  window.__CLIENT_LOGGER_INSTALLED__ = true;
  addLogEntry({ tag: "App", message: "Client logger installed. System Status click opens this log.", level: "log" });

  ["log", "warn", "error"].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      try {
        const message = args
          .map((a) => {
            if (typeof a === "string") return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" ");
        addLogEntry({
          level,
          message,
          time: new Date().toISOString(),
        });
      } catch {
        // swallow logging errors
      }
      original(...args);
    };
  });
}

