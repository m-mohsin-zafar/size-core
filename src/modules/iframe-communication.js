import { config } from './config.js';
import { log } from './utils.js';
import { resolveProductId } from './product-detection.js';
import { closeWidget } from './widget.js';

// Import for our new connecting UI
let showConnectingUI;
import('./widget-connect.js').then(module => {
  showConnectingUI = module.showConnectingUI;
});

/**
 * Data storage for iframe data
 */
let iframeData = {
  recommendations: null,
  measurements: null,
  userProfile: null,
  sallaStoreId: null, // Store ID from Salla
  sallaConnected: null, // SALLA_CONNECTED message data
  sallaResults: null, // SALLA_RESULTS message data
  sallaError: null, // SALLA_ERROR message data
  keyType: null // 'production' or 'development'
};

/**
 * Get data received from the iframe
 */
export function getIframeData(key) {
  return key ? iframeData[key] : iframeData;
}

/**
 * Set up message listener to receive data from the iframe
 */
export function setupIframeMessageListener(frame) {
  // Log that we're setting up the listener
  log('Setting up iframe message listener');
  
  window.addEventListener('message', function(event) {
    // Only log messages with a type to avoid excessive logging
    const data = event.data;
    if (data && data.type) {
      log('Received message type:', data.type);
    }
    
    try {
      // Handle different message types
      if (!data || !data.type) return;
      
      switch (data.type) {
        case 'SALLA_CONNECTED':
          // Handle Salla connected message
          log('⭐ Received SALLA_CONNECTED message from:', event.origin);
          log('⭐ Salla connected data:', data);
          
          if (data.storeId) {
            iframeData.sallaStoreId = data.storeId;
            iframeData.sallaConnected = data;
            iframeData.keyType = data.key_type;
            
            // Show the connecting UI if showConnectingUI is loaded
            if (showConnectingUI) {
              showConnectingUI();
            }
            
            // Dispatch custom event
            dispatchWidgetEvent('salla_connected', data);
            
            // No alert, just log
            log('Salla Store Connected - Store ID:', data.storeId, 'Environment:', data.key_type || 'unknown');
          }
          break;
          
        case 'SALLA_RESULTS':
          // Handle Salla results message
          log('⭐ Received SALLA_RESULTS message from:', event.origin);
          log('⭐ Salla results data:', data);
          
          iframeData.sallaResults = data;
          
          // Update measurements and recommendations data
          if (data.results && data.results.measurements) {
            iframeData.measurements = data.results.measurements;
          }
          
          // Persist the data to localStorage
          persistIframeData();
          
          // Dispatch custom event
          dispatchWidgetEvent('salla_results', data);
          break;
          
        case 'SALLA_ERROR':
          // Handle Salla error message
          log('⭐ Received SALLA_ERROR message from:', event.origin);
          log('⭐ Salla error data:', data);
          
          iframeData.sallaError = data;
          
          // Dispatch custom event
          dispatchWidgetEvent('salla_error', data);
          break;
          
        case 'SIZE_RECOMMENDATION':
          // Store the recommendation data
          iframeData.recommendations = data.payload;
          // Trigger any callback or event for recommendation received
          dispatchWidgetEvent('recommendation_received', data.payload);
          break;
          
        case 'USER_MEASUREMENTS':
          // Store the user measurements
          iframeData.measurements = data.payload;
          dispatchWidgetEvent('measurements_received', data.payload);
          break;
          
        case 'USER_PROFILE':
          // Store the user profile data
          iframeData.userProfile = data.payload;
          dispatchWidgetEvent('profile_received', data.payload);
          break;
          
        case 'CLOSE_WIDGET':
          // Handle request to close the widget
          closeWidget();
          break;
          
        case 'WIDGET_READY':
          // Iframe is ready to receive messages
          log('Iframe is ready to receive messages');
          // You can send any initial data here
          sendMessageToIframe({ 
            type: 'PARENT_READY',
            payload: {
              pageUrl: window.location.href,
              productId: resolveProductId()
            }
          });
          break;
          
        default:
          log('Unknown message type from iframe:', data.type);
      }
    } catch (err) {
      log('Error processing message from iframe:', err);
    }
  });
}

/**
 * Send data to the iframe
 */
export function sendMessageToIframe(messageData) {
  const frame = document.getElementById(config.WIDGET_IFRAME_ID);
  if (!frame) {
    log('Cannot send message - iframe not found');
    return false;
  }
  
  try {
    const iframeOrigin = new URL(config.EXTERNAL_FLOW_BASE).origin;
    frame.contentWindow.postMessage(messageData, iframeOrigin);
    log('Sent message to iframe:', messageData.type);
    return true;
  } catch (err) {
    log('Error sending message to iframe:', err);
    return false;
  }
}

/**
 * Store iframe data in localStorage for persistence between sessions
 */
function persistIframeData() {
  try {
    // Only store what we need to persist
    const dataToStore = {
      sallaStoreId: iframeData.sallaStoreId,
      sallaConnected: iframeData.sallaConnected,
      sallaResults: iframeData.sallaResults,
      measurements: iframeData.measurements,
      userProfile: iframeData.userProfile,
      keyType: iframeData.keyType
    };
    
    localStorage.setItem('size-core-data', JSON.stringify(dataToStore));
    log('Data persisted to localStorage');
  } catch (err) {
    log('Error persisting data to localStorage:', err);
  }
}

/**
 * Load iframe data from localStorage
 */
function loadPersistedIframeData() {
  try {
    const storedData = localStorage.getItem('size-core-data');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      
      // Update our iframeData with stored values
      if (parsedData.sallaStoreId) iframeData.sallaStoreId = parsedData.sallaStoreId;
      if (parsedData.sallaConnected) iframeData.sallaConnected = parsedData.sallaConnected;
      if (parsedData.sallaResults) iframeData.sallaResults = parsedData.sallaResults;
      if (parsedData.measurements) iframeData.measurements = parsedData.measurements;
      if (parsedData.userProfile) iframeData.userProfile = parsedData.userProfile;
      if (parsedData.keyType) iframeData.keyType = parsedData.keyType;
      
      log('Loaded persisted data from localStorage');
      return true;
    }
  } catch (err) {
    log('Error loading persisted data from localStorage:', err);
  }
  return false;
}

/**
 * Clear stored measurement data to force a fresh measurement flow
 */
export function clearMeasurementData() {
  try {
    // Preserve only the store ID and key type
    const storeId = iframeData.sallaStoreId;
    const connected = iframeData.sallaConnected;
    const keyType = iframeData.keyType;
    
    // Clear measurement and results data
    iframeData.sallaResults = null;
    iframeData.measurements = null;
    iframeData.userProfile = null;
    
    // Update localStorage with the cleared data
    const dataToStore = {
      sallaStoreId: storeId,
      sallaConnected: connected,
      keyType: keyType
    };
    
    localStorage.setItem('size-core-data', JSON.stringify(dataToStore));
    log('Measurement data cleared for retake');
  } catch (err) {
    log('Error clearing measurement data:', err);
  }
}

/**
 * Dispatch a custom event when iframe data is received
 */
function dispatchWidgetEvent(eventName, data) {
  const event = new CustomEvent('size-core:' + eventName, {
    detail: data,
    bubbles: true
  });
  document.dispatchEvent(event);
}

/**
 * Initialize global message listener for any messages, not just from iframes
 * This ensures we can receive messages even before an iframe is loaded
 */
export function initGlobalMessageListener() {
  // Skip if we've already initialized the listener
  if (window.__sizeCoreMessageListenerInitialized) {
    log('Global message listener already initialized - skipping');
    return;
  }
  
  // Try to load persisted data first
  loadPersistedIframeData();
  
  // Set up a global listener that doesn't require an iframe reference
  log('⚡ Initializing global message listener');
  
  // First remove any existing listeners to avoid duplicates
  try {
    window.removeEventListener('message', window.__sizeCoreMessageHandler);
  } catch (err) {
    // Ignore errors, just means no previous handler
  }
  
  // Create a named handler so we can remove it later if needed
  window.__sizeCoreMessageHandler = function(event) {
    // Only log messages with a type and don't log self-test messages
    const data = event.data;
    if (data && data.type && data.type !== 'SIZE_CORE_TEST') {
      log('Global message received:', event.origin, data.type);
    }
    
    try {
      // Handle Salla messages
      if (data && data.type) {
        switch (data.type) {
          case 'SALLA_CONNECTED':
            log('⭐ Received SALLA_CONNECTED message in global listener:', event.origin);
            log('⭐ Salla connected data:', data);
            
            if (data.storeId) {
              iframeData.sallaStoreId = data.storeId;
              iframeData.sallaConnected = data;
              iframeData.keyType = data.key_type;
              
              // Dispatch custom event
              dispatchWidgetEvent('salla_connected', data);
              
              // Just log, no alerts
              console.log('📢 SALLA_CONNECTED received in global listener:', data);
              
              // Optionally open the widget to show connection status
              if (typeof window.sizeCore !== 'undefined' && window.sizeCore.showSallaStatus && !window.__sizeCoreWidgetManuallyClosed) {
                window.sizeCore.showSallaStatus(data);
              }
            }
            break;
            
          case 'SALLA_RESULTS':
            log('⭐ Received SALLA_RESULTS message in global listener:', event.origin);
            log('⭐ Salla results data:', data);
            
            iframeData.sallaResults = data;
            
            // Update measurements and recommendations data
            if (data.results && data.results.measurements) {
              iframeData.measurements = data.results.measurements;
            }
            
            // Persist the data to localStorage
            persistIframeData();
            
            // Dispatch custom event
            dispatchWidgetEvent('salla_results', data);
            
            console.log('📢 SALLA_RESULTS received in global listener:', data);
            
            // Optionally show results in the widget if not manually closed
            if (typeof window.sizeCore !== 'undefined' && window.sizeCore.showSallaRecommendation && !window.__sizeCoreWidgetManuallyClosed) {
              window.sizeCore.showSallaRecommendation(data);
            }
            break;
            
          case 'SALLA_ERROR':
            log('⭐ Received SALLA_ERROR message in global listener:', event.origin);
            log('⭐ Salla error data:', data);
            
            iframeData.sallaError = data;
            
            // Dispatch custom event
            dispatchWidgetEvent('salla_error', data);
            
            console.log('📢 SALLA_ERROR received in global listener:', data);
            
            // Optionally show error in the widget if not manually closed
            if (typeof window.sizeCore !== 'undefined' && window.sizeCore.showSallaError && !window.__sizeCoreWidgetManuallyClosed) {
              window.sizeCore.showSallaError(data);
            }
            break;
        }
      }
    } catch (err) {
      log('Error processing global message:', err);
    }
  };
  
  window.addEventListener('message', window.__sizeCoreMessageHandler);
  log('Global message listener initialized');
  
  // Mark as initialized to prevent duplicate initialization
  window.__sizeCoreMessageListenerInitialized = true;
  
  // Disable the self-test message which was causing noise in the logs
  // Uncomment for debugging if needed
  /*
  setTimeout(() => {
    try {
      log('Sending test message to self');
      window.postMessage({ type: 'SIZE_CORE_TEST', message: 'Testing message listener' }, '*');
    } catch (err) {
      log('Error sending test message:', err);
    }
  }, 500);
  */
}
