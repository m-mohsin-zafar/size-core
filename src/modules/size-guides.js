import { resolveProductId, isProductPage } from './product-detection.js';
import { log, genUUID } from './utils.js';
import { config, FLOW_ORIGIN, DEBUG } from './config.js';

/**
 * Check if the Twilight SDK is available
 */
export function hasTwilightSDK() {
  return !!(window.twilight && window.twilight.product && typeof window.twilight.product.getSizeGuides === "function");
}

/**
 * Probe for size guides via the Twilight SDK
 */
export async function probeSizeGuides(productId) {
  const result = { ok: false, count: 0, error: null };
  if (!productId) { result.error = "no_product_id"; return result; }
  if (!hasTwilightSDK()) { result.error = "no_sdk"; return result; }
  try {
    const res = await window.twilight.product.getSizeGuides({ product_id: productId });
    const arr = res && res.data ? res.data : [];
    result.ok = Array.isArray(arr) && arr.length > 0;
    result.count = Array.isArray(arr) ? arr.length : 0;
    return result;
  } catch (e) {
    result.error = (e && e.message) || "sdk_error";
    return result;
  }
}

/**
 * Check if native size guide component exists
 */
export function hasNativeSizeGuideComponent() {
  return !!document.querySelector("salla-product-size-guide");
}

/**
 * Open the native size guide component
 */
export function ensureAndOpenNativeGuide(productId) {
  let el = document.querySelector("salla-product-size-guide");
  if (!el) {
    el = document.createElement("salla-product-size-guide");
    // optional: el.setAttribute('mode','modal');
    document.body.appendChild(el);
  }
  if (typeof el.open === "function") {
    try { el.open(productId); } catch {}
    return true;
  }
  return false;
}

/**
 * Debug state for size guide components
 */
export const _debugState = {
  isPDP: false,
  productId: null,
  sdk: false,
  sizeGuides: { ok: false, count: 0, error: null },
  nativeComp: false,
};

/**
 * Update debug state with current conditions
 */
export async function refreshDebugState() {
  _debugState.isPDP = isProductPage();
  _debugState.productId = resolveProductId();
  _debugState.sdk = hasTwilightSDK();
  _debugState.nativeComp = hasNativeSizeGuideComponent();

  if (_debugState.isPDP && _debugState.productId && _debugState.sdk) {
    _debugState.sizeGuides = await probeSizeGuides(_debugState.productId);
  } else {
    _debugState.sizeGuides = { ok: false, count: 0, error: _debugState.productId ? "no_sdk_or_not_pdp" : "no_product_id" };
  }
}

/**
 * Create or update debug overlay
 */
export async function renderDebugOverlay() {
  if (!DEBUG) return;
  await refreshDebugState();

  let overlay = document.getElementById("size-core-debug-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "size-core-debug-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "5px",
      left: "5px",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      zIndex: 100001,
      lineHeight: "1.25",
      fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
      maxWidth: "320px",
    });
    document.body.appendChild(overlay);
  }

  const rows = [
    ["PDP", _debugState.isPDP ? "✅" : "❌"],
    ["Product ID", _debugState.productId ? `✅ ${_debugState.productId}` : "❌"],
    ["Store ID", config.STORE_ID ? `✅ ${config.STORE_ID}` : "❌"],
    ["Twilight SDK", _debugState.sdk ? "✅" : "❌"],
    ["Native <salla-product-size-guide>", _debugState.nativeComp ? "✅" : "❌"],
    ["Size Guides (SDK)", _debugState.sizeGuides.ok ? `✅ (${_debugState.sizeGuides.count})` : `❌${_debugState.sizeGuides.error ? " — " + _debugState.sizeGuides.error : ""}`],
  ];

  overlay.innerHTML =
    `<strong>SizeCore Debug</strong><br>` +
    rows.map(([k, v]) => `${k}: ${v}`).join("<br>") +
    `<div style="margin-top:6px;display:flex;gap:6px;">
       <button id="sr-open-native" style="padding:4px 6px;border-radius:4px;border:0;cursor:pointer;">Open Native Guide</button>
       <button id="sr-open-sdk" style="padding:4px 6px;border-radius:4px;border:0;cursor:pointer;">Probe SDK</button>
     </div>`;

  // Wire buttons
  const btnNative = document.getElementById("sr-open-native");
  const btnSDK = document.getElementById("sr-open-sdk");
  if (btnNative) {
    btnNative.onclick = () => {
      const ok = ensureAndOpenNativeGuide(_debugState.productId || undefined);
      if (!ok) alert("Native component not available.");
    };
  }
  if (btnSDK) {
    btnSDK.onclick = async () => {
      const res = await probeSizeGuides(_debugState.productId);
      alert(res.ok ? `Size guides found: ${res.count}` : `No size guides. ${res.error || ""}`);
      renderDebugOverlay(); // refresh numbers
    };
  }
}

/**
 * Track click or action
 */
export function trackClick(action) {
  const payload = {
    action,
    session_id: (function(){ try {return localStorage.getItem("size-core-session"); } catch {return null;} })(),
    product_id: resolveProductId() || null,
    product_url: window.location.href,
    store_id: config.STORE_ID || null,
    timestamp: Date.now()
  };
  fetch(config.TRACK_CLICK_ENDPOINT, { 
    method: "POST", 
    headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify(payload) 
  }).catch(()=>{});
}
