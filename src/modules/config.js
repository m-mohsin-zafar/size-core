// Core configuration settings
export const config = {
  // Logo strategy (resolved in main index.js)
  FALLBACK_URL_FRAGMENT: "/dev-g28fdlssrobui45i/%D9%81%D8%B3%D8%AA%D8%A7%D9%86/p1123056285".toLowerCase(),
  EXTERNAL_FLOW_BASE: "https://staging.miqyas.ai/guided-photos",
  TRACK_CLICK_ENDPOINT: "https://your-saas.com/track-click", // TODO: adjust
  TRACK_RETURN_ENDPOINT: "https://your-saas.com/track-return", // TODO: adjust
  WIDGET_ID: "size-core-widget",
  WIDGET_IFRAME_ID: "size-core-widget-iframe",
  WIDGET_OPEN_CLASS: "size-core-open",
  WIDGET_GREETING_ID: "size-core-greeting",
  STORE_ID: null, // Will be populated from script data-store-id attribute
  LOGO_PATH: null, // Will be populated from script data-logo attribute
  THEME_COLOR: "#ff6f61" // Default theme color, can be overridden with data-theme-color
};

// Compute flow origin once
export const FLOW_ORIGIN = (function() { 
  try { 
    return new URL(config.EXTERNAL_FLOW_BASE).origin; 
  } catch { 
    return null; 
  } 
})();

// Debug flag
export const DEBUG = /[?&]size_core_debug=1/.test(window.location.search);
