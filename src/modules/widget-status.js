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
  
  // Check if we're on a desktop device
  const isDesktop = !window.matchMedia('(max-width: 1024px)').matches;
  
  // Create status display
  const statusWrap = document.createElement("div");
  
  // Apply different styles based on device type
  if (isDesktop) {
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
      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "0 0 4px 4px"
    });
  } else {
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
  }
  
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

/**
 * Show a session created UI: QR code + mobile link and instructions
 * @param {{message?:string, sessionId?:string, mode?:string}} info
 */
export function showSessionCreated(info = {}) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) {
    ensureWidgetShell();
    openWidget();
  } else {
    openWidget();
  }

  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;

  const msg = 'Please scan the QR using a mobile device';
  const sessionId = info.sessionId || '';

  // We'll dynamically import the 'qrcode' library and render a canvas
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;">
      <div style="padding:20px; text-align:center; max-width:520px; margin: 0 auto;">
        <h3 style="margin:0 6px 12px;font-size:18px;color:#222;font-weight:700;">${msg}</h3>
        <div id="size-core-qr-target" style="width:240px;height:240px;margin:12px auto;display:block;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;border:1px solid #f0f0f0;box-shadow:0 6px 20px rgba(0,0,0,0.06);"></div>
        <div style="margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button id="size-core-session-close" style="background:#333;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    </div>
  `;

  // Render QR locally using the qrcode package (dynamic import to avoid always bundling)
  if (sessionId) {
    const target = document.getElementById('size-core-qr-target');
    if (!target) return;
    // use the EXTERNAL_FLOW_BASE as the URL prefix
    const url = `${config.EXTERNAL_FLOW_BASE}&sessionId=${sessionId}`;
    const payload = String(url);

    const fallbackToGoogle = () => {
      try {
        const qrData = encodeURIComponent(payload);
        const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${qrData}`;
        const img = document.createElement('img');
        img.src = qrUrl;
        img.alt = 'Scan to join';
        Object.assign(img.style, { width: '200px', height: '200px', display: 'block', borderRadius: '8px' });
        target.innerHTML = '';
        target.appendChild(img);
      } catch (e) {
        console.error('Google QR fallback failed', e);
        target.innerText = payload;
      }
    };

    import('qrcode')
      .then(QR => {
        QR.toDataURL(payload, { width: 400, margin: 1 })
          .then(url => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Scan to join';
            Object.assign(img.style, { width: '200px', height: '200px', display: 'block', borderRadius: '8px' });
            target.innerHTML = '';
            target.appendChild(img);
          })
          .catch(err => {
            console.error('QR generation error with qrcode library', err);
            fallbackToGoogle();
          });
      })
      .catch(err => {
        console.warn('Failed to dynamically import qrcode, attempting CDN fallback', err);
        // Try CDN fallback: jsdelivr qrcode build
        const tryCDN = () => new Promise((resolve, reject) => {
          if (typeof window !== 'undefined' && (window.QRCode || window.qrcode || window.QRCode)) {
            return resolve({ getLib: () => window.qrcode || window.QRCode });
          }
          try {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js';
            script.async = true;
            script.onload = function() {
              // qrcode library exposes "QRCode" or "qrcode" depending on bundle
              const lib = window.QRCode || window.qrcode || null;
              if (lib) return resolve({ getLib: () => lib });
              reject(new Error('qrcode CDN loaded but global not found'));
            };
            script.onerror = function(e) { reject(new Error('Failed to load qrcode from CDN')); };
            document.head.appendChild(script);
          } catch (e) {
            reject(e);
          }
        });

        tryCDN()
          .then(({ getLib }) => {
            const lib = getLib();
            try {
              // lib.toDataURL or lib.toCanvas depending on implementation
              if (typeof lib.toDataURL === 'function') {
                lib.toDataURL(payload, { width: 400, margin: 1 }).then(url => {
                  const img = document.createElement('img');
                  img.src = url;
                  img.alt = 'Scan to join';
                  Object.assign(img.style, { width: '200px', height: '200px', display: 'block', borderRadius: '8px' });
                  target.innerHTML = '';
                  target.appendChild(img);
                }).catch(e => { console.error('CDN qrcode toDataURL failed', e); fallbackToGoogle(); });
              } else if (typeof lib.toCanvas === 'function') {
                // Create a canvas and draw
                const canvas = document.createElement('canvas');
                canvas.width = 200; canvas.height = 200;
                try {
                  lib.toCanvas(canvas, payload, { width: 200, margin: 1 }, (err) => {
                    if (err) { console.error('CDN qrcode toCanvas error', err); return fallbackToGoogle(); }
                    target.innerHTML = '';
                    target.appendChild(canvas);
                  });
                } catch (e) { console.error('CDN qrcode toCanvas exception', e); fallbackToGoogle(); }
              } else {
                console.error('CDN qrcode library present but has no usable API');
                fallbackToGoogle();
              }
            } catch (e) {
              console.error('Error using CDN qrcode library', e);
              fallbackToGoogle();
            }
          })
          .catch(cdnErr => {
            console.error('qrcode CDN fallback failed', cdnErr);
            fallbackToGoogle();
          });
      });
  }


  const closeBtn = container.querySelector('#size-core-session-close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    // Close the widget
    const close = window.__sizeCoreClose || null;
    try { if (typeof close === 'function') close(); } catch {}
    // Fallback - call exported closeWidget if available
    import('./widget.js').then(m => { if (m.closeWidget) m.closeWidget(); });
  });

  // Retake and copy controls removed per design

  return container;
}


/**
 * Show a waiting placeholder after a mobile joins and before measurements arrive
 * @param {{sessionId?:string, mobileId?:string}} info
 */
export function showWaitingForMeasurements(info = {}) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) {
    ensureWidgetShell();
    openWidget();
  } else {
    openWidget();
  }

  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  const sessionId = info.sessionId || '';
  const mobileId = info.mobileId || '';

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;">
      <div style="padding:24px; text-align:center; max-width:520px; margin: 0 auto;">
        <h3 style="margin:0 6px 12px;font-size:18px;color:#222;font-weight:700;">Waiting for measurements</h3>
        <div style="margin-top:12px;color:#555;font-size:14px;">A mobile device has joined the session. Waiting for the user to complete measurements...</div>
        <div id="size-core-wait-placeholder" style="margin-top:20px;display:flex;gap:12px;align-items:center;justify-content:center;">
          <div style="width:48px;height:48px;border-radius:24px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:18px;">📱</div>
          <div style="text-align:left;">
            <div style="font-weight:600;color:#222;">Session</div>
            <div style="color:#666;font-size:13px;word-break:break-all;max-width:260px;">${sessionId || '—'}</div>
          </div>
        </div>
        <div style="margin-top:22px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button id="size-core-session-cancel" style="background:#eee;color:#333;border:0;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const cancelBtn = container.querySelector('#size-core-session-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    // Close the widget on cancel
    const close = window.__sizeCoreClose || null;
    try { if (typeof close === 'function') close(); } catch {}
    import('./widget.js').then(m => { if (m.closeWidget) m.closeWidget(); });
  });

  return container;
}
