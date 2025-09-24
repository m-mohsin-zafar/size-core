import { config } from './config.js';
import { escapeHTML, safeMatchMedia, tw } from './utils.js';
import { openWidget, closeWidget, loadFlowIframe, ensureWidgetShell, showEmptyState } from './widget.js';
import { trackClick } from './size-guides.js';
import { clearMeasurementData } from './iframe-communication.js';

export function showSallaRecommendation(data, isStoredResult = false) {
  console.log('showSallaRecommendation called with:', data, 'isStoredResult:', isStoredResult);

  // Dedupe: if we recently rendered the same request_id, skip to avoid re-entrant renders
  try {
    window.__sizeCoreLastRender = window.__sizeCoreLastRender || { requestId: null, ts: 0 };
    const incomingId = data && data.request_id ? String(data.request_id) : null;
    const now = Date.now();
    // If same request id within 5s, skip
    if (incomingId && window.__sizeCoreLastRender.requestId === incomingId && (now - window.__sizeCoreLastRender.ts) < 5000) {
      console.log('Skipping duplicate showSallaRecommendation for request_id:', incomingId);
      return;
    }
    // Update last render info now (prevent races)
    window.__sizeCoreLastRender.requestId = incomingId;
    window.__sizeCoreLastRender.ts = now;
  } catch (e) { /* ignore */ }

  const shell = document.getElementById(config.WIDGET_ID);
  // Only call ensure/open if the shell is missing or not visible. Avoid re-entrant open when already visible.
  if (!shell) {
    ensureWidgetShell();
    openWidget();
  } else {
    // If widget exists, check if it's hidden or empty before opening
    const isVisible = !!(shell.offsetParent || (getComputedStyle(shell).display !== 'none' && shell.style.display !== 'none'));
    const hasContent = shell.innerHTML && shell.innerHTML.trim().length > 20;
    if (!isVisible || !hasContent) {
      openWidget();
    } else {
      console.log('Widget already visible with content — skipping openWidget() to avoid re-entrant render');
    }
  }
  
  // Remove iframe if exists
  const iframe = document.getElementById(config.WIDGET_IFRAME_ID);
  if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);

  const resultWrap = document.createElement("div");
  resultWrap.className = tw(
    'tw-animation-[sr-fade-in_0.35s_ease] tw-mx-auto tw-flex tw-w-full tw-max-w-[640px] tw-flex-col tw-items-center tw-justify-center tw-p-2'
  );

  // Remove environment badge
  // const keyType = data.results && data.results.key_type ? data.results.key_type : 'unknown';
  // const keyTypeBadge = `
  //   <div style="position: absolute; top: 10px; right: 10px; background: ${keyType === 'production' ? '#00796b' : '#e65100'}; 
  //        padding: 4px 8px; border-radius: 4px; font-size: 12px; color: white;">
  //     ${keyType === 'production' ? 'Production' : 'Development'}
  //   </div>
  // `;
  
  // Group measurements by body area for better readability
  let measurementsHtml = '';
  if (data.results && data.results.measurements && typeof data.results.measurements === 'object') {
    const measurements = data.results.measurements;
    const measurementEntries = Object.entries(measurements).filter(([, value]) => value !== null && value !== undefined && value !== '');

    if (measurementEntries.length) {
      const measurementGroups = {
        'Head & Neck': ['Head Circumference', 'Neck Circumference'],
        'Upper Body': ['Shoulder Breadth', 'Chest Circumference', 'Underbust Circumference', 'Waist Circumference', 'Shoulder To Crotch', 'Acromial Height'],
        'Arms': ['Arm Length', 'Wrist Circumference', 'Bicep Circumference', 'Forearm Circumference'],
        'Lower Body': ['Pelvis Circumference', 'Inside Leg Length', 'Thigh Circumference', 'Calf Circumference', 'Ankle Circumference']
      };

      const canonicalize = (label) => {
        return (label || '')
          .toString()
          .replace(/[_-]/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/\b(mm|cm)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      const toTitleCase = (str) => {
        return (str || '')
          .split(' ')
          .filter(Boolean)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };

      const formatMeasurementValue = (rawKey, rawValue, canonicalName) => {
        const numeric = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
        if (!Number.isNaN(numeric)) {
          const hasMmSuffix = /(_mm|mm)$/i.test(rawKey);
          const hasCmSuffix = /(_cm|cm)$/i.test(rawKey);
          const isLinear = /(circumference|length|height|width|depth|breadth|radius|waist|hip|shoulder|inseam|arm|leg|thigh|calf|ankle|bicep|forearm)/i.test(canonicalName);
          if (hasMmSuffix || (!hasCmSuffix && isLinear && numeric > 100)) {
            return `${(numeric / 10).toFixed(1)} cm`;
          }
          if (hasCmSuffix || isLinear) {
            return `${numeric.toFixed(1)} cm`;
          }
          return numeric.toString();
        }
        return String(rawValue);
      };

      const renderCard = (label, value) => `
        <div class="tw-flex tw-min-w-[104px] tw-flex-1 tw-flex-col tw-items-center tw-justify-center tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-p-[clamp(6px,1.6vw,9px)] tw-text-center">
          <span class="tw-mb-1 tw-text-[clamp(10px,2.8vw,12px)] tw-text-slate-500">${escapeHTML(label)}</span>
          <span class="tw-text-[clamp(13px,3.6vw,15px)] tw-font-semibold tw-text-brand-text">${escapeHTML(value)}</span>
        </div>
      `;

      const measurementMap = new Map();
      const usedKeys = new Set();

      for (const [rawKey, rawValue] of measurementEntries) {
        const canonicalKey = canonicalize(rawKey);
        const title = toTitleCase(canonicalKey) || rawKey;
        const displayValue = formatMeasurementValue(rawKey, rawValue, canonicalKey);
        measurementMap.set(canonicalKey, { rawKey, rawValue, title, displayValue });
      }

      measurementsHtml = `
        <div class="tw-m-1 tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-[clamp(10px,3.5vw,16px)] tw-box-border">
          <div class="tw-mb-3 tw-text-[clamp(13px,3.8vw,15px)] tw-font-semibold tw-text-brand-text">Your Measurements</div>
      `;

      let hasAnyMeasurement = false;

      for (const [groupName, groupMeasurements] of Object.entries(measurementGroups)) {
        let hasGroupMeasurements = false;
        let groupHtml = `
          <div class="tw-mt-3">
            <div class="tw-mb-2 tw-rounded-md tw-bg-slate-200 tw-p-[clamp(6px,1.8vw,8px)] tw-text-[clamp(12px,3.4vw,13px)] tw-font-semibold tw-text-slate-700">${escapeHTML(groupName)}</div>
            <div class="tw-flex tw-flex-wrap tw-justify-center tw-gap-[clamp(6px,1.8vw,10px)]">
        `;

        for (const measurementName of groupMeasurements) {
          const canonicalName = canonicalize(measurementName);
          const entry = measurementMap.get(canonicalName);
          if (!entry) continue;
          hasGroupMeasurements = true;
          hasAnyMeasurement = true;
          usedKeys.add(entry.rawKey);
          groupHtml += renderCard(measurementName, entry.displayValue);
        }

        groupHtml += '</div></div>';

        if (hasGroupMeasurements) {
          measurementsHtml += groupHtml;
        }
      }

      const remainingEntries = measurementEntries.filter(([key]) => !usedKeys.has(key));
      if (remainingEntries.length) {
        hasAnyMeasurement = true;
        let otherHtml = `
          <div class="tw-mt-3">
            <div class="tw-mb-2 tw-rounded-md tw-bg-slate-200 tw-p-[clamp(6px,1.8vw,8px)] tw-text-[clamp(12px,3.4vw,13px)] tw-font-semibold tw-text-slate-700">Additional Measurements</div>
            <div class="tw-flex tw-flex-wrap tw-justify-center tw-gap-[clamp(6px,1.8vw,10px)]">
        `;

        for (const [rawKey, rawValue] of remainingEntries) {
          const canonicalKey = canonicalize(rawKey);
          const entry = measurementMap.get(canonicalKey);
          const label = entry ? entry.title : toTitleCase(canonicalKey) || rawKey;
          const value = entry ? entry.displayValue : formatMeasurementValue(rawKey, rawValue, canonicalKey);
          otherHtml += renderCard(label, value);
        }

        otherHtml += '</div></div>';
        measurementsHtml += otherHtml;
      }

      if (!hasAnyMeasurement) {
        measurementsHtml += '<div class="tw-mt-3 tw-text-sm tw-text-slate-500">Measurements data was received but no values were available to display.</div>';
      }

      measurementsHtml += '</div>';
    }
  }
  
  // User data display
  let userDataHtml = '';
  if (data.userData) {
    userDataHtml = `
      <div class="tw-mt-4 tw-w-full tw-rounded-xl tw-border tw-border-blue-100 tw-bg-blue-50 tw-p-[clamp(10px,3.5vw,18px)] tw-box-border">
        <div class="tw-mb-3 tw-text-[clamp(13px,3.8vw,15px)] tw-font-semibold tw-text-brand-text">Your Profile</div>
        <div class="tw-flex tw-flex-wrap tw-justify-center tw-gap-[clamp(8px,2.6vw,14px)]">
    `;
    
    if (data.userData.gender) {
      userDataHtml += `
          <div class="tw-flex tw-min-w-[100px] tw-max-w-[140px] tw-flex-1 tw-flex-col tw-items-center tw-rounded-lg tw-bg-white tw-p-[clamp(8px,2.6vw,12px)] tw-text-center tw-shadow-sm">
            <div class="tw-mb-1 tw-text-[clamp(10px,3vw,12px)] tw-text-slate-500">Gender</div>
            <div class="tw-text-[clamp(13px,4vw,16px)] tw-font-semibold tw-text-brand-text">${data.userData.gender === 'male' ? 'Male' : 'Female'}</div>
          </div>
      `;
    }
    
    if (data.userData.height) {
      userDataHtml += `
          <div class="tw-flex tw-min-w-[100px] tw-max-w-[140px] tw-flex-1 tw-flex-col tw-items-center tw-rounded-lg tw-bg-white tw-p-[clamp(8px,2.6vw,12px)] tw-text-center tw-shadow-sm">
            <div class="tw-mb-1 tw-text-[clamp(10px,3vw,12px)] tw-text-slate-500">Height</div>
            <div class="tw-text-[clamp(13px,4vw,16px)] tw-font-semibold tw-text-brand-text">${data.userData.height} cm</div>
          </div>
      `;
    }
    
    if (data.userData.weight) {
      userDataHtml += `
          <div class="tw-flex tw-min-w-[100px] tw-max-w-[140px] tw-flex-1 tw-flex-col tw-items-center tw-rounded-lg tw-bg-white tw-p-[clamp(8px,2.6vw,12px)] tw-text-center tw-shadow-sm">
            <div class="tw-mb-1 tw-text-[clamp(10px,3vw,12px)] tw-text-slate-500">Weight</div>
            <div class="tw-text-[clamp(13px,4vw,16px)] tw-font-semibold tw-text-brand-text">${data.userData.weight} kg</div>
          </div>
      `;
    }
    
    userDataHtml += '</div></div>';
  }
  
  // Request ID info
  const requestIdHtml = data.request_id ? `
    <div class="tw-mt-2 tw-text-center tw-text-[11px] tw-text-slate-500">Request ID: ${data.request_id}</div>
  ` : '';

  // Build the complete HTML
  resultWrap.innerHTML = `
    <div class="tw-relative tw-w-full tw-rounded-2xl tw-bg-white tw-p-5 tw-text-center tw-shadow-[0_6px_22px_rgba(15,23,42,0.08)] tw-box-border">
      ${data.results && data.results.recommendedSize !== null ? `
        <div class="tw-mb-8 tw-text-center">
          <div class="tw-mb-3 tw-text-sm tw-font-medium tw-text-slate-500">Recommended Size</div>
          <div class="tw-mx-auto tw-flex tw-h-[100px] tw-w-[100px] tw-items-center tw-justify-center tw-rounded-full tw-bg-gradient-to-br tw-from-[#ff8a00] tw-to-[#e52e71] tw-text-[clamp(28px,8vw,42px)] tw-font-bold tw-leading-none tw-text-white tw-shadow-[0_8px_24px_rgba(229,46,113,0.35)]">${escapeHTML(String(data.results.recommendedSize))}</div>
          <div class="tw-mt-4 tw-text-sm tw-text-slate-600">Based on your body measurements</div>
        </div>
      ` : ''}
      ${measurementsHtml}
      ${userDataHtml}
      ${requestIdHtml}
      <div class="tw-mt-8 tw-mb-4 tw-flex tw-flex-wrap tw-justify-center tw-gap-4">
        ${isStoredResult ? `
          <button id="size-core-retake" class="tw-inline-flex tw-flex-1 tw-max-w-[260px] tw-items-center tw-justify-center tw-rounded-xl tw-bg-gradient-to-br tw-from-[#ff8a00] tw-to-[#e52e71] tw-px-[clamp(15px,4vw,22px)] tw-py-[clamp(10px,3vw,14px)] tw-text-[clamp(14px,3vw,15px)] tw-font-semibold tw-text-white tw-shadow-[0_8px_20px_rgba(229,46,113,0.35)] tw-transition hover:tw-opacity-90 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#e52e71]/40">Retake Measurements</button>
        ` : ''}
        <button id="size-core-close-after" class="tw-inline-flex tw-flex-1 tw-max-w-[260px] tw-items-center tw-justify-center tw-rounded-xl tw-bg-gradient-to-br tw-from-[#ff8a00] tw-to-[#e52e71] tw-px-[clamp(15px,4vw,22px)] tw-py-[clamp(10px,3vw,14px)] tw-text-[clamp(14px,3vw,15px)] tw-font-semibold tw-text-white tw-shadow-[0_8px_20px_rgba(229,46,113,0.35)] tw-transition hover:tw-opacity-90 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#e52e71]/40">Close</button>
      </div>
    </div>
  `;
  
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  container.innerHTML = "";
  container.appendChild(resultWrap);

  try {
    console.log('showSallaRecommendation rendered. container innerHTML length:', container.innerHTML ? container.innerHTML.length : 0);
  } catch (e) { console.warn('Could not read container innerHTML', e); }
  
  // Add event listeners to buttons
  const btnClose = container.querySelector("#size-core-close-after");
  if (btnClose) {
    btnClose.addEventListener("click", function() {
      // Explicitly call closeWidget with no arguments
      closeWidget();
    });
  }
  
  // Add event listener for retake measurements button if it exists
  const btnRetake = container.querySelector("#size-core-retake");
  if (btnRetake) {
    btnRetake.addEventListener("click", () => {
      try {
        clearMeasurementData();
        localStorage.removeItem('size-core-data');
        try { window.__sizeCoreHasResults = false; } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      try {
        showEmptyState(shell);
      } catch (err) {
        loadFlowIframe(shell);
      }
    });
  }
  
  // Track this event
  trackClick(isStoredResult ? "stored_recommendation_displayed" : "salla_recommendation_displayed");
}

/**
 * Show Salla error message inside the widget
 */
export function showSallaError(data) {
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
  
  const errorCode = escapeHTML(data.code || 'UNKNOWN_ERROR');
  const errorMessage = escapeHTML(String(data.message));
  
  container.innerHTML = `
    <div style="padding:clamp(20px, 5vw, 40px) clamp(15px, 4vw, 24px);text-align:center;max-width:500px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);box-sizing:border-box;width:100%;">
      <div style="display: inline-block; width: clamp(60px, 10vw, 80px); height: clamp(60px, 10vw, 80px); background: #ffebee; border-radius: 50%; margin-bottom: 25px; display: flex; align-items: center; justify-content: center;">
        <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4C7.584 4 4 7.584 4 12C4 16.416 7.584 20 12 20C16.416 20 20 16.416 20 12C20 7.584 16.416 4 12 4ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="#e53935"/>
        </svg>
      </div>
      <h3 style="margin:0 0 12px;font-size:clamp(20px, 5vw, 24px);color:#d32f2f;">Error</h3>
      <div style="display: inline-block; margin:0 0 15px; padding: 8px 15px; border-radius: 6px; background: #ffebee; color: #c62828; font-size: clamp(12px, 3vw, 14px); font-weight: 600;">${errorCode}</div>
      <p style="margin:0 0 30px;color:#555;font-size:clamp(14px, 4vw, 16px);line-height:1.5;">${errorMessage}</p>
      <div style="display:flex;flex-wrap:wrap;gap:15px;justify-content:center;">
        <button id="size-core-retry" style="background:#ff6f61;color:#fff;border:0;border-radius:10px;padding:clamp(10px, 3vw, 14px) clamp(15px, 4vw, 22px);font-size:clamp(14px, 3vw, 15px);font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(255,111,97,0.2);transition:all 0.2s ease;flex:1;max-width:200px;">Try Again</button>
        <button id="size-core-close-error" style="background:#333;color:#fff;border:0;border-radius:10px;padding:clamp(10px, 3vw, 14px) clamp(15px, 4vw, 22px);font-size:clamp(14px, 3vw, 15px);font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s ease;flex:1;max-width:200px;">Close</button>
      </div>
    </div>
  `;
  
  const retry = container.querySelector('#size-core-retry');
  if (retry) retry.addEventListener('click', () => loadFlowIframe(shell));
  
  const closeBtn = container.querySelector('#size-core-close-error');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      // Explicitly call closeWidget with no arguments
      closeWidget();
    });
  }
  
  // Track this event
  trackClick("salla_error_displayed");
}
