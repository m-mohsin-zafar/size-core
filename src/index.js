// index.js // Size Recommendation Button
// Version: 0.1.1

// Import modules
import { svgToDataURI, fetchSVG, log } from './modules/utils.js';
import { DEBUG, config, FLOW_ORIGIN } from './modules/config.js';
import { isProductPage, resolveProductId } from './modules/product-detection.js';
import { createButton, injectButtonIfNeeded, applyButtonResponsiveStyles } from './modules/button.js';
import { ensureWidgetShell, openWidget, closeWidget, loadFlowIframe, handleIframeMessage } from './modules/widget.js';
import { showSallaStatus } from './modules/widget-status.js';
import { setupObservers } from './modules/observers.js';
import { handleReturn } from './modules/return-handler.js';
import { renderDebugOverlay, probeSizeGuides } from './modules/size-guides.js';
import { initGlobalMessageListener, getIframeData, sendMessageToIframe } from './modules/iframe-communication.js';
import { showConnectingUI } from './modules/widget-connect.js';

// Self-executing function to avoid global pollution
(function () {
  // Initialize global message listener for Salla integration ASAP
  initGlobalMessageListener();
  
  // Add event listener for salla_connected event
  window.addEventListener('widget:salla_connected', () => {
    // Show the connecting UI when Salla is connected
    showConnectingUI();
  });
  
  // Detect script tag and extract configuration from data attributes
  const configureFromScriptTag = () => {
    // Get all script tags
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      // Check if this is our script (by src path or other unique identifier)
      if (script.src && (script.src.includes('/src/index.js') || 
                         script.src.includes('/size-core.umd.js') || 
                         script.src.includes('/size-core.es.js'))) {
        // Extract all data attributes for configuration
        const dataAttrs = script.dataset;
        
        // Store ID configuration
        if (dataAttrs.storeId) {
          log('Detected store ID:', dataAttrs.storeId);
          config.STORE_ID = dataAttrs.storeId;
        }
        
        // Logo configuration
        if (dataAttrs.logo) {
          log('Detected custom logo path:', dataAttrs.logo);
          config.LOGO_PATH = dataAttrs.logo;
        }
        
        // Theme color configuration (optional for future use)
        if (dataAttrs.themeColor) {
          log('Detected theme color:', dataAttrs.themeColor);
          config.THEME_COLOR = dataAttrs.themeColor;
        }
        
        break;
      }
    }
  };

  // Extract configuration from script tag
  configureFromScriptTag();

  /**
   * Simplified logo loading strategy:
   * 1. Try to load from config.LOGO_PATH if specified in script data attribute
   * 2. Try standard locations: /assets/logo.svg, /images/logo.svg, /logo.svg
   * 3. Fall back to a base64 encoded minimal logo if all else fails
   */
  const loadLogo = async () => {
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
        log('Trying to load logo from:', path);
        // If path ends with .svg, try to fetch and inline
        if (path.toLowerCase().endsWith('.svg')) {
          const svgData = await fetchSVG(path);
          if (svgData) {
            log('Successfully loaded SVG from:', path);
            return svgData;
          }
        } else {
          // For non-SVG files, just return the path
          log('Using non-SVG logo from:', path);
          return path;
        }
      } catch (err) {
        log('Failed to load logo from:', path, err.message);
        // Continue to next path
      }
    }
    
    // If we get here, all paths failed - use fallback minimal logo
    log('Using fallback minimal logo');
    
    // Simple inline SVG as a last resort
    const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="#ff6f61"/>
      <path d="M12 6v12M6 12h12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    
    return svgToDataURI(fallbackSVG);
  };

  // Set up message handling
  window.addEventListener("message", handleIframeMessage);

  // Bootstrap function
  async function init() {
    // Load the logo with our optimized strategy
    const logoURL = await loadLogo();
    
    // Multiple staggered attempts to catch late-loading DOM on PDP
    [0, 400, 1200, 2500].forEach(delay => 
      setTimeout(() => injectButtonIfNeeded(logoURL), delay)
    );
    
    handleReturn();
    if (DEBUG) await renderDebugOverlay();
  }

  // Set up observers for navigation
  setupObservers();

  // Initialize once DOM is ready
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  
  // Backup direct listener for Salla messages
  window.addEventListener('message', function(event) {
    try {
      const data = event.data;
      
      // Handle different Salla message types
      if (data && data.type === 'SALLA_CONNECTED') {
        log('📢 Direct Salla message received:', data);
        
        // Show connection status in the widget instead of an alert
        if (data.storeId) {
          // Show the connection status in the widget UI
          setTimeout(() => {
            window.sizeCore.showSallaStatus(data);
          }, 500);
        }
      } else if (data && data.type === 'SALLA_RESULTS') {
        log('📢 Direct Salla results received:', data);
        
        // Show results in the widget UI
        setTimeout(() => {
          window.sizeCore.showSallaRecommendation(data);
        }, 500);
      } else if (data && data.type === 'SALLA_ERROR') {
        log('📢 Direct Salla error received:', data);
        
        // Show error in the widget UI
        setTimeout(() => {
          window.sizeCore.showSallaError(data);
        }, 500);
      }
    } catch (err) {
      log('Error in direct Salla message handler:', err);
    }
  });
  
  // Expose public API
  window.sizeCore = window.sizeCore || {
    openWidget,
    closeWidget,
    getIframeData,
    // Add methods to directly display recommendation or error
    showSallaRecommendation: (data) => {
      // Import dynamically to avoid circular dependencies
      import('./modules/widget-salla-handlers.js').then(module => {
        openWidget();
        setTimeout(() => module.showSallaRecommendation(data), 300);
      });
    },
    showSallaError: (data) => {
      // Import dynamically to avoid circular dependencies
      import('./modules/widget-salla-handlers.js').then(module => {
        openWidget();
        setTimeout(() => module.showSallaError(data), 300);
      });
    },
    showSallaStatus: (data) => {
      openWidget();
      setTimeout(() => showSallaStatus(data), 300);
    }
  };
})();
