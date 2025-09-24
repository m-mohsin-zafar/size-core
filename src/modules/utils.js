import { DEBUG } from './config.js';

// Utility functions

/**
 * Log debug information if debug mode is enabled
 */
export function log(...args) { 
  if (DEBUG) console.log("[SizeCore]", ...args); 
}

export function getWindowSafe() {
  return typeof window !== 'undefined' ? window : null;
}

export function getDocumentSafe() {
  const win = getWindowSafe();
  if (win && win.document) return win.document;
  return typeof document !== 'undefined' ? document : null;
}

export function getLocalStorageSafe() {
  try {
    const win = getWindowSafe();
    if (win && win.localStorage) return win.localStorage;
  } catch {}
  return null;
}

export function safeMatchMedia(query) {
  if (!query) return null;
  const win = getWindowSafe();
  if (!win || typeof win.matchMedia !== 'function') return null;
  try {
    return win.matchMedia(query);
  } catch {
    return null;
  }
}

/**
 * Parse URL parameters
 */
export function parseParams() { 
  const win = getWindowSafe();
  if (!win || !win.location || typeof win.location.search !== 'string') {
    return new URLSearchParams();
  }
  return new URLSearchParams(win.location.search); 
}

/**
 * Generate a UUID v4
 */
export function genUUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

/**
 * Convert SVG text to a data URI
 * Enhanced version with better optimization and error handling
 */
export function svgToDataURI(svgText) {
  try {
    if (!svgText || typeof svgText !== 'string') return null;
    
    // Clean and optimize SVG
    let cleaned = svgText.trim()
      .replace(/\n+/g, ' ')              // Remove newlines
      .replace(/>\s+</g, '><')           // Remove whitespace between tags
      .replace(/\s{2,}/g, ' ')           // Normalize spaces
      .replace(/<!--(.*?)-->/g, '')      // Remove comments
      .replace(/\s*fill="[^"]*"/g, '')   // Remove fill attributes (optional, can be styled via CSS)
      .replace(/\s*stroke="[^"]*"/g, ''); // Remove stroke attributes (optional)
    
    // Ensure SVG has proper xmlns attribute for standalone use
    if (!cleaned.includes('xmlns="http://www.w3.org/2000/svg"')) {
      cleaned = cleaned.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Encoding method 1: encodeURIComponent (better compatibility but larger size)
    const encoded = encodeURIComponent(cleaned)
      .replace(/'/g, "%27")
      .replace(/%20/g, ' '); // keep spaces for smaller size
    return `data:image/svg+xml,${encoded}`;
    
    /* Alternative encoding method (more compact but less compatible):
    const encoded = cleaned
      .replace(/"/g, "'")
      .replace(/%/g, '%25')
      .replace(/#/g, '%23')
      .replace(/{/g, '%7B')
      .replace(/}/g, '%7D')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E');
    return `data:image/svg+xml,${encoded}`;
    */
  } catch (err) { 
    log('SVG conversion error:', err);
    return null; 
  }
}

/**
 * Fetch and process an SVG file from a URL
 * Returns a Promise that resolves to a data URI
 * @param {string} url - URL to fetch SVG from
 * @param {string} fillColor - Optional color to apply to all paths and shapes in the SVG
 * @returns {Promise<string|null>} - Data URI of the SVG or null if failed
 */
export async function fetchSVG(url, fillColor) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch SVG: ${response.statusText}`);
    let svgText = await response.text();
    
    if (!svgText.trim().toLowerCase().includes('<svg')) {
      throw new Error('Invalid SVG content');
    }
    
    // Apply fill color if specified
    if (fillColor) {
      // Create a temporary DOM element to manipulate the SVG
      const doc = getDocumentSafe();
      if (!doc) return svgToDataURI(svgText);
      const tempDiv = doc.createElement('div');
      tempDiv.innerHTML = svgText;
      const svgElement = tempDiv.querySelector('svg');
      
      if (svgElement) {
        // Find all paths, circles, rectangles and text elements and apply the fill color
        const elements = svgElement.querySelectorAll('path, circle, rect, text');
        elements.forEach(el => {
          el.setAttribute('fill', fillColor);
        });
        
        // Get the modified SVG content
        svgText = tempDiv.innerHTML;
      }
    }
    
    return svgToDataURI(svgText);
  } catch (err) {
    log('SVG fetch error:', err);
    return null;
  }
}

/**
 * Create an inline SVG element from SVG string
 */
export function createInlineSVG(svgText, className) {
  try {
    // Extract the SVG content if it's a data URI
    if (svgText.startsWith('data:image/svg+xml,')) {
      svgText = decodeURIComponent(svgText.substring(19));
    }

    // Create a temporary container
    const doc = getDocumentSafe();
    if (!doc) return null;
    const div = doc.createElement('div');
    div.innerHTML = svgText.trim();

    // Get the SVG element
    const svg = div.querySelector('svg');
    if (!svg) return null;

    // Set default size attributes if not present
    if (!svg.hasAttribute('width')) svg.setAttribute('width', '100%');
    if (!svg.hasAttribute('height')) svg.setAttribute('height', '100%');
    
    // Add the class name if specified
    if (className) svg.classList.add(className);
    
    // Return the SVG element
    return svg;
  } catch (err) {
    log('Inline SVG creation error:', err);
    return null;
  }
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c] || c));
}

export function tw(...classes) {
  return classes.filter(Boolean).join(' ');
}
