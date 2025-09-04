import { openWidget } from './widget.js';
import { DEBUG } from './config.js';
import { log, createInlineSVG } from './utils.js';
import { isProductPage } from './product-detection.js';
import { renderDebugOverlay } from './size-guides.js';

/**
 * Helper function to create a logo image with proper attributes
 */
function createLogoImage(src) {
  const img = document.createElement('img');
  img.alt = 'Size Recommendation';
  img.src = src;
  img.className = 'size-core-logo-img';
  Object.assign(img.style, {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block'
  });
  img.decoding = 'async';
  img.loading = 'lazy';
  
  // Add error handling
  img.onerror = () => {
    log('Logo image failed to load:', src);
    img.src = '/logo.svg'; // Try SVG fallback
    img.onerror = () => {
      log('Fallback SVG failed, using PNG');
      img.src = '/logo.png'; // Final fallback
    };
  };
  
  return img;
}

/**
 * Apply responsive styles to the button
 */
export function applyButtonResponsiveStyles(btn) {
  try {
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    if (mobile) {
      Object.assign(btn.style, {
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
        right: '16px',
        width: '50px',  // Slightly smaller on mobile
        height: '50px'  // Maintain circle shape
      });
    } else {
      Object.assign(btn.style, {
        bottom: '20px',
        right: '20px',
        width: '56px',  // Larger on desktop
        height: '56px'  // Maintain circle shape
      });
    }
  } catch {}
}

/**
 * Create the floating button with logo
 */
export function createButton(logoUrl) {
  if (document.getElementById("size-core-floating-btn")) return null;
  const btn = document.createElement("button");
  btn.id = "size-core-floating-btn";
  
  // Create logo container with fixed dimensions for consistent layout
  const logoContainer = document.createElement('div');
  logoContainer.className = 'size-core-logo-container';
  Object.assign(logoContainer.style, {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    margin: '0'
  });
  
  // Check if logoUrl is an SVG data URI
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/svg+xml')) {
    try {
      // Try to create an inline SVG for best quality
      const svg = createInlineSVG(logoUrl, 'size-core-logo-svg');
      if (svg) {
        // Set SVG styles for proper display
        Object.assign(svg.style, {
          width: '100%',
          height: '100%',
          display: 'block'
        });
        logoContainer.appendChild(svg);
      } else {
        throw new Error('Failed to create inline SVG');
      }
    } catch (err) {
      // Fallback to image if inline SVG fails
      const img = createLogoImage(logoUrl);
      logoContainer.appendChild(img);
    }
  } else {
    // Use regular image for non-SVG or external URLs
    const img = createLogoImage(logoUrl);
    logoContainer.appendChild(img);
  }
  
  // Add logo container to button
  btn.appendChild(logoContainer);
  
  // Style the button as a circle with only the logo
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    background: "#ffffff",
    color: "#111",
    border: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
    zIndex: 100000,
    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
    transition: "transform .2s, background .25s, box-shadow .25s",
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    width: '56px',
    height: '56px',
    borderRadius: '50%' // Make it a perfect circle
  });
  applyButtonResponsiveStyles(btn);
  
  // Add event listeners
  let resizeTO;
  window.addEventListener('resize', () => { 
    clearTimeout(resizeTO); 
    resizeTO = setTimeout(() => applyButtonResponsiveStyles(btn), 80); 
  });
  window.addEventListener('orientationchange', () => setTimeout(() => applyButtonResponsiveStyles(btn), 120));
  
  // Set accessibility attributes
  btn.setAttribute("aria-label", "Get size recommendation");
  
  // Add hover effects
  btn.addEventListener("mouseenter", () => { 
    btn.style.transform = "scale(1.08)"; 
    btn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
  });
  btn.addEventListener("mouseleave", () => { 
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.15)"; 
  });
  
  // Add click handler
  btn.addEventListener("click", onButtonClick);
  
  return btn;
}

/**
 * Button click handler
 */
export function onButtonClick(e) {
  e.preventDefault();
  openWidget();
}

// Injection attempt tracking
let _injectAttempts = 0;
const MAX_INJECT_ATTEMPTS = 10; // safety bound

/**
 * Inject the button if needed and it's a product page
 */
export function injectButtonIfNeeded(logoUrl, force=false) {
  if (!document.body) return;
  if (!force && document.getElementById("size-core-floating-btn")) return; // already there
  const pdp = isProductPage();
  if (!pdp) {
    if (_injectAttempts < MAX_INJECT_ATTEMPTS) {
      _injectAttempts++;
      setTimeout(() => injectButtonIfNeeded(logoUrl), 500 * Math.min(_injectAttempts,4));
    }
    return;
  }
  if (document.getElementById("size-core-floating-btn")) return; // re-check after async
  const btn = createButton(logoUrl);
  if (!btn) return;
  document.body.appendChild(btn);
  log("Injected button (attempt", _injectAttempts, ")");
  if (DEBUG) renderDebugOverlay();
}
