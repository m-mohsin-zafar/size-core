// rec.js // SizeRec - Size Recommendation Button
// Version: 0.1.1
(function () {
  // ==== CONFIG ====
  const FALLBACK_URL_FRAGMENT =
    "/dev-g28fdlssrobui45i/%D9%81%D8%B3%D8%AA%D8%A7%D9%86/p1123056285".toLowerCase();
  const EXTERNAL_FLOW_BASE = "https://staging.miqyas.ai/guided-photos"; // updated staging flow inside iframe
  const TRACK_CLICK_ENDPOINT = "https://your-saas.com/track-click"; // TODO: adjust
  const TRACK_RETURN_ENDPOINT = "https://your-saas.com/track-return"; // TODO: adjust
  const WIDGET_ID = "size-rec-widget";
  const WIDGET_IFRAME_ID = "size-rec-widget-iframe";
  const WIDGET_OPEN_CLASS = "size-rec-open";
  const WIDGET_GREETING_ID = "size-rec-greeting";
  const FLOW_ORIGIN = (function(){ try { return new URL(EXTERNAL_FLOW_BASE).origin; } catch { return null; } })();

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
  function applyButtonResponsiveStyles(btn) {
    try {
      const mobile = window.matchMedia('(max-width: 640px)').matches;
      if (mobile) {
        Object.assign(btn.style, {
          left: '16px',
          right: '16px',
          width: 'auto',
          minWidth: '0',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
          padding: '16px 20px',
          fontSize: '15px',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'center'
        });
      } else {
        Object.assign(btn.style, {
          width: 'auto',
          left: 'unset',
          right: '16px',
          bottom: '16px',
          padding: '14px 20px',
          borderRadius: '8px'
        });
      }
    } catch {}
  }

  function createButton() {
    if (document.getElementById("size-rec-floating-btn")) return null;
    const btn = document.createElement("button");
    btn.id = "size-rec-floating-btn";
  btn.textContent = "Get Size Recommendation";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      background: "#ff6f61",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      zIndex: 100000,
      boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
      transition: "transform .2s",
      lineHeight: '1.2',
      maxWidth: '100%',
      boxSizing: 'border-box'
    });
    applyButtonResponsiveStyles(btn);
    // Re-evaluate on resize / orientation change
    let resizeTO;
    window.addEventListener('resize', () => { clearTimeout(resizeTO); resizeTO = setTimeout(() => applyButtonResponsiveStyles(btn), 80); });
    window.addEventListener('orientationchange', () => setTimeout(() => applyButtonResponsiveStyles(btn), 120));
  btn.setAttribute("aria-label", "Get size recommendation");
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.03)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });
    btn.addEventListener("click", onButtonClick);
    return btn;
  }

  let _injectAttempts = 0;
  const MAX_INJECT_ATTEMPTS = 10; // safety bound
  function injectButtonIfNeeded(force=false) {
    if (!document.body) return;
    if (!force && document.getElementById("size-rec-floating-btn")) return; // already there
    const pdp = isProductPage();
    if (!pdp) {
      if (_injectAttempts < MAX_INJECT_ATTEMPTS) {
        _injectAttempts++;
        setTimeout(() => injectButtonIfNeeded(), 500 * Math.min(_injectAttempts,4));
      }
      return;
    }
    if (document.getElementById("size-rec-floating-btn")) return; // re-check after async
    const btn = createButton();
    if (!btn) return;
    document.body.appendChild(btn);
    log("Injected button (attempt", _injectAttempts, ")");
    if (DEBUG) renderDebugOverlay();
  }

  // ==== CLICK / SESSION / REDIRECT ====
  function onButtonClick(e) {
    e.preventDefault();
    openWidget();
  }

  // ==== WIDGET OVERLAY ==== 
  function ensureWidgetShell() {
    let shell = document.getElementById(WIDGET_ID);
    if (shell) return shell;
    shell = document.createElement("div");
    shell.id = WIDGET_ID;
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
    content.id = WIDGET_GREETING_ID;
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

  function openWidget() {
    const shell = ensureWidgetShell();
    requestAnimationFrame(() => {
      shell.style.pointerEvents = "auto";
      shell.style.opacity = "1";
      shell.style.transform = "translateY(0)";
    });
    trackClick("widget_open");
  }

  function closeWidget() {
    const shell = document.getElementById(WIDGET_ID);
    if (!shell) return;
    shell.style.opacity = "0";
    shell.style.pointerEvents = "none";
    shell.style.transform = "translateY(8px)";
    setTimeout(() => {
      // optional: keep in DOM for re-open
    }, 300);
  }

  function loadFlowIframe(shell) {
    // If already loaded, nothing
    if (document.getElementById(WIDGET_IFRAME_ID)) return;
    const pid = resolveProductId();
    const sessionId = genUUID();
    try { localStorage.setItem("size_rec_session", sessionId); } catch {}
    const flowURL = new URL(EXTERNAL_FLOW_BASE);
    flowURL.searchParams.set("session_id", sessionId);
    if (pid) flowURL.searchParams.set("product_id", pid);
    flowURL.searchParams.set("embed", "1");
    const frame = document.createElement("iframe");
    frame.id = WIDGET_IFRAME_ID;
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
    const content = document.getElementById(WIDGET_GREETING_ID);
    if (content) {
      content.innerHTML = ""; // clear
      content.appendChild(frame);
    } else {
      shell.appendChild(frame);
    }
    trackClick("flow_loaded");
  }

  function trackClick(action) {
    const payload = {
      action,
      session_id: (function(){ try {return localStorage.getItem("size_rec_session"); } catch {return null;} })(),
      product_id: resolveProductId() || null,
      product_url: window.location.href,
      timestamp: Date.now()
    };
    fetch(TRACK_CLICK_ENDPOINT, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload) }).catch(()=>{});
  }

  // ==== IFRAME MESSAGE HANDLING ====
  function handleIframeMessage(ev) {
    try {
      if (FLOW_ORIGIN && ev.origin !== FLOW_ORIGIN) return; // enforce origin
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== "miqyas" && data.source !== "size_rec_flow") return; // expected marker
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
  window.addEventListener("message", handleIframeMessage);

  function showInlineRecommendation(payload) {
    const shell = document.getElementById(WIDGET_ID);
    if (!shell) return;
    // Remove iframe (optional keep?)
    const iframe = document.getElementById(WIDGET_IFRAME_ID);
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
      <button id="size-rec-close-after" style="background:#222;color:#fff;border:0;border-radius:8px;padding:14px 22px;font-size:15px;font-weight:600;cursor:pointer;">Close</button>
    `;
    const container = shell.querySelector(`#${WIDGET_GREETING_ID}`) || shell;
    container.innerHTML = "";
    container.appendChild(resultWrap);
    const btnClose = container.querySelector("#size-rec-close-after");
    if (btnClose) btnClose.addEventListener("click", closeWidget);
  }

  function showInlineError(message) {
    const shell = document.getElementById(WIDGET_ID);
    if (!shell) return;
    const container = shell.querySelector(`#${WIDGET_GREETING_ID}`) || shell;
    container.innerHTML = `<div style="padding:40px 24px;text-align:center;">
      <h3 style="margin:0 0 12px;font-size:20px;">Something went wrong</h3>
      <p style="margin:0 0 24px;color:#555;">${escapeHTML(String(message))}</p>
      <button id="size-rec-retry" style="background:#ff6f61;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;">Retry</button>
      <button id="size-rec-close-error" style="margin-left:12px;background:#ddd;color:#222;border:0;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;">Close</button>
    </div>`;
    const retry = container.querySelector('#size-rec-retry');
    if (retry) retry.addEventListener('click', () => loadFlowIframe(shell));
    const closeBtn = container.querySelector('#size-rec-close-error');
    if (closeBtn) closeBtn.addEventListener('click', closeWidget);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c] || c));
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
  let mutationScheduled = false;
  function performStateCheck(urlChanged) {
    if (urlChanged) {
      _injectAttempts = 0; // reset attempts for new page
      setTimeout(() => {
        injectButtonIfNeeded(true);
        if (DEBUG) renderDebugOverlay();
        handleReturn();
      }, 150);
    } else {
      // No URL change: still attempt injection if missing (async content load)
      injectButtonIfNeeded();
    }
  }
  function scheduleMutationCheck() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    setTimeout(() => {
      mutationScheduled = false;
      const urlChanged = location.href !== lastHref;
      if (urlChanged) lastHref = location.href;
      performStateCheck(urlChanged);
    }, 180);
  }
  const observer = new MutationObserver(scheduleMutationCheck);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const origPush = history.pushState;
  history.pushState = function () { origPush.apply(this, arguments); scheduleMutationCheck(); };
  const origReplace = history.replaceState;
  history.replaceState = function () { origReplace.apply(this, arguments); scheduleMutationCheck(); };
  window.addEventListener("popstate", scheduleMutationCheck);
  window.addEventListener("visibilitychange", () => { if (!document.hidden) injectButtonIfNeeded(); });
  window.addEventListener("pageshow", () => injectButtonIfNeeded()); // bfcache restore

  // ==== BOOTSTRAP ====
  async function init() {
  // Multiple staggered attempts to catch late-loading DOM on PDP
  [0, 400, 1200, 2500].forEach(delay => setTimeout(() => injectButtonIfNeeded(), delay));
    handleReturn();
    if (DEBUG) await renderDebugOverlay();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
