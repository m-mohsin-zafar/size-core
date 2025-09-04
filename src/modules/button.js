import { openWidget } from './widget.js';
import { DEBUG, config } from './config.js';
import { log, createInlineSVG } from './utils.js';
import { isProductPage } from './product-detection.js';
import { renderDebugOverlay } from './size-guides.js';

// Constants for button positioning
const BUTTON_POSITION_STORAGE_KEY = 'size-core-button-position';
const SCREEN_EDGE_PADDING = 10; // Minimum distance from screen edge
// Instead of fixed pixel values, use percentages of the viewport
const MAX_DISTANCE_PERCENTAGE = 0.7; // Button can't be more than 70% away from edges

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
  let touchId = null; // Track which touch is being used for dragging
  
  // Touch events for mobile
  btn.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchcancel', handleTouchEnd);
  
  // Mouse events for desktop
  btn.addEventListener('mousedown', handleMouseStart);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseEnd);
  
  // We'll use a single click handler to avoid conflicts
  btn.addEventListener('click', (e) => {
    if (!hasMoved) {
      onButtonClick(e);
    } else {
      // Prevent click after drag
      e.preventDefault();
      e.stopPropagation();
    }
  });
  
  // Touch-specific handlers
  function handleTouchStart(e) {
    if (e.touches.length !== 1) return; // Only handle single touches
    
    touchId = e.touches[0].identifier;
    startDrag(e.touches[0]);
    
    // We don't prevent default here to allow click events to work
    // Only prevent if clearly a drag operation
  }
  
  function handleTouchMove(e) {
    if (!isDragging) return;
    
    // Find our tracked touch
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    
    if (!touch) return;
    
    // Now that we're definitely dragging, prevent default to stop scrolling
    if (e.cancelable) e.preventDefault();
    
    processDrag(touch, e);
  }
  
  function handleTouchEnd(e) {
    // Check if our touch ended
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        endDrag(e);
        
        // Reset state but don't prevent click if we didn't move
        touchId = null;
        
        // Important: Reset hasMoved after a short delay to allow the click event to fire
        if (!hasMoved) {
          // Don't do anything special, let the click event fire naturally
        } else {
          // Prevent any subsequent click events if we definitely dragged
          e.preventDefault();
          e.stopPropagation();
        }
        
        break;
      }
    }
  }
  
  // Mouse-specific handlers
  function handleMouseStart(e) {
    startDrag(e);
    if (e.cancelable) e.preventDefault();
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    processDrag(e, e);
  }
  
  function handleMouseEnd(e) {
    if (isDragging) {
      endDrag(e);
    }
  }
  
  // Shared drag logic
  function startDrag(event) {
    // Store initial positions
    startX = event.clientX;
    startY = event.clientY;
    
    // Get current position from style
    const style = window.getComputedStyle(btn);
    startRight = parseInt(style.right);
    startBottom = parseInt(style.bottom);
    
    isDragging = true;
    hasMoved = false;
  }
  
  function processDrag(event, originalEvent) {
    if (!isDragging) return;
    
    // Stop event propagation
    originalEvent.stopPropagation();
    if (originalEvent.cancelable) originalEvent.preventDefault();
    
    // Calculate the delta (how much the finger/mouse has moved)
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    
    // If moved more than 5px, consider it a drag rather than a click
    if (!hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      hasMoved = true;
      btn.style.transition = 'none'; // Disable transitions during drag
    }
    
    if (hasMoved) {
      // Get viewport dimensions for calculating maximum distances
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Calculate maximum positions based on viewport size
      const maxRight = Math.min(viewportWidth * MAX_DISTANCE_PERCENTAGE, viewportWidth - btn.offsetWidth - SCREEN_EDGE_PADDING);
      const maxBottom = Math.min(viewportHeight * MAX_DISTANCE_PERCENTAGE, viewportHeight - btn.offsetHeight - SCREEN_EDGE_PADDING);
      
      // Calculate new position with corrected direction logic and dynamic limits
      const newRight = Math.min(
        Math.max(SCREEN_EDGE_PADDING, startRight - deltaX), 
        maxRight
      );
      const newBottom = Math.min(
        Math.max(SCREEN_EDGE_PADDING, startBottom - deltaY),
        maxBottom
      );
      
      // Apply new position
      btn.style.right = `${newRight}px`;
      btn.style.bottom = `${newBottom}px`;
    }
  }
  
  function endDrag(originalEvent) {
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
      
      // For touch events, prevent click if we dragged
      if (originalEvent.type.startsWith('touch') && originalEvent.cancelable) {
        originalEvent.preventDefault();
      }
    }
    
    // Reset hasMoved after a small delay to allow any click event to fire first
    setTimeout(() => {
      hasMoved = false;
    }, 50);
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
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Base size based on device
    let size = mobile ? 50 : 56;
    
    // Make sure position is within valid screen bounds
    let bottom = 20;
    let right = 20;
    
    // Calculate maximum distances dynamically based on viewport
    const maxBottom = Math.min(
      windowHeight * MAX_DISTANCE_PERCENTAGE, 
      windowHeight - size - SCREEN_EDGE_PADDING
    );
    
    const maxRight = Math.min(
      windowWidth * MAX_DISTANCE_PERCENTAGE, 
      windowWidth - size - SCREEN_EDGE_PADDING
    );
    
    if (storedPosition) {
      // Validate stored position to ensure it's within screen bounds
      bottom = Math.min(storedPosition.bottom, maxBottom);
      right = Math.min(storedPosition.right, maxRight);
      
      // Enforce minimums
      bottom = Math.max(SCREEN_EDGE_PADDING, bottom);
      right = Math.max(SCREEN_EDGE_PADDING, right);
    } else {
      // Default positions
      if (mobile) {
        bottom = Math.max(60, SCREEN_EDGE_PADDING + (window.visualViewport ? window.visualViewport.height * 0.15 : 60));
        right = 16;
      } else {
        bottom = 20;
        right = 20;
      }
    }
    
    // Apply validated position and size
    Object.assign(btn.style, {
      width: `${size}px`,
      height: `${size}px`,
      bottom: `${bottom}px`,
      right: `${right}px`
    });
    
    // For mobile, add safe area inset to avoid notches and home indicators
    if (mobile) {
      btn.style.bottom = `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`;
    }
  } catch (e) {
    log('Error applying responsive styles:', e);
    // Fallback to basic positioning if something goes wrong
    Object.assign(btn.style, {
      width: '50px',
      height: '50px',
      bottom: '20px',
      right: '20px'
    });
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
