import { config, FLOW_ORIGIN } from './config.js';
import { escapeHTML, log, genUUID } from './utils.js';
import { resolveProductId } from './product-detection.js';
import { trackClick } from './size-guides.js';

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
    overflow: "hidden",
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
  startBtn.addEventListener("click", () => loadFlowIframe(shell));
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
  const shell = ensureWidgetShell();
  requestAnimationFrame(() => {
    shell.style.pointerEvents = "auto";
    shell.style.opacity = "1";
    shell.style.transform = "translateY(0)";
  });
  trackClick("widget_open");
}

/**
 * Close the widget
 */
export function closeWidget() {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) return;
  shell.style.opacity = "0";
  shell.style.pointerEvents = "none";
  shell.style.transform = "translateY(8px)";
  setTimeout(() => {
    // optional: keep in DOM for re-open
  }, 300);
}

/**
 * Load the flow iframe
 */
export function loadFlowIframe(shell) {
  // If already loaded, nothing
  if (document.getElementById(config.WIDGET_IFRAME_ID)) return;
  const pid = resolveProductId();
  const sessionId = genUUID();
  try { localStorage.setItem("size-core-session", sessionId); } catch {}
  const flowURL = new URL(config.EXTERNAL_FLOW_BASE);
  flowURL.searchParams.set("session_id", sessionId);
  if (pid) flowURL.searchParams.set("product_id", pid);
  flowURL.searchParams.set("embed", "1");
  
  // Add store ID to the URL if available
  if (config.STORE_ID) {
    flowURL.searchParams.set("store_id", config.STORE_ID);
  }
  
  const frame = document.createElement("iframe");
  frame.id = config.WIDGET_IFRAME_ID;
  frame.src = flowURL.toString();
  Object.assign(frame.style, {
    border: "0 none",
    width: "100%",
    height: "100%",
    flex: 1,
    background: "#fff",
    borderRadius: "0"
  });
  // Replace greeting content with iframe
  const content = document.getElementById(config.WIDGET_GREETING_ID);
  if (content) {
    content.innerHTML = ""; // clear
    content.appendChild(frame);
  } else {
    shell.appendChild(frame);
  }
  trackClick("flow_loaded");
}

/**
 * Handle iframe message events
 */
export function handleIframeMessage(ev) {
  try {
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

/**
 * Show error message inside the widget
 */
export function showInlineError(message) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) return;
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  container.innerHTML = `<div style="padding:40px 24px;text-align:center;">
    <h3 style="margin:0 0 12px;font-size:20px;">Something went wrong</h3>
    <p style="margin:0 0 24px;color:#555;">${escapeHTML(String(message))}</p>
    <button id="size-core-retry" style="background:#ff6f61;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;">Retry</button>
    <button id="size-core-close-error" style="margin-left:12px;background:#ddd;color:#222;border:0;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;">Close</button>
  </div>`;
  const retry = container.querySelector('#size-core-retry');
  if (retry) retry.addEventListener('click', () => loadFlowIframe(shell));
  const closeBtn = container.querySelector('#size-core-close-error');
  if (closeBtn) closeBtn.addEventListener('click', closeWidget);
}
