// rec.js // SizeRec - Size Recommendation Button
// Version: 0.1.1
(function () {
  // ==== CONFIG ====
  const FALLBACK_URL_FRAGMENT =
    "/dev-g28fdlssrobui45i/%D9%81%D8%B3%D8%AA%D8%A7%D9%86/p1123056285".toLowerCase();
  const EXTERNAL_FLOW_BASE = "https://your-saas.com/flow/start"; // adjust
  const TRACK_CLICK_ENDPOINT = "https://your-saas.com/track-click";
  const TRACK_RETURN_ENDPOINT = "https://your-saas.com/track-return";

  // ==== UTILS ====
  const DEBUG = /[?&]size_rec_debug=1/.test(window.location.search);
  function log(...args) { if (DEBUG) console.log("[SizeRec]", ...args); }
  function parseParams() { return new URLSearchParams(window.location.search); }
  function genUUID() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }

  // ==== PDP DETECTION (existing helpers kept) ====
  function hasStructuredProduct() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        let data; try { data = JSON.parse(s.textContent); } catch { continue; }
        const arr = Array.isArray(data) ? data : [data];
        for (const item of arr) {
          const type = item["@type"];
          if ((typeof type === "string" && type.toLowerCase() === "product") ||
              (Array.isArray(type) && type.map((t) => String(t).toLowerCase()).includes("product"))) {
            return true;
          }
        }
      }
    } catch (e) { log("structured data detection error", e); }
    return false;
  }

  function hasActionKeyword() {
    const kws = ["add to cart","buy now","اشتري الآن","أضف إلى السلة","purchase","checkout","إضافة للسلة"];
    const els = Array.from(document.querySelectorAll('button, [role="button"]'));
    return els.some((b) => {
      const t = (b.textContent || "").trim().toLowerCase();
      return kws.some((k) => t.includes(k));
    });
  }

  function hasDataAttr() {
    return !!document.querySelector("[data-product-id],[data-sku],[data-product-slug]");
  }

  function isProductPage() {
    const href = window.location.href.toLowerCase();

    if (href.includes(FALLBACK_URL_FRAGMENT)) return true;

    // Structured data
    if (hasStructuredProduct()) return true;

    // Specific Salla add-to-cart structure
    try {
      const container = document.querySelector("div.s-add-product-button-main");
      if (container) {
        const span = container.querySelector("span.s-button-text");
        if (span) {
          const txt = (span.textContent || "").trim().toLowerCase();
          if (txt === "add to cart" || txt === "إضافة للسلة") return true;
        }
      }
    } catch {}

    // Other action keywords (fallback)
    if (hasActionKeyword()) return true;

    // Data attributes (fallback)
    if (hasDataAttr()) return true;

    return false;
  }

  // ==== PRODUCT ID DISCOVERY ====
  function getProductIdFromDOM() {
    // 1) Common data attributes
    const attrEl = document.querySelector("[data-product-id]");
    if (attrEl) {
      const v = attrEl.getAttribute("data-product-id");
      if (v) return String(v);
    }

    // 2) Hidden inputs near add-to-cart
    const input = document.querySelector('input[name="product_id"], input[name="productId"]');
    if (input && input.value) return String(input.value);

    // 3) Buttons carrying dataset
    const btn = document.querySelector('button[data-product-id], [role="button"][data-product-id]');
    if (btn && btn.getAttribute("data-product-id")) return String(btn.getAttribute("data-product-id"));

    return null;
  }

  function getProductIdFromJSONLD() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        let data; try { data = JSON.parse(s.textContent); } catch { continue; }
        const arr = Array.isArray(data) ? data : [data];
        for (const item of arr) {
          const type = item["@type"];
          const isProduct =
            (typeof type === "string" && type.toLowerCase() === "product") ||
            (Array.isArray(type) && type.map((t) => String(t).toLowerCase()).includes("product"));
          if (isProduct) {
            // sku or productID are common; Salla’s internal id may not be here, but worth trying
            if (item.productID) return String(item.productID);
            if (item.sku) return String(item.sku);
          }
        }
      }
    } catch (e) { log("json-ld parse failed", e); }
    return null;
  }

  function getProductIdFromURL() {
    // Heuristic: /p12345 or /p-12345 or ?product_id=123
    const u = new URL(location.href);
    const p = u.pathname.toLowerCase();
    const m = p.match(/\/p-?(\d{4,})/); // looks for p12345 / p-12345
    if (m) return m[1];
    const q = u.searchParams.get("product_id") || u.searchParams.get("productId");
    if (q) return String(q);
    return null;
  }

  function resolveProductId() {
    return (
      getProductIdFromDOM() ||
      getProductIdFromJSONLD() ||
      getProductIdFromURL() ||
      null
    );
  }

  // ==== SIZE GUIDE PROBES ====
  function hasTwilightSDK() {
    return !!(window.twilight && window.twilight.product && typeof window.twilight.product.getSizeGuides === "function");
  }

  async function probeSizeGuides(productId) {
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

  function hasNativeSizeGuideComponent() {
    return !!document.querySelector("salla-product-size-guide");
  }

  function ensureAndOpenNativeGuide(productId) {
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

  // ==== DEBUG OVERLAY (expanded) ====
  const _debugState = {
    isPDP: false,
    productId: null,
    sdk: false,
    sizeGuides: { ok: false, count: 0, error: null },
    nativeComp: false,
  };

  async function refreshDebugState() {
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

  async function renderDebugOverlay() {
    if (!DEBUG) return;
    await refreshDebugState();

    let overlay = document.getElementById("size-rec-debug-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "size-rec-debug-overlay";
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
      ["Twilight SDK", _debugState.sdk ? "✅" : "❌"],
      ["Native <salla-product-size-guide>", _debugState.nativeComp ? "✅" : "❌"],
      ["Size Guides (SDK)", _debugState.sizeGuides.ok ? `✅ (${_debugState.sizeGuides.count})` : `❌${_debugState.sizeGuides.error ? " — " + _debugState.sizeGuides.error : ""}`],
    ];

    overlay.innerHTML =
      `<strong>SizeRec Debug</strong><br>` +
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

  // ==== BUTTON INJECTION (unchanged except debug call) ====
  function createButton() {
    if (document.getElementById("size-rec-floating-btn")) return null;
    const btn = document.createElement("button");
    btn.id = "size-rec-floating-btn";
    btn.textContent = "Get Size Recommendation";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      padding: "14px 20px",
      background: "#ff6f61",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      zIndex: 100000,
      boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
      transition: "transform .2s",
    });
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.03)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });
    btn.addEventListener("click", onButtonClick);
    return btn;
  }

  function injectButtonIfNeeded() {
    if (!isProductPage()) { log("Not a PDP - skip injection"); return; }
    if (!document.body) return;
    if (document.getElementById("size-rec-floating-btn")) return;
    const btn = createButton();
    if (!btn) return;
    document.body.appendChild(btn);
    log("Injected button");
    if (DEBUG) renderDebugOverlay();
  }

  // ==== CLICK / SESSION / REDIRECT ====
  function onButtonClick(e) {
    e.preventDefault();
    log("Button clicked");
    const sessionId = genUUID();
    try { localStorage.setItem("size_rec_session", sessionId); } catch {}

    const referralCode = sessionId;
    const productUrl = window.location.href;

    fetch(TRACK_CLICK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        referral_code: referralCode,
        product_url: productUrl,
        product_id: resolveProductId() || null,
        timestamp: Date.now(),
      }),
    }).catch(() => {});

    const flow = new URL(EXTERNAL_FLOW_BASE);
    flow.searchParams.set("session_id", sessionId);
    flow.searchParams.set("referral_code", referralCode);
    flow.searchParams.set("return_url", window.location.href);
    const pid = resolveProductId();
    if (pid) flow.searchParams.set("product_id", pid);
    window.location.href = flow.toString();
  }

  // ==== RETURN HANDLING ====
  function handleReturn() {
    const params = parseParams();
    const size = params.get("rec_size");
    const recId = params.get("rec_id") || params.get("session_id");
    if (!size || !recId) return;
    if (document.getElementById("size-rec-result")) return;
    const banner = document.createElement("div");
    banner.id = "size-rec-result";
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
    fetch(TRACK_RETURN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: recId,
        recommended_size: size,
        product_url: window.location.href,
        product_id: resolveProductId() || null,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }

  // ==== NAVIGATION / OBSERVERS ====
  let lastHref = location.href;
  function onNavUpdate() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(() => {
        injectButtonIfNeeded();
        if (DEBUG) renderDebugOverlay();
        handleReturn();
      }, 150);
    }
  }
  new MutationObserver(onNavUpdate).observe(document.body || document.documentElement, { childList: true, subtree: true });
  const origPush = history.pushState;
  history.pushState = function () { origPush.apply(this, arguments); onNavUpdate(); };
  const origReplace = history.replaceState;
  history.replaceState = function () { origReplace.apply(this, arguments); onNavUpdate(); };
  window.addEventListener("popstate", onNavUpdate);

  // ==== BOOTSTRAP ====
  async function init() {
    injectButtonIfNeeded();
    handleReturn();
    if (DEBUG) await renderDebugOverlay();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
