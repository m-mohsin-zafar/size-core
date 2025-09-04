import { openWidget } from './widget.js';
import { DEBUG, config } from './config.js';
import { log, createInlineSVG } from './utils.js';
import { isProductPage } from './product-detection.js';
import { renderDebugOverlay } from './size-guides.js';

// Constants for button positioning
const BUTTON_POSITION_STORAGE_KEY = 'size-core-button-position';
const SCREEN_EDGE_PADDING = 10; // Minimum distance from screen edge

/**
 * Store button position in local storage
 */
function storeButtonPosition(bottom, right) {
  try {
    const position = { bottom, right };
    localStorage.setItem(BUTTON_POSITION_STORAGE_KEY, JSON.stringify(position));
    log('Button position stored:', position);
  } catch (e) {
    log('Failed to store button position:', e);
  }
}

/**
 * Get stored button position from local storage
 */
function getStoredButtonPosition() {
  try {
    const position = localStorage.getItem(BUTTON_POSITION_STORAGE_KEY);
    if (position) {
      return JSON.parse(position);
    }
  } catch (e) {
    log('Failed to retrieve button position:', e);
  }
  return null;
}

/**
 * Make button draggable
 */
function makeButtonDraggable(btn) {
  let startX, startY;
  let startRight, startBottom;
  let isDragging = false;
  let hasMoved = false;
  
  // Touch events for mobile
  btn.addEventListener('touchstart', handleStart, { passive: false });
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('touchend', handleEnd);
  
  // Mouse events for desktop
  btn.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleEnd);
  
  function handleStart(e) {
    // Store if it's a touch or mouse event
    const event = e.touches ? e.touches[0] : e;
    startX = event.clientX;
    startY = event.clientY;
    
    // Get current position from style
    const style = window.getComputedStyle(btn);
    startRight = parseInt(style.right);
    startBottom = parseInt(style.bottom);
    
    isDragging = true;
    hasMoved = false;
    
    // Prevent default to avoid page scrolling on mobile
    if (e.cancelable) e.preventDefault();
  }
  
  function handleMove(e) {
    if (!isDragging) return;
    
    // Stop event propagation
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    
    // Get current position
    const event = e.touches ? e.touches[0] : e;
    const deltaX = startX - event.clientX;
    const deltaY = startY - event.clientY;
    
    // If moved more than 5px, consider it a drag rather than a click
    if (!hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      hasMoved = true;
      btn.style.transition = 'none'; // Disable transitions during drag
    }
    
    if (hasMoved) {
      // Calculate new position
      const newRight = Math.max(SCREEN_EDGE_PADDING, startRight + deltaX);
      const newBottom = Math.max(SCREEN_EDGE_PADDING, startBottom - deltaY);
      
      // Apply new position
      btn.style.right = `${newRight}px`;
      btn.style.bottom = `${newBottom}px`;
    }
  }
  
  function handleEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    if (hasMoved) {
      // Re-enable transitions
      btn.style.transition = "transform .2s, background .25s, box-shadow .25s";
      
      // Get final position and save it
      const style = window.getComputedStyle(btn);
      const finalBottom = parseInt(style.bottom);
      const finalRight = parseInt(style.right);
      
      // Store the position
      storeButtonPosition(finalBottom, finalRight);
      
      // Prevent the click event from firing
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
  }
  
  // Add hover effects that respect dragging state
  btn.addEventListener("mouseenter", () => { 
    if (!isDragging) {
      btn.style.transform = "scale(1.08)"; 
      btn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
    }
  });
  
  btn.addEventListener("mouseleave", () => { 
    if (!isDragging) {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.15)"; 
    }
  });
  
  // Add click handler - Make sure it doesn't interfere with dragging
  btn.addEventListener("click", (e) => {
    // Only trigger click if not dragging
    if (!hasMoved) {
      onButtonClick(e);
    }
  });
  
  // Return variables that might be needed outside
  return { isDragging, hasMoved };
}

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
    const storedPosition = getStoredButtonPosition();
    
    if (mobile) {
      // Set up mobile styles with collision prevention
      Object.assign(btn.style, {
        width: '50px',  // Slightly smaller on mobile
        height: '50px'  // Maintain circle shape
      });
      
      // Apply stored position if available, otherwise use default
      if (storedPosition) {
        Object.assign(btn.style, {
          bottom: storedPosition.bottom + 'px',
          right: storedPosition.right + 'px'
        });
      } else {
        // Default position that avoids common mobile elements
        Object.assign(btn.style, {
          bottom: 'calc(60px + env(safe-area-inset-bottom, 0))', // Higher up to avoid bottom nav bars
          right: '16px'
        });
      }
    } else {
      // Desktop styles
      Object.assign(btn.style, {
        width: '56px',  // Larger on desktop
        height: '56px'  // Maintain circle shape
      });
      
      // Apply stored position if available, otherwise use default
      if (storedPosition) {
        Object.assign(btn.style, {
          bottom: storedPosition.bottom + 'px',
          right: storedPosition.right + 'px'
        });
      } else {
        // Default desktop position
        Object.assign(btn.style, {
          bottom: '20px',
          right: '20px'
        });
      }
    }
  } catch (e) {
    log('Error applying responsive styles:', e);
  }
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
    borderRadius: '50%', // Make it a perfect circle
    touchAction: 'none' // Prevents default touch actions to enable better dragging
  });
  
  // Apply responsive styles (also applies stored position if available)
  applyButtonResponsiveStyles(btn);
  
  // Make the button draggable - this also adds click and hover handlers
  makeButtonDraggable(btn);
  
  // Add event listeners for responsive design
  let resizeTO;
  window.addEventListener('resize', () => { 
    clearTimeout(resizeTO); 
    resizeTO = setTimeout(() => applyButtonResponsiveStyles(btn), 80); 
  });
  window.addEventListener('orientationchange', () => setTimeout(() => applyButtonResponsiveStyles(btn), 120));
  
  // Set accessibility attributes
  btn.setAttribute("aria-label", "Get size recommendation");
  
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
