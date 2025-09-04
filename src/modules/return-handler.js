import { resolveProductId } from './product-detection.js';
import { parseParams, escapeHTML } from './utils.js';
import { config } from './config.js';

/**
 * Handle user return with query parameter recommendation
 */
export function handleReturn() {
  const params = parseParams();
  const size = params.get("rec_size");
  const recId = params.get("rec_id") || params.get("session_id");
  if (!size || !recId) return;
  if (document.getElementById("size-core-result")) return;
  const banner = document.createElement("div");
  banner.id = "size-core-result";
  banner.textContent = `Recommended size: ${size}`;
  Object.assign(banner.style, {
    position: "fixed",
    top: "80px",
    right: "16px",
    background: "#28a745",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "6px",
    zIndex: 100000,
    fontFamily: "system-ui,sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  });
  document.body.appendChild(banner);
  fetch(config.TRACK_RETURN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: recId,
      recommended_size: size,
      product_url: window.location.href,
      product_id: resolveProductId() || null,
      store_id: config.STORE_ID || null,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
