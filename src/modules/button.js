import { openWidget } from './widget.js';
import { DEBUG, config } from './config.js';
import { log, createInlineSVG, tw } from './utils.js';
import { isProductPage } from './product-detection.js';
import { renderDebugOverlay } from './size-guides.js';

function applyTwClasses(element, ...classGroups) {
  const classes = tw(...classGroups).split(' ').filter(Boolean);
  element.classList.add(...classes);
}

function removeTwClasses(element, ...classGroups) {
  const classes = tw(...classGroups).split(' ').filter(Boolean);
  if (classes.length) element.classList.remove(...classes);
}

const BUTTON_POSITION_STORAGE_KEY = 'size-core-button-position';
const SCREEN_EDGE_PADDING = 10;
const MAX_DISTANCE_PERCENTAGE = 0.7;

const BASE_BUTTON_CLASSES = 'tw-relative tw-flex tw-items-center tw-justify-center tw-rounded-[10px] tw-border tw-border-black/10 tw-bg-[#f2f2f8] tw-text-[#111] tw-text-sm tw-font-medium tw-touch-none tw-transition-[all] tw-duration-800 tw-ease-[cubic-bezier(0.25,0.1,0.25,1)]';
const RECT_BUTTON_CLASSES = 'tw-gap-3.5 tw-px-5 tw-py-3 tw-min-w-[220px] tw-h-14';
const CIRC_BUTTON_CLASSES = 'tw-gap-0 tw-p-3 tw-w-14 tw-h-14 tw-min-w-[56px] tw-justify-center tw-border tw-border-black/15 tw-rounded-full tw-shadow-none';
const TEXT_BASE_CLASSES = 'tw-whitespace-nowrap tw-font-sans tw-font-semibold tw-leading-none tw-transition tw-duration-500 tw-ease-out [transition-property:opacity,transform] tw-m-[2px]';
const TEXT_VISIBLE_CLASSES = 'tw-opacity-100 tw-translate-x-0';
const TEXT_HIDE_CLASSES = 'tw-opacity-0 tw-translate-x-5';
const LOGO_POP_CLASSES = 'tw-transform tw-scale-[1.10] tw-mx-auto';
const HOVER_CLASSES = 'tw-transform tw-scale-[1.05] tw-border-black/15 tw-bg-[#f4f4fb]';

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
function makeButtonDraggable(container) {
  let startX, startY;
  let startRight, startBottom;
  let isDragging = false;
  let hasMoved = false;
  let touchId = null; // Track which touch is being used for dragging
  
  // Get the actual button element inside the container
  const btn = container.querySelector('#size-core-floating-btn');
  
  // Touch events for mobile
  container.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchcancel', handleTouchEnd);
  
  // Mouse events for desktop
  container.addEventListener('mousedown', handleMouseStart);
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
    const style = window.getComputedStyle(container);
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
      container.style.transition = 'none'; // Disable transitions during drag
    }
    
    if (hasMoved) {
      // Get viewport dimensions for calculating maximum distances
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Calculate maximum positions based on viewport size
      const maxRight = Math.min(viewportWidth * MAX_DISTANCE_PERCENTAGE, viewportWidth - container.offsetWidth - SCREEN_EDGE_PADDING);
      const maxBottom = Math.min(viewportHeight * MAX_DISTANCE_PERCENTAGE, viewportHeight - container.offsetHeight - SCREEN_EDGE_PADDING);
      
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
      container.style.right = `${newRight}px`;
      container.style.bottom = `${newBottom}px`;
    }
  }
  
  function endDrag(originalEvent) {
    if (!isDragging) return;
    isDragging = false;
    
    if (hasMoved) {
      // Re-enable transitions
      container.style.transition = "all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1.0)";
      
      // Get final position and save it
      const style = window.getComputedStyle(container);
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
  container.addEventListener("mouseenter", () => { 
    if (!isDragging) {
      btn.style.transform = "scale(1.08)";
      
      // Use different border based on button state (circular or rectangular)
      if (btn.classList.contains('circular')) {
        btn.style.border = "1px solid rgba(0,0,0,0.18)";
        btn.style.background = "#f2f2f8";
      } else {
        btn.style.border = "1px solid rgba(0,0,0,0.15)";
        btn.style.background = "#f2f2f8";
      }
    }
  });
  
  container.addEventListener("mouseleave", () => { 
    if (!isDragging) {
      btn.style.transform = "scale(1)";
      
      // Restore default styles based on button state
      if (btn.classList.contains('circular')) {
        btn.style.border = "1px solid rgba(0,0,0,0.12)";
        btn.style.background = "#f2f2f8";
      } else {
        btn.style.border = "1px solid rgba(0,0,0,0.08)";
        btn.style.background = "#f2f2f8";
      }
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
  applyTwClasses(img, 'tw-block tw-h-full tw-w-full tw-object-contain');
  img.decoding = 'async';
  img.loading = 'lazy';
  
  // Add error handling
  img.onerror = () => {
    log('Logo image failed to load:', src);
    img.src = '/logo.svg'; // Try SVG fallback
    img.onerror = () => {
      log('Fallback SVG failed, using PNG');
      img.src = '/logo.svg'; // Final fallback
    };
  };
  
  return img;
}

/**
 * Apply responsive styles to the button
 */
export function applyButtonResponsiveStyles(btnContainer) {
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
        // bottom = Math.max(60, SCREEN_EDGE_PADDING + (window.visualViewport ? window.visualViewport.height * 0.15 : 60));
        bottom = 16;
        right = 16;
      } else {
        bottom = 20;
        right = 20;
      }
    }
    
    // Apply validated position and size to the container
    Object.assign(btnContainer.style, {
      bottom: `${bottom}px`,
      right: `${right}px`
    });
    
    // For mobile, add safe area inset to avoid notches and home indicators
    if (mobile) {
      btnContainer.style.bottom = `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`;
    }

    // Check if the button has already been animated to circular
    const btn = btnContainer.querySelector('#size-core-floating-btn');
    if (btn && btn.classList.contains('circular')) {
      // If already circular, just update the size
      Object.assign(btn.style, {
        width: `${size}px`,
        height: `${size}px`
      });
    }
  } catch (e) {
    log('Error applying responsive styles:', e);
    // Fallback to basic positioning if something goes wrong
    Object.assign(btnContainer.style, {
      bottom: '20px',
      right: '20px'
    });
  }
}

/**
 * Animate the button from rectangular with text to circular with only logo
 */
function animateToCircularButton(btn, textSpan, logoContainer, buttonContainer) {
  // First fade out the text
  textSpan.style.opacity = "0";
  textSpan.style.transform = "translateX(20px)";
  
  // After the text starts fading, begin transforming the button shape
  setTimeout(() => {
    // Animate to circular button
    Object.assign(btn.style, {
      borderRadius: "50%",
      width: "56px", // Will be updated by responsive styles if needed
      minWidth: "56px",
      padding: "12px",
      gap: "0", // Remove gap when circular
      justifyContent: "center",
      boxShadow: "none", // Remove shadow
      border: "1px solid rgba(0,0,0,0.12)" // Add more visible border
    });
    
    // Ensure logo is centered
    Object.assign(logoContainer.style, {
      margin: "0 auto",
      transform: "scale(1.1)" // Slightly enlarge the logo
    });
    
    // Hide text completely when animation completes
    setTimeout(() => {
      textSpan.style.display = "none";
      // Mark the button as circular for future reference
      btn.classList.add("circular");
    }, 800); // Increased from 500ms
    
  }, 400); // Increased from 200ms
}

/**
 * Create the floating button with logo
 */
export function createButton(logoUrl) {
  if (document.getElementById("size-core-floating-btn")) return null;
  
  // Create the outer container that will handle the animation
  const buttonContainer = document.createElement("div");
  buttonContainer.id = "size-core-floating-container";
  buttonContainer.className = tw(
    'tw-fixed tw-bottom-4 tw-right-4 tw-z-[100000] tw-flex tw-items-center tw-justify-center tw-overflow-hidden',
    'tw-transition-[all] tw-duration-500 tw-ease-[cubic-bezier(0.25,0.1,0.25,1)]'
  );
  
  // Create the button element
  const btn = document.createElement("button");
  btn.id = "size-core-floating-btn";
  
  // Create initial text span
  const textSpan = document.createElement("span");
  textSpan.id = "size-core-btn-text";
  textSpan.textContent = "Get Size Recommendation";
  applyTwClasses(textSpan,
    'tw-whitespace-nowrap tw-font-semibold tw-transition tw-duration-500 tw-ease-out [transition-property:opacity,transform]'
  );
  
  // Create logo container with fixed dimensions for consistent layout
  const logoContainer = document.createElement('div');
  logoContainer.className = 'size-core-logo-container';
  logoContainer.id = 'size-core-logo-container';
  applyTwClasses(logoContainer,
    'tw-flex tw-h-8 tw-w-8 tw-flex-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-transition-transform tw-duration-300 tw-ease-out'
  );
  
  // Check if logoUrl is an SVG data URI
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/svg+xml')) {
    try {
      // Try to create an inline SVG for best quality
      const svg = createInlineSVG(logoUrl, 'size-core-logo-svg');
      if (svg) {
        // Set SVG styles for proper display
        svg.classList.add('tw-block', 'tw-h-full', 'tw-w-full');
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
  
  // Add logo and text to button in that order (logo first, then text)
  btn.appendChild(logoContainer);
  btn.appendChild(textSpan);
  
  // Style the button for initial state - rectangular with text and logo
  btn.className = tw(
    'tw-relative tw-flex tw-items-center tw-justify-center tw-gap-3.5 tw-rounded-[10px]',
    'tw-border tw-border-black/10 tw-bg-[#f2f2f8] tw-text-[#111] tw-text-sm tw-font-medium',
    'tw-px-5 tw-py-3 tw-min-w-[220px] tw-h-14 tw-touch-none tw-transition-[all] tw-duration-800 tw-ease-[cubic-bezier(0.25,0.1,0.25,1)]'
  );
  
  // Add button to container
  buttonContainer.appendChild(btn);
  
  // Apply responsive styles to container (also applies stored position if available)
  applyButtonResponsiveStyles(buttonContainer);
  
  // Make the button draggable
  makeButtonDraggable(buttonContainer);
  
  // Add event listeners for responsive design
  let resizeTO;
  window.addEventListener('resize', () => { 
    clearTimeout(resizeTO); 
    resizeTO = setTimeout(() => applyButtonResponsiveStyles(buttonContainer), 80); 
  });
  window.addEventListener('orientationchange', () => setTimeout(() => applyButtonResponsiveStyles(buttonContainer), 120));
  
  // Set accessibility attributes
  btn.setAttribute("aria-label", "Get size recommendation");
  textSpan.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  textSpan.style.margin = "2px";
  
  // Trigger animation after a short delay to ensure the button is visible first
  setTimeout(() => {
    animateToCircularButton(btn, textSpan, logoContainer, buttonContainer);
  }, 3500); // Increased from 2000ms
  
  return buttonContainer;
}

/**
 * Button click handler
 */
export function onButtonClick(e) {
  e.preventDefault();
  // Reset the manual close flag when user explicitly clicks the button
  window.__sizeCoreWidgetManuallyClosed = false;
  // Set flag to indicate explicit opening
  window.__sizeCoreWidgetExplicitOpen = true;
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
  
  // Check if button already exists
  if (!force && (document.getElementById("size-core-floating-container") || document.getElementById("size-core-floating-btn"))) {
    return; // already there
  }
  
  const pdp = isProductPage();
  if (!pdp) {
    if (_injectAttempts < MAX_INJECT_ATTEMPTS) {
      _injectAttempts++;
      setTimeout(() => injectButtonIfNeeded(logoUrl), 500 * Math.min(_injectAttempts,4));
    }
    return;
  }
  
  // Double check after async
  if (document.getElementById("size-core-floating-container") || document.getElementById("size-core-floating-btn")) {
    return;
  }
  
  const buttonContainer = createButton(logoUrl);
  if (!buttonContainer) return;
  
  document.body.appendChild(buttonContainer);
  log("Injected button (attempt", _injectAttempts, ")");
  if (DEBUG) renderDebugOverlay();
}
