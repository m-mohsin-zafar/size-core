import { log } from './utils.js';

/**
 * Check if JSON-LD structured data indicates a product page
 */
export function hasStructuredProduct() {
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

/**
 * Check if page has typical ecommerce action buttons
 */
export function hasActionKeyword() {
  const kws = ["add to cart","buy now","اشتري الآن","أضف إلى السلة","purchase","checkout","إضافة للسلة"];
  const els = Array.from(document.querySelectorAll('button, [role="button"]'));
  return els.some((b) => {
    const t = (b.textContent || "").trim().toLowerCase();
    return kws.some((k) => t.includes(k));
  });
}

/**
 * Check if page has product data attributes
 */
export function hasDataAttr() {
  return !!document.querySelector("[data-product-id],[data-sku],[data-product-slug]");
}

/**
 * Determine if current page is a product detail page
 */
export function isProductPage() {
  const href = window.location.href.toLowerCase();

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

/**
 * Extract product ID from DOM attributes
 */
export function getProductIdFromDOM() {
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

/**
 * Extract product ID from JSON-LD structured data
 */
export function getProductIdFromJSONLD() {
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
          // sku or productID are common; Salla's internal id may not be here, but worth trying
          if (item.productID) return String(item.productID);
          if (item.sku) return String(item.sku);
        }
      }
    }
  } catch (e) { log("json-ld parse failed", e); }
  return null;
}

/**
 * Extract product ID from URL patterns
 */
export function getProductIdFromURL() {
  // Heuristic: /p12345 or /p-12345 or ?product_id=123
  const u = new URL(location.href);
  const p = u.pathname.toLowerCase();
  const m = p.match(/\/p-?(\d{4,})/); // looks for p12345 / p-12345
  if (m) return m[1];
  const q = u.searchParams.get("product_id") || u.searchParams.get("productId");
  if (q) return String(q);
  return null;
}

/**
 * Try all product ID resolution methods
 */
export function resolveProductId() {
  return (
    getProductIdFromDOM() ||
    getProductIdFromJSONLD() ||
    getProductIdFromURL() ||
    null
  );
}
