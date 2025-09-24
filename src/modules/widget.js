import { config, FLOW_ORIGIN } from './config.js';
import { escapeHTML, log, genUUID } from './utils.js';
import { resolveProductId } from './product-detection.js';
import { trackClick } from './size-guides.js';
import { setupIframeMessageListener, sendMessageToIframe, getIframeData } from './iframe-communication.js';

// Import Salla-specific handlers
export { showSallaRecommendation, showSallaError } from './widget-salla-handlers.js';
export { showSallaStatus } from './widget-status.js';

/**
 * Shows an empty state when no results are available yet
 * @param {HTMLElement} shell - The widget shell element
 */
export function showEmptyState(shell) {
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  
  // Create the empty state container
  const emptyStateWrap = document.createElement("div");
  Object.assign(emptyStateWrap.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 20px",
    margin: "auto",
    width: "100%",
    maxWidth: "500px",
    boxSizing: "border-box"
  });
  
  // Create illustration placeholder (can be replaced with an actual SVG or image)
  const illustration = document.createElement("div");
  Object.assign(illustration.style, {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    background: "#E6E6F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
    color: "#6F6F8A",
    fontSize: "36px",
    fontWeight: "200"
  });
  illustration.innerHTML = "📏"; // Simple emoji as placeholder
  emptyStateWrap.appendChild(illustration);
  
  // Title
  const title = document.createElement("h2");
  title.textContent = "No Measurements Yet";
  Object.assign(title.style, {
    fontSize: "22px",
    fontWeight: "600",
    color: "#333",
    margin: "0 0 12px"
  });
  emptyStateWrap.appendChild(title);
  
  // Description
  const description = document.createElement("p");
  description.textContent = "Take a few photos to get your personalized tailor fit measurements";
  Object.assign(description.style, {
    fontSize: "15px",
    lineHeight: "1.5",
    color: "#666",
    margin: "0 0 30px",
    maxWidth: "400px"
  });
  emptyStateWrap.appendChild(description);
  
  // Start button
  const startBtn = document.createElement("button");
  startBtn.textContent = "Let's Get Started";
  Object.assign(startBtn.style, {
    background: "#903316",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px 28px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.15)"
  });
  startBtn.addEventListener("click", () => {
    // Prevent multiple clicks if already connecting
    if (window.__sizeCoreConnecting) {
      log('Already connecting, ignoring additional clicks');
      return;
    }
    
    // Check if desktop view
    const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
    
    if (isDesktop) {
      // For desktop, use Socket.IO connection exclusively
      establishSocketConnection(shell);
    } else {
      // For mobile, continue with the existing iframe flow
      import('./iframe-communication.js').then(module => {
        if (module.clearMeasurementData) {
          module.clearMeasurementData();
        }
        loadFlowIframe(shell);
      });
    }
  });
  emptyStateWrap.appendChild(startBtn);
  
  // Clear the container and add the empty state
  container.innerHTML = "";
  container.appendChild(emptyStateWrap);
  
  // Track this event
  trackClick("empty_state_displayed");
  
  return emptyStateWrap;
}

/**
 * Create the shell for the widget
 */
export function ensureWidgetShell() {
  let shell = document.getElementById(config.WIDGET_ID);
  if (shell) return shell;
  
  // Create a function to check if we're on a mobile/tablet device
  const isMobileOrTablet = () => window.matchMedia('(max-width: 1024px)').matches;
  const isMobile = isMobileOrTablet();
  
  shell = document.createElement("div");
  shell.id = config.WIDGET_ID;
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");

  // Inject Red Hat fonts link tags if not already present
  try {
    if (typeof document !== 'undefined' && !document.getElementById('size-core-fonts')) {
      const link = document.createElement('link');
      link.id = 'size-core-fonts';
      link.rel = 'stylesheet';
      link.href = "https://fonts.googleapis.com/css2?family=Red+Hat+Display:ital,wght@0,300..900;1,300..900";
      document.head.appendChild(link);
    }
  } catch (e) {
    // non-fatal if DOM not available
    log('Font injection skipped:', e && e.message);
  }
  
  // Apply different styles based on device type
  if (isMobile) {
    // Full-screen style for mobile and tablets
    Object.assign(shell.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      background: "#fff",
      zIndex: 100002,
      display: "flex",
      flexDirection: "column",
      opacity: 0,
      pointerEvents: "none",
      transform: "translateY(8px)",
      transition: "opacity .25s ease, transform .25s ease",
      fontFamily: config.FONT_FAMILY
    });
  } else {
    // Modal-style for desktop
    Object.assign(shell.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "90%",
      maxWidth: "800px",
      height: "90%",
      maxHeight: "700px",
      background: "#fff",
      zIndex: 100002,
      display: "flex",
      flexDirection: "column",
      opacity: 0,
      pointerEvents: "none",
      transform: "translate(-50%, -50%) scale(0.95)",
      transition: "opacity .25s ease, transform .25s ease",
      fontFamily: config.FONT_FAMILY,
      borderRadius: "12px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      overflow: "hidden"
    });
    
    // Create overlay for desktop
    const overlay = document.createElement("div");
    overlay.id = "size-core-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.5)",
      zIndex: 100001,
      opacity: 0,
      transition: "opacity .25s ease",
      pointerEvents: "none"
    });
    overlay.addEventListener("click", closeWidget);
    document.body.appendChild(overlay);
  }

  // Header (responsive & aesthetic)
  const header = document.createElement('div');
  header.setAttribute('role', 'banner');
  Object.assign(header.style, {
    padding: 'clamp(10px, 2.2vw, 16px) clamp(12px, 3vw, 20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '1px solid rgba(33,33,35,0.08)',
    background: '#212123',
    color: '#ffffff',
    boxSizing: 'border-box'
  });

  // Left: Title (single element)
  const titleSection = document.createElement('div');
  Object.assign(titleSection.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1 1 auto',
    minWidth: 0 // allow truncation
  });

  const title = document.createElement('div');
  title.textContent = 'Size Recommendations';
  Object.assign(title.style, {
    fontSize: 'clamp(15px, 2.2vw, 18px)',
    fontWeight: 700,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  });
  titleSection.appendChild(title);

  // Right: actions (close + powered-by)
  const actionsSection = document.createElement('div');
  Object.assign(actionsSection.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '0 0 auto'
  });

  // Close button (accessible)
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close size recommendation');
  closeBtn.innerHTML = '\u00d7'; // ×
  Object.assign(closeBtn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: 1,
    padding: 0,
    transition: 'background .15s ease, transform .08s ease'
  });
  closeBtn.addEventListener('click', closeWidget);
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.04)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'transparent');

  // Powered-by logo (render inside actions at the end) — order will be: title, spacer, powered-by, close
  let pbContainer = null;
  if (config.POWERED_BY_LOGO) {
    pbContainer = document.createElement('div');
    Object.assign(pbContainer.style, { display: 'flex', alignItems: 'center', height: '20px' });

    if (config.POWERED_BY_LOGO.includes('<svg') || config.POWERED_BY_LOGO.startsWith('data:image/svg+xml')) {
      import('./utils.js').then(({ createInlineSVG }) => {
        const svgEl = createInlineSVG(config.POWERED_BY_LOGO);
        if (svgEl) {
          const shapes = svgEl.querySelectorAll('path, circle, rect, text');
          shapes.forEach(s => s.setAttribute('fill', '#ffffff'));
          svgEl.setAttribute('height', '20px');
          svgEl.style.height = '20px';
          svgEl.style.width = 'auto';
          svgEl.setAttribute('aria-hidden', 'true');
          svgEl.setAttribute('width', 'auto');
          pbContainer.appendChild(svgEl);
        }
      });
    } else {
      const img = document.createElement('img');
      img.src = config.POWERED_BY_LOGO;
      img.alt = 'Powered by';
      Object.assign(img.style, { height: '20px', width: 'auto', filter: 'brightness(0) invert(1)' });
      pbContainer.appendChild(img);
    }
  }

  // Build header: title on the left, actions (powered-by + close) on the right
  header.appendChild(titleSection);
  // spacer to push actions to the end
  const spacer = document.createElement('div');
  Object.assign(spacer.style, { flex: '1 1 auto' });
  header.appendChild(spacer);
  if (pbContainer) actionsSection.appendChild(pbContainer);
  actionsSection.appendChild(closeBtn);
  header.appendChild(actionsSection);
  shell.appendChild(header);

  // Content wrapper
  const content = document.createElement("div");
  content.id = config.WIDGET_GREETING_ID;
  Object.assign(content.style, {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    padding: "28px 20px",
    gap: "24px",
    background: "#F2F2F8"
  });

  // Greeting UI
  const greet = document.createElement("div");
  greet.innerHTML = `<h2 style="margin:0 0 8px;font-size:22px;">Find Your Perfect Size</h2>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;max-width:480px;color:#444;">We'll guide you through a quick photo-based flow to recommend the best size for this product.</p>`;
  const startBtn = document.createElement("button");
  startBtn.textContent = "Let's Get Started";
  Object.assign(startBtn.style, {
    background: "#903316",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px 20px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
    alignSelf: "flex-start"
  });
  startBtn.addEventListener("click", () => {
    // Prevent multiple clicks if already connecting
    if (window.__sizeCoreConnecting) {
      log('Already connecting, ignoring additional clicks');
      return;
    }
    
    // Check if desktop view
    const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
    
    if (isDesktop) {
      // For desktop, use Socket.IO connection exclusively
      establishSocketConnection(shell);
    } else {
      // For mobile, continue with the existing iframe flow
      import('./iframe-communication.js').then(module => {
        if (module.clearMeasurementData) {
          module.clearMeasurementData();
        }
        loadFlowIframe(shell);
      });
    }
  });
  greet.appendChild(startBtn);
  content.appendChild(greet);
  shell.appendChild(content);

  document.body.appendChild(shell);
  return shell;
}

/**
 * Open the widget
 */
export function openWidget() {
  // If the widget was manually closed, don't auto-reopen
  // But allow explicit opening from a button click
  const wasExplicitlyOpened = window.__sizeCoreWidgetExplicitOpen;
  if (window.__sizeCoreWidgetManuallyClosed && !wasExplicitlyOpened) {
    log('Widget was manually closed - preventing auto-reopen');
    return;
  }
  
  // Reset the explicit open flag
  window.__sizeCoreWidgetExplicitOpen = false;
  
  const shell = ensureWidgetShell();
  
  // Check if we have stored results to display
  const iframeData = getIframeData();
  const hasSallaResults = (iframeData && iframeData.sallaResults) || (window.__sizeCoreHasResults === true);
  
  // Check if we're on a desktop device
  const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
  
  // Show overlay for desktop
  if (isDesktop) {
    const overlay = document.getElementById("size-core-overlay");
    if (overlay) {
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
    }
  }
  
  if (hasSallaResults) {
    // Show stored results if available
    import('./widget-salla-handlers.js').then(module => {
      // Show the shell first with appropriate transform for the device type
      shell.style.pointerEvents = "auto";
      shell.style.opacity = "1";
      
      if (isDesktop) {
        shell.style.transform = "translate(-50%, -50%) scale(1)";
      } else {
        shell.style.transform = "translateY(0)";
      }
      
      // Then populate with the last results
      setTimeout(() => {
        try {
          // Prefer live iframeData.sallaResults (from iframe flow)
          if (iframeData && iframeData.sallaResults) {
            module.showSallaRecommendation(iframeData.sallaResults, true);
            return;
          }

          // Otherwise attempt to load persisted desktop results from localStorage
          if (window.__sizeCoreHasResults) {
            try {
              const stored = localStorage.getItem('size-core-data');
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.sallaResults) {
                  module.showSallaRecommendation(parsed.sallaResults, true);
                  return;
                }
              }
            } catch (e) { console.warn('Failed to parse persisted size-core-data', e); }
          }

          // Fallback - if nothing found, show empty state
          showEmptyState(shell);
        } catch (e) {
          console.error('Error restoring stored results on open:', e);
          showEmptyState(shell);
        }
      }, 300);
    });
  } else {
    // Check if we're already connecting to avoid showing empty state during connection
    if (window.__sizeCoreConnecting) {
      // Just show the shell but don't override the connecting UI
      requestAnimationFrame(() => {
        shell.style.pointerEvents = "auto";
        shell.style.opacity = "1";
        
        if (isDesktop) {
          shell.style.transform = "translate(-50%, -50%) scale(1)";
        } else {
          shell.style.transform = "translateY(0)";
        }
      });
    } else {
      // Show the empty state filler
      requestAnimationFrame(() => {
        shell.style.pointerEvents = "auto";
        shell.style.opacity = "1";
        
        if (isDesktop) {
          shell.style.transform = "translate(-50%, -50%) scale(1)";
        } else {
          shell.style.transform = "translateY(0)";
        }
        
        // Show the empty state after the animation completes, but only if there's no iframe, not connecting, and no stored results
        setTimeout(() => {
          // Check for connecting state to avoid showing empty state during connection
          if (window.__sizeCoreConnecting) {
            log('Widget is in connecting state, not showing empty state');
            return;
          }

          // If desktop results were set, skip showing empty state to avoid clobbering the results UI
          if (window.__sizeCoreHasResults) {
            log('Desktop results present, skipping empty state');
            return;
          }
          
          // Double check that no iframe has been created in the meantime
          if (!document.getElementById(config.WIDGET_IFRAME_ID)) {
            log('No iframe found, showing empty state');
            showEmptyState(shell);
          } else {
            log('Iframe found, not showing empty state');
          }
        }, 300);
      });
    }
  }
  
  trackClick("widget_open");
}

/**
 * Close the widget
 */
export function closeWidget() {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) return;
  
  log('Closing widget');
  
  // Set a flag to prevent auto-reopening
  window.__sizeCoreWidgetManuallyClosed = true;
  
  // Check if we're on a desktop device
  const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
  
  // Hide overlay for desktop
  if (isDesktop) {
    const overlay = document.getElementById("size-core-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
  }
  
  // Apply closing styles based on device type
  shell.style.opacity = "0";
  shell.style.pointerEvents = "none";
  
  if (isDesktop) {
    shell.style.transform = "translate(-50%, -50%) scale(0.95)";
  } else {
    shell.style.transform = "translateY(8px)";
  }
  
  // Track the event
  trackClick("widget_closed");
  
  // Clear any desktop-result flag so reopening doesn't immediately show stale data
  try { window.__sizeCoreHasResults = false; } catch (e) {}

  setTimeout(() => {
    // Clear any iframe to prevent communication issues
    const iframe = document.getElementById(config.WIDGET_IFRAME_ID);
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
      
      // Restore the greeting UI
      const shell = document.getElementById(config.WIDGET_ID);
      if (shell) {
        const content = shell.querySelector(`#${config.WIDGET_GREETING_ID}`);
        if (content && content.innerHTML === "") {
          // Import and use the widget-status to recreate the greeting
          import('./widget-status.js').then(module => {
            module.showSallaStatus(shell);
          });
        }
      }
    }
  }, 300);
}

/**
 * Request camera permission on behalf of the iframe
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function requestCameraPermission() {
  try {
    // Try to get access to the camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    // If successful, immediately release the camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      return true;
    }
    
    return false;
  } catch (error) {
    log('Camera permission error:', error.message);
    return false;
  }
}

/**
 * Establishes Socket.IO connection for desktop views
 * @param {HTMLElement} shell - The widget shell element
 */
function establishSocketConnection(shell) {
  // Set connecting flag
  window.__sizeCoreConnecting = true;
  
  console.log('establishSocketConnection called - attempting to establish Socket.IO connection');
  
  // Import necessary modules
  import('./widget-connect.js').then(({ showConnectingUI }) => {
    // Show connecting UI
    showConnectingUI();
    console.log('Connecting UI shown, proceeding with Socket.IO import');
    
    // For debugging - log details about the Socket.IO URL
    console.log('Socket.IO URL config:', {
      url: config.WS_URL,
      path: config.SOCKET_PATH
    });
    
    // Import Socket.IO client dynamically with robust shape handling and CDN fallback
    import('socket.io-client')
      .then((ioModule) => {
        console.log('Socket.IO client import result shape:', ioModule);
        // Support various import shapes: default, named "io", or module itself
        const ioClient = ioModule && (ioModule.default || ioModule.io || ioModule);
        if (!ioClient) {
          console.error('Socket.IO import did not provide a usable client:', ioModule);
          throw new Error('no-io-client');
        }

        return { getClient: () => ioClient };
      })
      .catch((importErr) => {
        console.warn('Dynamic import of socket.io-client failed:', importErr);
        // Try CDN fallback by injecting the socket.io client script
        return new Promise((resolve, reject) => {
          try {
            // If global io already exists, use it
            if (typeof window !== 'undefined' && window.io) {
              console.log('Found global io already present');
              return resolve({ getClient: () => window.io });
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
            script.async = true;
            script.onload = function() {
              if (window.io) {
                console.log('Socket.IO client loaded from CDN and global io is available');
                resolve({ getClient: () => window.io });
              } else {
                reject(new Error('CDN loaded but global io not found'));
              }
            };
            script.onerror = function(ev) {
              reject(new Error('Failed to load Socket.IO client from CDN'));
            };
            document.head.appendChild(script);
          } catch (err) {
            reject(err);
          }
        });
      })
      .then(({ getClient }) => {
        const ioClient = getClient();
        console.log('Resolved Socket.IO client to:', typeof ioClient === 'function' ? 'function' : typeof ioClient);

        try {
          console.log('Attempting Socket.IO connection to:', config.WS_URL, 'path:', config.SOCKET_PATH);

          // Initialize Socket.IO connection
          const socket = ioClient(config.WS_URL, {
            path: config.SOCKET_PATH,
            transports: ['websocket'],
            reconnectionAttempts: 3,
            timeout: 5000,
            forceNew: true,
            autoConnect: true,
            // Include storeId in the initial handshake auth so the server can
            // access the store context during connection (optional/null-safe)
            auth: {
              storeId: config.STORE_ID || null
            }
          });

          console.log('Socket.IO instance created, waiting for connect event');

          // Connection event
          socket.on('connect', () => {
            console.log('Socket.IO connection established, socket id:', socket.id);
            
            // Send initial connection message
            const connectPayload = {
              clientId: genUUID(),
              timestamp: Date.now(),
              // Include storeId in the initial connect payload as well
              storeId: config.STORE_ID || null,
              // Include any product info if available
              productId: resolveProductId()
            };
            
            console.log('Sending connect_client event with payload:', connectPayload);
            socket.emit('connect_client', connectPayload);
            
            // Immediately request session creation on the backend
            try {
              const createPayload = {
                message: {
                  type: 'create',
                  data: {
                    // include store and mode; backend will fetch API key
                    storeId: config.STORE_ID || null,
                    mode: 'dual',
                    expiresInMinutes: 10,
                    apiKeyType: 'production',
                    productId: resolveProductId()
                  }
                }
              };

              console.log('Emitting create session message to server:', createPayload);
              socket.emit('message', createPayload);
            } catch (e) {
              console.error('Failed to emit create session message:', e);
            }
          });
          
          // Log all events for debugging
          socket.onAny((event, ...args) => {
            console.log(`Socket.IO received event "${event}":`, args);
          });
          
          // Custom events for receiving measurements directly
          socket.on('size_recommendation', (data) => {
            console.log('Socket.IO size recommendation received:', data);
            
            // Handle size recommendation
            import('./widget-salla-handlers.js').then(module => {
              module.showSallaRecommendation(data);
            });
            
            // Disconnect socket as we're done
            socket.disconnect();
          });

          // Handle session created and errors from backend
          socket.on('sessionCreated', (payload) => {
            console.log('sessionCreated received from server:', payload);
            try {
              // Normalize payload shape. Server may send { message, sessionId, mode }
              const body = payload && payload.data ? payload.data : payload;
              const message = body.message || body.msg || body.messageText || null;
              const sessionId = body.sessionId || body.session_id || (body.data && body.data.sessionId) || null;
              const mode = body.mode || null;

              // Prefer a dedicated session UI display
              import('./widget-status.js').then(module => {
                if (module && module.showSessionCreated) {
                  module.showSessionCreated({ message, sessionId, mode });
                } else if (module && module.showSallaStatus) {
                  // Fallback to generic status
                  module.showSallaStatus(body);
                }
              });
            } catch (e) {
              console.error('Error handling sessionCreated:', e);
            }
          });

          // When a mobile client has joined the session (backend emits mobileJoined)
          socket.on('mobileJoined', (payload) => {
            try {
              console.log('mobileJoined event received:', payload);
              const sessionId = payload && (payload.sessionId || payload.session_id || payload.data?.sessionId) || null;
              const mobileId = payload && (payload.mobileId || payload.mobile_id || payload.data?.mobileId) || null;

              // Show a waiting-for-measurements UI
              import('./widget-status.js').then(module => {
                if (module && module.showWaitingForMeasurements) {
                  module.showWaitingForMeasurements({ sessionId, mobileId });
                }
              });
            } catch (e) {
              console.error('Error handling mobileJoined event:', e);
            }
          });

          // // Generic message handler - some servers emit a 'message' event with nested message.type (e.g. 'END')
          // socket.on('message', (payload) => {
          //   try {
          //     console.log('[Generic Handler] :: socket message event received:', payload);

          //     // Support many possible shapes where results may live
          //     const possibleResults = (
          //       (payload && payload.payload && payload.payload.results) ||
          //       (payload && payload.data && payload.data.results) ||
          //       (payload && payload.results) ||
          //       (payload && payload.message && payload.message.data && payload.message.data.results) ||
          //       (payload && payload.message && payload.message.results) ||
          //       null
          //     );

          //     const possibleUserData = (
          //       (payload && payload.payload && payload.payload.userData) ||
          //       (payload && payload.data && payload.data.userData) ||
          //       (payload && payload.userData) ||
          //       (payload && payload.message && payload.message.data && payload.message.data.userData) ||
          //       null
          //     );

          //     // If we have result measurements, prepare normalized object for UI
          //     if (possibleResults) {
          //       const normalized = {
          //         results: possibleResults,
          //         userData: possibleUserData,
          //         request_id: (
          //           (payload && payload.payload && payload.payload.results && payload.payload.results.request_id) ||
          //           (payload && payload.data && payload.data.results && payload.data.results.request_id) ||
          //           (payload && payload.results && payload.results.request_id) ||
          //           null
          //         ),
          //         key_type: (
          //           (payload && payload.payload && payload.payload.results && payload.payload.results.key_type) ||
          //           (payload && payload.data && payload.data.results && payload.data.results.key_type) ||
          //           (payload && payload.results && payload.results.key_type) ||
          //           null
          //         )
          //       };

          //       console.log('Normalized END payload for UI:', normalized);

          //       // Clear any waiting placeholder UI before rendering
          //       try {
          //         const shell = document.getElementById(config.WIDGET_ID);
          //         if (shell) {
          //           const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
          //           if (container) container.innerHTML = '';
          //         }
          //       } catch (e) { /* ignore */ }

          //       // Render the recommendation UI, persist results, then disconnect
          //       import('./widget-salla-handlers.js').then(module => {
          //         if (module && module.showSallaRecommendation) {
          //           try {
          //             console.log('Calling showSallaRecommendation with normalized payload');
          //             module.showSallaRecommendation(normalized);
          //             console.log('showSallaRecommendation import and call completed');

          //             // Persist results similar to iframe flow
          //             try {
          //               const store = { sallaResults: normalized, measurements: normalized.results && normalized.results.measurements ? normalized.results.measurements : null, keyType: normalized.key_type };
          //               localStorage.setItem('size-core-data', JSON.stringify(store));
          //               try { window.__sizeCoreHasResults = true; } catch (e) {}
          //               console.log('Desktop results persisted to localStorage');
          //             } catch (e) {
          //               console.warn('Failed to persist salla results from desktop flow', e);
          //             }

          //           } catch (e) {
          //             console.error('Error calling showSallaRecommendation:', e);
          //           }
          //         } else {
          //           console.warn('widget-salla-handlers module or showSallaRecommendation not available');
          //         }

          //         try { window.__sizeCoreConnecting = false; } catch (e) {}
          //         try { socket.disconnect(); } catch (e) {}
          //       }).catch(err => {
          //         console.error('Failed to import salla handlers for END message', err);
          //       });
          //     }
          //   } catch (e) {
          //     console.error('Error handling socket message event:', e);
          //   }
          // });

          // Listen for sessionEnded event and log payload for now
          socket.on('sessionEnded', (payload) => {
            try {
              console.log('sessionEnded event received from server:', payload);

              // payload may be { sessionId, payload: { results, userData } }
              const nested = payload && (payload.payload || payload.data) ? (payload.payload || payload.data) : payload;
              const possibleResults = nested && (nested.results || (nested.results && nested.results.measurements) ? nested.results : null);
              const possibleUserData = nested && nested.userData ? nested.userData : (nested && nested.user_data ? nested.user_data : null);

              if (possibleResults) {
                const normalized = {
                  results: possibleResults,
                  userData: possibleUserData || null,
                  request_id: (possibleResults && possibleResults.request_id) || nested.request_id || null,
                  key_type: (possibleResults && possibleResults.key_type) || nested.key_type || null
                };

                // Clear waiting UI
                try {
                  const shell = document.getElementById(config.WIDGET_ID);
                  if (shell) {
                    const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
                    if (container) container.innerHTML = '';
                  }
                } catch (e) { /* ignore */ }

                import('./widget-salla-handlers.js').then(module => {
                  if (module && module.showSallaRecommendation) {
                    module.showSallaRecommendation(normalized);
                  }
                }).catch(err => {
                  console.error('Failed to import handler for sessionEnded', err);
                });

                try { window.__sizeCoreConnecting = false; } catch (e) {}
                try { socket.disconnect(); } catch (e) {}
                // Persist results similar to iframe flow
                try {
                  const store = { sallaResults: normalized, measurements: normalized.results && normalized.results.measurements ? normalized.results.measurements : null, keyType: normalized.key_type };
                  localStorage.setItem('size-core-data', JSON.stringify(store));
                  try { window.__sizeCoreHasResults = true; } catch (e) {}
                  console.log('Desktop results persisted to localStorage (sessionEnded)');
                } catch (e) { console.warn('Failed to persist sessionEnded results', e); }
              } else {
                console.log('sessionEnded received but no results found in payload');
              }
            } catch (e) {
              console.error('Error handling sessionEnded payload:', e);
            }
          });

          socket.on('sessionError', (payload) => {
            console.error('sessionError received from server:', payload);
            try {
              import('./widget-salla-handlers.js').then(module => {
                if (module && module.showSallaError) {
                  module.showSallaError({ message: payload?.data?.error || payload?.data || payload });
                }
              });
            } catch (e) {
              console.error('Error handling sessionError:', e);
            }
          });
          
          // Error handling
          socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            window.__sizeCoreConnecting = false;
            
            // Show error message to user
            showConnectionError('Unable to connect to measurement service: ' + error.message);
            
            socket.disconnect();
          });
          
          socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
            window.__sizeCoreConnecting = false;
            
            // Show error message to user
            showConnectionError('Socket error: ' + (error.message || 'Unknown error'));
            
            socket.disconnect();
          });
          
          socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected, reason:', reason);
            window.__sizeCoreConnecting = false;
          });
          
          // Set timeout for Socket.IO connection
          setTimeout(() => {
            if (!socket.connected) {
              console.warn('Socket.IO connection timeout');
              window.__sizeCoreConnecting = false;
              
              // Show error message to user
              showConnectionError('Connection timeout. Please check your network and try again.');
              
              socket.disconnect();
            }
          }, 10000); // 10 second timeout
          
        } catch (error) {
          console.error('Error establishing Socket.IO connection:', error);
          window.__sizeCoreConnecting = false;
          showConnectionError('An error occurred while connecting: ' + error.message);
        }
      })
      .catch(error => {
        console.error('Error importing Socket.IO client:', error);
        window.__sizeCoreConnecting = false;
        showConnectionError('Failed to load Socket.IO client: ' + error.message);
      });
  });
}

/**
 * Helper function to show connection errors
 */
function showConnectionError(message) {
  console.error('Socket.IO connection error:', message);
  
  import('./widget-salla-handlers.js').then(module => {
    if (module.showSallaError) {
      module.showSallaError({
        message: message || "Connection error. Please try again later."
      });
    }
  });
}

/**
 * Load the flow iframe
 */
export function loadFlowIframe(shell) {
  // If already loaded, nothing
  if (document.getElementById(config.WIDGET_IFRAME_ID)) return;
  
  // Reset the manual close flag as this is an explicit user action
  window.__sizeCoreWidgetManuallyClosed = false;
  
  // Set a flag to prevent empty state from showing while connecting
  window.__sizeCoreConnecting = true;
  
  // Show connecting UI first and complete the iframe loading within that context
  import('./widget-connect.js').then(({ showConnectingUI }) => {
    // Show connecting UI
    showConnectingUI();
    
    // Proceed with iframe creation after a short delay to ensure connecting UI is visible
    setTimeout(() => {
      // Double check if iframe was created in the meantime
      if (document.getElementById(config.WIDGET_IFRAME_ID)) {
        log('Iframe already exists, not creating a new one');
        window.__sizeCoreConnecting = false;
        return;
      }
      
      // Request camera permissions from the parent page
      requestCameraPermission().then(permissionGranted => {
        // Double check again if iframe was created in the meantime
        if (document.getElementById(config.WIDGET_IFRAME_ID)) {
          log('Iframe already exists after camera permission, not creating a new one');
          window.__sizeCoreConnecting = false;
          return;
        }
        
        const pid = resolveProductId();
        const sessionId = genUUID();
        try { localStorage.setItem("size-core-session", sessionId); } catch {}
        const flowURL = new URL(config.EXTERNAL_FLOW_BASE);
        flowURL.searchParams.set("session_id", sessionId);
        if (pid) flowURL.searchParams.set("product_id", pid);
        flowURL.searchParams.set("embed", "1");
        
        // Add camera permission status to let the iframe know if permission was already granted
        flowURL.searchParams.set("camera_permission", permissionGranted ? "granted" : "denied");
        
        // Add store ID to the URL if available
        if (config.STORE_ID) {
          flowURL.searchParams.set("store", config.STORE_ID); // Changed from storeId to store to match the URL format
        }
        
        // Add key_type if available from Salla connected message
        const iframeData = getIframeData();
        if (iframeData && iframeData.keyType) {
          flowURL.searchParams.set("key_type", iframeData.keyType);
        }

        log('Creating iframe with URL:', flowURL.toString());
        
        const frame = document.createElement("iframe");
        frame.id = config.WIDGET_IFRAME_ID;
        frame.src = flowURL.toString();
        
        // Add allow attribute for camera access
        frame.allow = "camera; microphone";
        
        // Check if we're on a desktop device
        const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
        
        Object.assign(frame.style, {
          border: "none",
          flex: 1,
          background: "#fff",
          width: "100%",
          height: isDesktop ? "100%" : "calc(100% - 8px)",
          margin: 0,
          padding: 0
        });
        
        // Replace content with iframe - make sure we're getting the current container
        const content = document.getElementById(config.WIDGET_GREETING_ID) || shell.querySelector(`#${config.WIDGET_GREETING_ID}`);
        if (content) {
          content.innerHTML = ""; // clear
          content.appendChild(frame);
        } else {
          shell.appendChild(frame);
        }

        // Set up message listener to receive data from the iframe
        setupIframeMessageListener(frame);
        
        // Add iframe load event listener to reset connecting flag
        frame.addEventListener('load', () => {
          window.__sizeCoreConnecting = false;
          log('Iframe loaded successfully');
        });
        
        // Safety fallback: clear connecting flag after timeout in case load event doesn't fire
        setTimeout(() => {
          window.__sizeCoreConnecting = false;
        }, 10000); // 10 second safety timeout
        
        trackClick("flow_loaded");
      });
    }, 500); // Delay to ensure connecting UI is visible before iframe loads
  });
}

/**
 * Handle iframe message events
 */
export function handleIframeMessage(ev) {
  try {
    // Handle Salla messages (accept from any origin)
    if (ev.data && ev.data.type) {
      const data = ev.data;
      
      switch (data.type) {
        case 'SALLA_CONNECTED':
          log("Received SALLA_CONNECTED message from:", ev.origin);
          // Store the data and show a message in the widget
          if (data.storeId) {
            log("Salla Connected - Store ID:", data.storeId, "Environment:", data.key_type);
            
            // Import the status function dynamically to avoid circular dependencies
            import('./widget-status.js').then(module => {
              module.showSallaStatus(data);
            });
          }
          return;
          
        case 'SALLA_RESULTS':
          log("Received SALLA_RESULTS message from:", ev.origin);
          // Show results in the widget
          if (data.results && data.results.recommendedSize) {
            // Import the handler dynamically to avoid circular dependencies
            import('./widget-salla-handlers.js').then(module => {
              module.showSallaRecommendation(data);
            });
          }
          return;
          
        case 'SALLA_ERROR':
          log("Received SALLA_ERROR message from:", ev.origin);
          // Show error in the widget
          if (data.message) {
            // Import the handler dynamically to avoid circular dependencies
            import('./widget-salla-handlers.js').then(module => {
              module.showSallaError(data);
            });
          }
          return;
      }
    }
    
    // For other messages, enforce origin if configured
    if (FLOW_ORIGIN && ev.origin !== FLOW_ORIGIN) return; // enforce origin
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.source !== "miqyas" && data.source !== "size-core-flow") return; // expected marker
    log("Msg from iframe", data);
    switch (data.type) {
      case "size_recommendation":
        if (data.payload && data.payload.size) {
          showInlineRecommendation(data.payload);
          trackClick("recommendation_received");
        }
        break;
      case "flow_error":
        if (data.error) showInlineError(data.error);
        break;
      case "close_widget":
        closeWidget();
        break;
      case "request_camera_permission":
        // Handle camera permission request from iframe
        requestCameraPermission().then(granted => {
          // Send the result back to the iframe
          const iframe = document.getElementById(config.WIDGET_IFRAME_ID);
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              source: "size-core-parent",
              type: "camera_permission_result",
              granted: granted
            }, FLOW_ORIGIN || "*");
          }
        });
        break;
      default:
        break;
    }
  } catch (e) { log("iframe msg error", e); }
}

/**
 * Show recommendation inside the widget
 */
export function showInlineRecommendation(payload) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) return;
  // Remove iframe (optional keep?)
  const iframe = document.getElementById(config.WIDGET_IFRAME_ID);
  if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);

  const resultWrap = document.createElement("div");
  Object.assign(resultWrap.style, {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    textAlign: "center",
    animation: "sr-fade-in .35s ease"
  });
  resultWrap.innerHTML = `
    <div style="font-size:15px;color:#666;margin-bottom:8px;">Recommended Size</div>
    <div style="font-size:48px;font-weight:700;letter-spacing:1px;color:#222;margin-bottom:16px;">${escapeHTML(String(payload.size))}</div>
    ${payload.confidence ? `<div style=\"font-size:13px;color:#555;margin-bottom:24px;\">Confidence: ${(payload.confidence*100).toFixed(0)}%</div>` : ""}
    <button id="size-core-close-after" style="background:#222;color:#fff;border:0;border-radius:8px;padding:14px 22px;font-size:15px;font-weight:600;cursor:pointer;">Close</button>
  `;
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  container.innerHTML = "";
  container.appendChild(resultWrap);
  const btnClose = container.querySelector("#size-core-close-after");
  if (btnClose) btnClose.addEventListener("click", closeWidget);
}


