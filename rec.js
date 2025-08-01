// rec.js// SizeRec - Size Recommendation Button
// Version: 0.1.0
(function () {
  // ==== CONFIG ====
  const FALLBACK_URL_FRAGMENT = "/dev-g28fdlssrobui45i/%D9%81%D8%B3%D8%AA%D8%A7%D9%86/p1123056285".toLowerCase();
  const EXTERNAL_FLOW_BASE = "https://your-saas.com/flow/start"; // adjust
  const TRACK_CLICK_ENDPOINT = "https://your-saas.com/track-click";
  const TRACK_RETURN_ENDPOINT = "https://your-saas.com/track-return";

  // ==== UTILS ====
  const DEBUG = /[?&]size_rec_debug=1/.test(window.location.search);
  function log(...args) { if (DEBUG) console.log("[SizeRec]", ...args); }

  function genUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  function parseParams() {
    return new URLSearchParams(window.location.search);
  }

  // ==== PDP DETECTION ====
  function hasStructuredProduct() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        let data;
        try { data = JSON.parse(s.textContent); } catch { continue; }
        const arr = Array.isArray(data) ? data : [data];
        for (const item of arr) {
          const type = item['@type'];
          if ((typeof type === 'string' && type.toLowerCase() === 'product') ||
              (Array.isArray(type) && type.map(t => t.toLowerCase()).includes('product'))) {
            return true;
          }
        }
      }
    } catch (e) {
      log("structured data detection error", e);
    }
    return false;
  }

  function hasActionKeyword() {
    const kws = ['add to cart','buy now','اشتري الآن','أضف إلى السلة','purchase','checkout'];
    const els = Array.from(document.querySelectorAll('button, [role="button"]'));
    return els.some(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return kws.some(k => t.includes(k));
    });
  }

  function hasDataAttr() {
    return !!document.querySelector('[data-product-id],[data-sku],[data-product-slug]');
  }

  function isProductPage() {
    const href = window.location.href.toLowerCase();
    if (href.includes(FALLBACK_URL_FRAGMENT)) {
      log("PDP detection: fallback match");
      return true;
    }
    if (hasStructuredProduct()) {
      log("PDP detection: structured data");
      return true;
    }
    if (hasActionKeyword()) {
      log("PDP detection: action keyword");
      return true;
    }
    if (hasDataAttr()) {
      log("PDP detection: data attribute");
      return true;
    }
    return false;
  }

  // ==== DEBUG OVERLAY ====
  function renderDebugOverlay() {
    if (!DEBUG) return;
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
        lineHeight: "1.2",
        fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
        maxWidth: "280px"
      });
      document.body.appendChild(overlay);
    }
    const checks = [
      ["Fallback URL", window.location.href.toLowerCase().includes(FALLBACK_URL_FRAGMENT)],
      ["Structured Data", hasStructuredProduct()],
      ["Action Btn", hasActionKeyword()],
      ["Data Attrs", hasDataAttr()]
    ];
    overlay.innerHTML = `<strong>SizeRec Detection</strong><br>` +
      checks.map(c => `${c[0]}: ${c[1] ? "✅" : "❌"}`).join("<br>");
  }

  // ==== BUTTON INJECTION ====
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
      transition: "transform .2s"
    });
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.03)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });
    btn.addEventListener("click", onButtonClick);
    return btn;
  }

  function injectButtonIfNeeded() {
    if (!isProductPage()) {
      log("Not a PDP - skip injection");
      return;
    }
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

    // fire click tracking
    fetch(TRACK_CLICK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        referral_code: referralCode,
        product_url: productUrl,
        timestamp: Date.now()
      })
    }).catch(() => {});

    // build redirect
    const flow = new URL(EXTERNAL_FLOW_BASE);
    flow.searchParams.set("session_id", sessionId);
    flow.searchParams.set("referral_code", referralCode);
    flow.searchParams.set("return_url", window.location.href);
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
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
    });
    document.body.appendChild(banner);
    // notify backend
    fetch(TRACK_RETURN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: recId,
        recommended_size: size,
        product_url: window.location.href,
        timestamp: Date.now()
      })
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
  new MutationObserver(onNavUpdate).observe(document.body, { childList: true, subtree: true });
  const origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    onNavUpdate();
  };
  const origReplace = history.replaceState;
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    onNavUpdate();
  };
  window.addEventListener("popstate", onNavUpdate);

  // ==== BOOTSTRAP ====
  function init() {
    injectButtonIfNeeded();
    handleReturn();
    if (DEBUG) renderDebugOverlay();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
