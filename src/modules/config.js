const DEFAULT_CONFIG = {
  // External service endpoints (provide via Vite env in production)
  MIQYAS_FRONTEND_URL: "https://192.168.2.49:3000/guided-photos?source=salla",
  MIQYAS_BACKEND_WS_URL: "https://192.168.2.49:8001/salla-sessions",
  TRACK_CLICK_ENDPOINT: "https://your-saas.com/track-click", // TODO: adjust
  TRACK_RETURN_ENDPOINT: "https://your-saas.com/track-return", // TODO: adjust
  WIDGET_ID: "size-core-widget",
  WIDGET_IFRAME_ID: "size-core-widget-iframe",
  WIDGET_OPEN_CLASS: "size-core-open",
  WIDGET_GREETING_ID: "size-core-greeting",
  STORE_ID: null, // Will be populated from script data-store-id attribute
  LOGO_PATH: null, // Will be populated from script data-logo attribute
  POWERED_BY_LOGO: null, // Will be populated from script data-powered-by attribute
  THEME_COLOR: "#ff6f61", // Default theme color, can be overridden with data-theme-color
  // Default font family for the widget (prefer Red Hat Text/Display)
  FONT_FAMILY: "'Red Hat Display', system-ui, -apple-system, sans-serif",
  SOCKET_PATH: "/socket.io" // Socket.IO path
};

const ENV_VAR_MAPPING = {
  MIQYAS_FRONTEND_URL: 'VITE_MIQYAS_FRONTEND_URL',
  MIQYAS_BACKEND_WS_URL: 'VITE_MIQYAS_BACKEND_WS_URL',
  TRACK_CLICK_ENDPOINT: 'VITE_SIZE_CORE_TRACK_CLICK_ENDPOINT',
  TRACK_RETURN_ENDPOINT: 'VITE_SIZE_CORE_TRACK_RETURN_ENDPOINT',
  SOCKET_PATH: 'VITE_SIZE_CORE_SOCKET_PATH'
};

const OVERRIDABLE_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

function toScreamingSnake(key) {
  if (typeof key !== 'string' || !key) return '';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

function sanitizeOverrides(source) {
  const result = {};
  if (!source || typeof source !== 'object') return result;

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const normalizedKey = toScreamingSnake(rawKey);
    if (!OVERRIDABLE_KEYS.has(normalizedKey)) continue;

    let value = rawValue;
    if (typeof value === 'string') {
      value = value.trim();
      if (value === '') continue;
    }

    if (value === undefined || value === null) continue;
    result[normalizedKey] = value;
  }

  return result;
}

function readGlobalOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    return sanitizeOverrides(window.SIZE_CORE_CONFIG);
  } catch {
    return {};
  }
}

function readEnvOverrides() {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) {
      return {};
    }
    const overrides = {};
    for (const [configKey, envKey] of Object.entries(ENV_VAR_MAPPING)) {
      const value = import.meta.env[envKey];
      if (typeof value === 'string' && value.trim() !== '') {
        overrides[configKey] = value.trim();
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

const envOverrides = sanitizeOverrides(readEnvOverrides());
const runtimeOverrides = readGlobalOverrides();

// Core configuration settings
export const config = {
  ...DEFAULT_CONFIG,
  ...envOverrides,
  ...runtimeOverrides
};

function computeFlowOrigin(base) {
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

export let FLOW_ORIGIN = computeFlowOrigin(config.MIQYAS_FRONTEND_URL);

export function syncDerivedConfig() {
  FLOW_ORIGIN = computeFlowOrigin(config.MIQYAS_FRONTEND_URL);
}

export function applyConfigOverrides(overrides = {}) {
  const sanitized = sanitizeOverrides(overrides);
  if (!Object.keys(sanitized).length) return config;

  let flowBaseUpdated = false;

  for (const [key, value] of Object.entries(sanitized)) {
    config[key] = value;
    if (key === 'MIQYAS_FRONTEND_URL') {
      flowBaseUpdated = true;
    }
  }

  if (flowBaseUpdated) {
    syncDerivedConfig();
  }

  return config;
}

const hasWindow = typeof window !== 'undefined';
const locationSearch = hasWindow && typeof window.location === 'object' ? window.location.search : '';

// Debug flag
export const DEBUG = hasWindow && /[?&]size_core_debug=1/.test(locationSearch || '');
