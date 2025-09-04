import { DEBUG, config } from './config.js';
import { injectButtonIfNeeded } from './button.js';
import { renderDebugOverlay } from './size-guides.js';
import { handleReturn } from './return-handler.js';
import { fetchSVG, svgToDataURI } from './utils.js';

/**
 * Navigation and mutation observation
 */

// State variables
let lastHref = location.href;
let mutationScheduled = false;
let _injectAttempts = 0;
let cachedLogoUrl = null;

/**
 * Load logo using the same strategy as in index.js
 * This ensures consistency if we need to reload the logo after navigation
 */
async function loadLogoForObserver() {
  if (cachedLogoUrl) return cachedLogoUrl;
  
  // Default search paths for logo
  const defaultPaths = [
    config.LOGO_PATH,                    // From data-logo attribute (if specified)
    '/assets/logo.svg',                  // Common location 1
    '/images/logo.svg',                  // Common location 2
    '/logo.svg',                         // Root location
    '/assets/images/logo.svg',           // Common location 3
    '/static/logo.svg',                  // Common location 4
    '/public/logo.svg'                   // Common location 5
  ].filter(Boolean); // Remove undefined/null entries
    
  // Try each path in sequence
  for (const path of defaultPaths) {
    try {
      // If path ends with .svg, try to fetch and inline
      if (path.toLowerCase().endsWith('.svg')) {
        const svgData = await fetchSVG(path);
        if (svgData) {
          cachedLogoUrl = svgData;
          return cachedLogoUrl;
        }
      } else {
        // For non-SVG files, just return the path
        cachedLogoUrl = path;
        return path;
      }
    } catch {
      // Continue to next path
    }
  }
  
  // Simple fallback SVG as a last resort
  const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="${config.THEME_COLOR}"/>
    <path d="M12 6v12M6 12h12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  
  cachedLogoUrl = svgToDataURI(fallbackSVG);
  return cachedLogoUrl;
}

/**
 * Check state and re-inject if needed
 */
export function performStateCheck(urlChanged) {
  if (urlChanged) {
    _injectAttempts = 0; // reset attempts for new page
    cachedLogoUrl = null; // Reset cached logo on navigation
    
    setTimeout(async () => {
      const logoUrl = await loadLogoForObserver();
      injectButtonIfNeeded(logoUrl, true);
      if (DEBUG) renderDebugOverlay();
      handleReturn();
    }, 150);
  } else {
    // No URL change: still attempt injection if missing (async content load)
    if (cachedLogoUrl) {
      injectButtonIfNeeded(cachedLogoUrl);
    } else {
      loadLogoForObserver().then(logoUrl => {
        injectButtonIfNeeded(logoUrl);
      });
    }
  }
}

/**
 * Schedule state check with debounce
 */
export function scheduleMutationCheck() {
  if (mutationScheduled) return;
  mutationScheduled = true;
  setTimeout(() => {
    mutationScheduled = false;
    const urlChanged = location.href !== lastHref;
    if (urlChanged) lastHref = location.href;
    performStateCheck(urlChanged);
  }, 180);
}

/**
 * Initialize observers and event listeners
 */
export function setupObservers() {
  // Initialize the cached logo URL (will be fetched when needed)
  cachedLogoUrl = null;
  _injectAttempts = 0;
  
  const observer = new MutationObserver(() => scheduleMutationCheck());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  
  // Intercept history methods
  const origPush = history.pushState;
  history.pushState = function () { 
    origPush.apply(this, arguments); 
    scheduleMutationCheck(); 
  };
  
  const origReplace = history.replaceState;
  history.replaceState = function () { 
    origReplace.apply(this, arguments); 
    scheduleMutationCheck(); 
  };
  
  // Add other navigation events
  window.addEventListener("popstate", () => scheduleMutationCheck());
  window.addEventListener("visibilitychange", () => { 
    if (!document.hidden && cachedLogoUrl) injectButtonIfNeeded(cachedLogoUrl); 
  });
  window.addEventListener("pageshow", async () => {
    if (!cachedLogoUrl) {
      try {
        cachedLogoUrl = await fetchSVG('/logo.svg') || '/logo.png';
      } catch {
        cachedLogoUrl = '/logo.png';
      }
    }
    injectButtonIfNeeded(cachedLogoUrl);
  }); 
}
