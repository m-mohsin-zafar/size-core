/**
 * Functions for showing the connecting UI state
 */
import { config } from './config.js';
import { ensureWidgetShell, openWidget } from './widget.js';
import { trackClick } from './size-guides.js';

/**
 * Shows the connecting UI state
 */
export function showConnectingUI() {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) {
    // Create the widget shell if it doesn't exist
    ensureWidgetShell();
    openWidget();
  } else {
    // If widget already exists, make sure it's visible
    openWidget();
  }
  
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  
  // Check if we're on a desktop device
  const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
  
  // Base styles for both mobile and desktop
  const baseStyles = `
    padding: clamp(20px, 5vw, 40px) clamp(15px, 4vw, 24px);
    text-align: center;
    background: #fff;
    box-sizing: border-box;
    width: 100%;
  `;
  
  // Device-specific styles
  const mobileStyles = `
    max-width: 100%;
    margin: 0 auto;
    height: 100%;
    border-radius: 0;
    overflow-y: auto;
  `;
  
  const desktopStyles = `
    max-width: 500px;
    margin: 0 auto;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  `;
  
  // Apply styles based on device type
  const responsiveStyles = isDesktop ? desktopStyles : mobileStyles;
  
  // Make sure we're not overriding an existing iframe
  if (document.getElementById(config.WIDGET_IFRAME_ID)) {
    log('Iframe already exists, not showing connecting UI');
    return;
  }
  
  // Clear any existing content including the empty state
  container.innerHTML = "";
  
  // Set the connecting UI
  const connectingElement = document.createElement('div');
  connectingElement.style.cssText = `${baseStyles} ${responsiveStyles}`;
  connectingElement.innerHTML = `
    <div style="margin-bottom:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div style="width:clamp(80px, 15vw, 120px);height:clamp(80px, 15vw, 120px);border:3px solid #f0f0f0;border-radius:50%;margin-bottom:20px;position:relative;">
        <div id="size-core-loading-spinner" style="width:100%;height:100%;border-radius:50%;border-top:3px solid #903316;position:absolute;top:-3px;left:-3px;animation:spin 1s linear infinite;"></div>
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.5 9h-2.1c-.5-4-3.8-7-7.9-7-4.4 0-8 3.6-8 8 0 4.1 3.1 7.5 7.1 7.9.4 0 .7.1 1.1.1h9.8c1.4 0 2.5-1.1 2.5-2.5S22.9 13 21.5 13c-.2 0-.4 0-.6.1.4-.6.6-1.3.6-2.1 0-1.1-.9-2-2-2zm-10 7c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#903316"/>
            <path d="M11.5 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#903316"/>
          </svg>
        </div>
      </div>
      <h2 style="margin:0 0 10px;font-size:clamp(20px, 5vw, 26px);color:#333;">Connecting to MIQYAS AI Engine</h2>
      <p style="margin:0 0 20px;color:#666;font-size:clamp(14px, 4vw, 16px);line-height:1.5;">Please wait while our AI prepares your perfect fit...</p>
    </div>
    <p style="margin:20px 0;color:#888;font-size:clamp(12px, 3vw, 14px);font-style:italic;">This may take a few moments</p>
  `;
  
  // Add to container
  container.appendChild(connectingElement);
  
  // Add the animation style
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
  
  // Track this event
  trackClick("connecting_ui_displayed");
}
