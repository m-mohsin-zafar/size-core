/**
 * Functions for showing the connecting UI state
 */
import { config } from './config.js';
import { ensureWidgetShell, openWidget } from './widget.js';
import { trackClick } from './size-guides.js';
import { getDocumentSafe, safeMatchMedia } from './utils.js';

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

let hasInjectedSpinKeyframes = false;

function injectKeyframesOnce() {
  if (hasInjectedSpinKeyframes) return;
  const doc = getDocumentSafe();
  if (!doc) return;

  const style = doc.createElement('style');
  style.textContent = `
    @keyframes tw-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  doc.head.appendChild(style);
  hasInjectedSpinKeyframes = true;
}
  
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  
  // Check if we're on a desktop device
  const mq = safeMatchMedia('(max-width: 1024px)');
  const isDesktop = !(mq && mq.matches);
  
  // Make sure we're not overriding an existing iframe
  if (document.getElementById(config.WIDGET_IFRAME_ID)) {
    log('Iframe already exists, not showing connecting UI');
    return;
  }
  
  // Clear any existing content including the empty state
  container.innerHTML = "";
  
  // Set the connecting UI
  const connectingElement = document.createElement('div');
  const baseClasses = [
    'tw-flex tw-h-full tw-w-full tw-flex-col tw-items-center tw-justify-center tw-gap-5',
    'tw-bg-white tw-box-border tw-text-center tw-px-4 tw-py-8',
    'sm:tw-px-6 sm:tw-py-10'
  ];
  if (isDesktop) {
    baseClasses.push('tw-mx-auto tw-max-w-[420px] tw-rounded-2xl tw-border tw-border-slate-200 tw-shadow-[0_12px_28px_rgba(15,23,42,0.08)]');
  } else {
    baseClasses.push('tw-mx-auto tw-max-w-full tw-overflow-y-auto');
  }
  connectingElement.className = baseClasses.join(' ');

  const spinnerColor = '#903316';

  connectingElement.innerHTML = `
    <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
      <div class="tw-relative tw-h-16 tw-w-16 tw-rounded-full tw-border-2 tw-border-transparent tw-border-t-[${spinnerColor}] tw-animate-[tw-spin_1s_linear_infinite]">
        <div class="tw-absolute tw-inset-[4px] tw-rounded-full tw-border tw-border-slate-200"></div>
      </div>
      <h2 class="tw-text-[clamp(18px,4vw,22px)] tw-font-semibold tw-text-brand-text">Connecting to MIQYAS</h2>
      <p class="tw-max-w-sm tw-text-sm tw-leading-relaxed tw-text-neutral-600">We’re preparing your measurements. This should only take a moment.</p>
    </div>
    <p class="tw-text-[12px] tw-font-medium tw-text-neutral-500">Thanks for waiting.</p>
  `;
  
  // Add to container
  container.appendChild(connectingElement);
  
  // Add the animation style
  injectKeyframesOnce();
  
  // Track this event
  trackClick("connecting_ui_displayed");
}
