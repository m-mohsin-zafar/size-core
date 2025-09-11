import { config, FLOW_ORIGIN } from './config.js';
import { escapeHTML, log, genUUID } from './utils.js';
import { resolveProductId } from './product-detection.js';
import { trackClick } from './size-guides.js';
import { setupIframeMessageListener, sendMessageToIframe, getIframeData } from './iframe-communication.js';

// Import Salla-specific handlers
export { showSallaRecommendation, showSallaError } from './widget-salla-handlers.js';
export { showSallaStatus } from './widget-status.js';

/**
 * Create the shell for the widget
 */
export function ensureWidgetShell() {
  let shell = document.getElementById(config.WIDGET_ID);
  if (shell) return shell;
  shell = document.createElement("div");
  shell.id = config.WIDGET_ID;
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
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
    fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #eee"
  });
  const title = document.createElement("div");
  title.textContent = "Size Recommendation";
  Object.assign(title.style, { fontWeight: 600, fontSize: "15px" });
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.innerHTML = "&times;";
  Object.assign(closeBtn.style, {
    background: "transparent",
    border: "none",
    fontSize: "26px",
    lineHeight: 1,
    cursor: "pointer",
    color: "#666",
    padding: "0 4px"
  });
  closeBtn.addEventListener("click", closeWidget);
  header.appendChild(title);
  header.appendChild(closeBtn);
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
    background: "linear-gradient(135deg,#fdfbfb 0%,#ebedee 100%)"
  });

  // Greeting UI
  const greet = document.createElement("div");
  greet.innerHTML = `<h2 style="margin:0 0 8px;font-size:22px;">Find Your Perfect Size</h2>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;max-width:480px;color:#444;">We'll guide you through a quick photo-based flow to recommend the best size for this product.</p>`;
  const startBtn = document.createElement("button");
  startBtn.textContent = "Start Guided Photos";
  Object.assign(startBtn.style, {
    background: "#ff6f61",
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
    // Import and use clearMeasurementData to ensure a fresh start
    import('./iframe-communication.js').then(module => {
      if (module.clearMeasurementData) {
        module.clearMeasurementData();
      }
      loadFlowIframe(shell);
    });
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
  const hasSallaResults = iframeData && iframeData.sallaResults;
  
  if (hasSallaResults) {
    // Show stored results if available
    import('./widget-salla-handlers.js').then(module => {
      // Show the shell first
      shell.style.pointerEvents = "auto";
      shell.style.opacity = "1";
      shell.style.transform = "translateY(0)";
      
      // Then populate with the last results
      setTimeout(() => module.showSallaRecommendation(iframeData.sallaResults, true), 300);
    });
  } else {
    // Just show the shell with the default greeting
    requestAnimationFrame(() => {
      shell.style.pointerEvents = "auto";
      shell.style.opacity = "1";
      shell.style.transform = "translateY(0)";
    });
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
  
  // Apply closing styles
  shell.style.opacity = "0";
  shell.style.pointerEvents = "none";
  shell.style.transform = "translateY(8px)";
  
  // Track the event
  trackClick("widget_closed");
  
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
 * Load the flow iframe
 */
export function loadFlowIframe(shell) {
  // If already loaded, nothing
  if (document.getElementById(config.WIDGET_IFRAME_ID)) return;
  
  // Reset the manual close flag as this is an explicit user action
  window.__sizeCoreWidgetManuallyClosed = false;
  
  // Import the showConnectingUI function and display connecting UI
  import('./widget-connect.js').then(({ showConnectingUI }) => {
    showConnectingUI();
  });
  
  // First request camera permissions from the parent page
  requestCameraPermission().then(permissionGranted => {
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

    console.log(flowURL.toString());
    
    const frame = document.createElement("iframe");
    frame.id = config.WIDGET_IFRAME_ID;
    frame.src = flowURL.toString();
    
    // Add allow attribute for camera access
    frame.allow = "camera; microphone";
    
    Object.assign(frame.style, {
      border: "1px solid #e0e0e0",
      maxHeight: "80vh",
      flex: 1,
      background: "#fff",
      borderRadius: "8px",
      margin: "4px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
    });
    
    // Replace greeting content with iframe
    const content = document.getElementById(config.WIDGET_GREETING_ID);
    if (content) {
      content.innerHTML = ""; // clear
      content.appendChild(frame);
    } else {
      shell.appendChild(frame);
    }

    // Set up message listener to receive data from the iframe
    setupIframeMessageListener(frame);
    
    trackClick("flow_loaded");
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


