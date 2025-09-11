/**
 * Show Salla connection status inside the widget
 */
import { config } from './config.js';
import { openWidget, ensureWidgetShell } from './widget.js';
import { trackClick } from './size-guides.js';

export function showSallaStatus(data) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) {
    // Create the widget shell if it doesn't exist
    ensureWidgetShell();
    openWidget();
  } else {
    // If widget already exists, make sure it's visible
    openWidget();
  }
  
  // Remove any existing status notification
  const existingStatus = document.getElementById('size-core-salla-status');
  if (existingStatus && existingStatus.parentNode) {
    existingStatus.parentNode.removeChild(existingStatus);
  }
  
  // Create status display
  const statusWrap = document.createElement("div");
  Object.assign(statusWrap.style, {
    position: "absolute",
    top: "60px",
    left: "0",
    right: "0",
    padding: "12px 20px",
    background: "#4CAF50",
    color: "white",
    textAlign: "center",
    fontSize: "14px",
    zIndex: "100003",
    opacity: "0",
    transform: "translateY(-20px)",
    transition: "opacity .3s ease, transform .3s ease",
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)"
  });
  
  // Status content
  statusWrap.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center;">
      <div>
        <strong>Let's Get Started</strong>
      </div>
    </div>
  `;
  
  // Add ID for future reference
  statusWrap.id = 'size-core-salla-status';
  
  // Add to widget
  shell.appendChild(statusWrap);
  
  // Animate in
  setTimeout(() => {
    statusWrap.style.opacity = "1";
    statusWrap.style.transform = "translateY(0)";
  }, 10);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (statusWrap && statusWrap.parentNode) {
      statusWrap.style.opacity = "0";
      statusWrap.style.transform = "translateY(-20px)";
      setTimeout(() => {
        if (statusWrap.parentNode) {
          statusWrap.parentNode.removeChild(statusWrap);
        }
      }, 300);
    }
  }, 5000);
  
  // Track this event
  trackClick("salla_connection_displayed");
  
  return statusWrap;
}
