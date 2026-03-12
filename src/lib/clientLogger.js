const MAX_LOG_ENTRIES = 300;

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
  buffer.push(entry);
  if (buffer.length > MAX_LOG_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_LOG_ENTRIES);
  }
  notifySubscribers();
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

