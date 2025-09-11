/**
 * Show Salla recommendation inside the widget
 * @param {Object} data - The recommendation data
 * @param {boolean} isSt  // Request ID info
  const requestIdHtml = data.request_id ? `
    <div style="margin: 10px auto 0; font-size: clamp(9px, 2.5vw, 11px); opacity: 0.6; color: #666; text-align: center;">
      Request ID: ${data.request_id}
    </div>
  ` : '';
  
  // Build the complete HTML
  resultWrap.innerHTML = `
    <div style="position: relative; width: 100%; padding: clamp(10px, 4vw, 20px); box-sizing: border-box;">
      ${data.results && data.results.recommendedSize !== null ? `
        <div style="margin-bottom: 30px;">` Whether this is showing a stored result
 */
import { config } from './config.js';
import { escapeHTML } from './utils.js';
import { openWidget, closeWidget, loadFlowIframe, ensureWidgetShell } from './widget.js';
import { trackClick } from './size-guides.js';
import { clearMeasurementData } from './iframe-communication.js';

export function showSallaRecommendation(data, isStoredResult = false) {
  const shell = document.getElementById(config.WIDGET_ID);
  if (!shell) {
    // Create the widget shell if it doesn't exist
    ensureWidgetShell();
    openWidget();
  } else {
    // If widget already exists, make sure it's visible
    openWidget();
  }
  
  // Remove iframe if exists
  const iframe = document.getElementById(config.WIDGET_IFRAME_ID);
  if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);

  const resultWrap = document.createElement("div");
  Object.assign(resultWrap.style, {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px",
    textAlign: "center",
    animation: "sr-fade-in .35s ease",
    width: "calc(100% - clamp(8px, 3vw, 12px))",
    maxWidth: "650px",
    margin: "0 auto",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
  });
  
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
  if (data.results && data.results.measurements) {
    const measurements = data.results.measurements;
    
    // Define measurement groups
    const measurementGroups = {
      'Head & Neck': ['Head Circumference', 'Neck Circumference'],
      'Upper Body': ['Shoulder Breadth', 'Chest Circumference', 'Underbust Circumference', 'Waist Circumference', 'Shoulder To Crotch', 'Acromial Height'],
      'Arms': ['Arm Length', 'Wrist Circumference', 'Bicep Circumference', 'Forearm Circumference'],
      'Lower Body': ['Pelvis Circumference', 'Inside Leg Length', 'Thigh Circumference', 'Calf Circumference', 'Ankle Circumference']
    };
    
    measurementsHtml = '<div style="margin: 2px; padding: clamp(10px, 4vw, 20px); background: #f9f9f9; border-radius: 10px; width: 100%; position: relative; border: 1px solid #f0f0f0; box-sizing: border-box;">';
    measurementsHtml += '<div style="font-size: clamp(14px, 4vw, 16px); font-weight: 600; margin-bottom: 15px; color: #333;">Your Measurements</div>';
    
      // Go through each group and display measurements if they exist
      for (const [groupName, groupMeasurements] of Object.entries(measurementGroups)) {
        let hasGroupMeasurements = false;
        let groupHtml = `<div style="margin-top: 15px;">
          <div style="font-size: clamp(12px, 3.5vw, 14px); font-weight: 600; color: #444; margin-bottom: 10px; background: #f0f0f0; padding: clamp(6px, 2vw, 8px); border-radius: 6px;">${groupName}</div>
          <div style="display: flex; flex-wrap: wrap; gap: clamp(6px, 2vw, 10px); justify-content: center;">`;
        
        for (const measurementName of groupMeasurements) {
          if (measurements[measurementName] !== undefined) {
            // Convert from mm to cm for display
            const valueInCm = (measurements[measurementName] / 10).toFixed(1);
            groupHtml += `<div style="padding: clamp(6px, 2vw, 8px); background: #fff; border-radius: 6px; border: 1px solid #eee; display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; min-width: clamp(80px, 20vw, 110px); max-width: calc(50% - 10px);">
              <span style="font-size: clamp(10px, 3vw, 12px); color: #666; margin-bottom: 4px;">${escapeHTML(measurementName)}</span>
              <span style="font-size: clamp(13px, 4vw, 16px); font-weight: 600; color: #333;">${valueInCm} cm</span>
            </div>`;
            hasGroupMeasurements = true;
          }
        }
        
        groupHtml += '</div></div>';
        
        // Only add this group if it has measurements
        if (hasGroupMeasurements) {
          measurementsHtml += groupHtml;
        }
      }    measurementsHtml += '</div>';
  }
  
  // User data display
  let userDataHtml = '';
  if (data.userData) {
    userDataHtml = '<div style="margin: 20px auto 0; padding: clamp(10px, 4vw, 20px); background: #f0f7ff; border-radius: 10px; width: 100%; border: 1px solid #e0e9f5; box-sizing: border-box;">';
    userDataHtml += '<div style="font-size: clamp(14px, 4vw, 16px); font-weight: 600; margin-bottom: 15px; color: #333;">Your Profile</div>';
    userDataHtml += '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(8px, 3vw, 15px);">';
    
    if (data.userData.gender) {
      userDataHtml += `
        <div style="background: #fff; border-radius: 8px; padding: clamp(8px, 3vw, 12px) clamp(10px, 4vw, 20px); text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); flex: 1; min-width: clamp(70px, 18vw, 90px); max-width: 140px;">
          <div style="font-size: clamp(10px, 3vw, 12px); color: #666; margin-bottom: 5px;">Gender</div>
          <div style="font-size: clamp(13px, 4vw, 16px); font-weight: 600;">${data.userData.gender === 'male' ? 'Male' : 'Female'}</div>
        </div>`;
    }
    
    if (data.userData.height) {
      userDataHtml += `
        <div style="background: #fff; border-radius: 8px; padding: clamp(8px, 3vw, 12px) clamp(10px, 4vw, 20px); text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); flex: 1; min-width: clamp(70px, 18vw, 90px); max-width: 140px;">
          <div style="font-size: clamp(10px, 3vw, 12px); color: #666; margin-bottom: 5px;">Height</div>
          <div style="font-size: clamp(13px, 4vw, 16px); font-weight: 600;">${data.userData.height} cm</div>
        </div>`;
    }
    
    if (data.userData.weight) {
      userDataHtml += `
        <div style="background: #fff; border-radius: 8px; padding: clamp(8px, 3vw, 12px) clamp(10px, 4vw, 20px); text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); flex: 1; min-width: clamp(70px, 18vw, 90px); max-width: 140px;">
          <div style="font-size: clamp(10px, 3vw, 12px); color: #666; margin-bottom: 5px;">Weight</div>
          <div style="font-size: clamp(13px, 4vw, 16px); font-weight: 600;">${data.userData.weight} kg</div>
        </div>`;
    }
    
    userDataHtml += '</div></div>';
  }
  
  // Request ID info
  const requestIdHtml = data.request_id ? `
    <div style="margin: 10px auto 0; font-size: 11px; opacity: 0.6; color: #666; text-align: center;">
      Request ID: ${data.request_id}
    </div>
  ` : '';
  
  // Build the complete HTML
  resultWrap.innerHTML = `
    <div style="position: relative; width: 100%; padding: 20px; box-sizing: border-box;">
      ${data.results && data.results.recommendedSize !== null ? `
        <div style="margin-bottom: 30px;">
          <div style="font-size:15px;color:#666;margin-bottom:8px;font-weight:500;">Recommended Size</div>
          <div style="font-size:clamp(32px, 8vw, 48px);font-weight:700;letter-spacing:1px;color:#222;margin-bottom:16px;background:#f8f8f8;border-radius:12px;padding:15px;display:inline-block;min-width:80px;">${escapeHTML(String(data.results.recommendedSize))}</div>
          <div style="font-size:13px;color:#555;margin-top:10px;">Based on your body measurements</div>
        </div>
      ` : ''}
      ${measurementsHtml}
      ${userDataHtml}
      ${requestIdHtml}
      <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; margin-top: 30px; margin-bottom: 16px;">
        ${isStoredResult ? `
          <button id="size-core-retake" style="background:#ff6f61;color:#fff;border:0;border-radius:10px;padding:clamp(10px, 3vw, 14px) clamp(15px, 4vw, 22px);font-size:clamp(14px, 3vw, 15px);font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(255,111,97,0.2);transition:all 0.2s ease;flex:1;max-width:250px;">Retake Measurements</button>
        ` : ''}
        <button id="size-core-close-after" style="background:#333;color:#fff;border:0;border-radius:10px;padding:clamp(10px, 3vw, 14px) clamp(15px, 4vw, 22px);font-size:clamp(14px, 3vw, 15px);font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s ease;flex:1;max-width:250px;">Close</button>
      </div>
    </div>
  `;
  
  const container = shell.querySelector(`#${config.WIDGET_GREETING_ID}`) || shell;
  container.innerHTML = "";
  container.appendChild(resultWrap);
  
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
      // Clear existing measurement data first
      clearMeasurementData();
      
      // Then load the flow iframe to start a new measurement
      loadFlowIframe(shell);
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
