# Size Core Widget - Iframe Communication

This document explains how to set up communication between your Next.js app running in the iframe and the parent Size Core widget.

## How It Works

The communication system uses the browser's `postMessage` API to safely communicate between the iframe and the parent page. This allows you to:

1. Send data from your Next.js app to the parent widget
2. Receive data from the parent widget in your Next.js app
3. Respond to events and trigger actions across frame boundaries

## Implementation in the Next.js App (Iframe)

### 1. Create a Communication Hook

First, implement a React hook in your Next.js app that handles the communication:

```jsx
// components/ParentCommunication.js
import { useEffect, useCallback } from 'react';

export function useParentCommunication() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  // Send message to parent
  const sendToParent = useCallback((type, payload) => {
    if (!isInIframe) return false;
    
    try {
      window.parent.postMessage({ type, payload }, '*'); // In production, specify target origin
      return true;
    } catch (err) {
      console.error('Error sending message to parent:', err);
      return false;
    }
  }, [isInIframe]);
  
  // Set up listener for parent messages
  useEffect(() => {
    if (!isInIframe) return;
    
    // Let parent know we're ready
    sendToParent('WIDGET_READY', { timestamp: Date.now() });
    
    // Listen for messages from parent
    const handleParentMessage = (event) => {
      // In production, validate event.origin
      try {
        const { type, payload } = event.data;
        
        if (!type) return;
        
        console.log('Received from parent:', type);
        
        switch (type) {
          case 'PARENT_READY':
            console.log('Parent is ready with data:', payload);
            break;
            
          // Add other message types as needed
          
          default:
            console.log('Unknown message type from parent:', type);
        }
      } catch (err) {
        console.error('Error processing parent message:', err);
      }
    };
    
    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, [isInIframe, sendToParent]);
  
  // Return methods that components can use
  return {
    isInIframe,
    sendSizeRecommendation: (data) => sendToParent('SIZE_RECOMMENDATION', data),
    sendUserMeasurements: (data) => sendToParent('USER_MEASUREMENTS', data),
    sendUserProfile: (data) => sendToParent('USER_PROFILE', data),
    requestClose: () => sendToParent('CLOSE_WIDGET', { reason: 'user_requested' })
  };
}
```

### 2. Use the Hook in Your Components

```jsx
import { useEffect } from 'react';
import { useParentCommunication } from '../components/ParentCommunication';

export default function SizeResultPage({ recommendation }) {
  const { sendSizeRecommendation, requestClose } = useParentCommunication();
  
  // Send recommendation when available
  useEffect(() => {
    if (recommendation) {
      sendSizeRecommendation(recommendation);
    }
  }, [recommendation, sendSizeRecommendation]);
  
  return (
    <div>
      <h1>Your Recommended Size: {recommendation.size}</h1>
      <button onClick={requestClose}>Close</button>
    </div>
  );
}
```

## Message Types

The communication system supports these message types:

### From Iframe to Parent:

1. `WIDGET_READY`: Indicates the iframe has loaded and is ready to communicate
2. `SIZE_RECOMMENDATION`: Sends size recommendation data to the parent
3. `USER_MEASUREMENTS`: Sends user measurement data to the parent
4. `USER_PROFILE`: Sends user profile data to the parent
5. `CLOSE_WIDGET`: Requests the parent to close the widget

### From Parent to Iframe:

1. `PARENT_READY`: Indicates the parent is ready to receive messages
2. (Add more as needed for your specific use case)

## Accessing Data in the Parent Page

The parent Size Core widget exposes events and methods to access data received from the iframe:

### 1. Using Custom Events

```javascript
document.addEventListener('size-core:recommendation_received', (event) => {
  const recommendation = event.detail;
  console.log('Recommended size:', recommendation.size);
});
```

### 2. Using the API (If using the global sizeCore object)

```javascript
// Access the most recent data
const recommendation = window.sizeCore.getIframeData('recommendations');

// Use the data
if (recommendation) {
  console.log('Recommended size:', recommendation.size);
}
```

## Security Considerations

1. **Origin Validation**: Always validate the origin of messages in production
2. **Sanitize Data**: Never trust data received from postMessage without validation
3. **Minimize Data**: Only pass necessary data between frames

## Example Data Formats

### Size Recommendation

```javascript
{
  size: "M",
  confidence: 0.92,
  alternativeSizes: ["S", "L"],
  productId: "12345"
}
```

### User Measurements

```javascript
{
  height: 175, // cm
  weight: 70,  // kg
  chest: 95,   // cm
  waist: 80,   // cm
  hips: 95,    // cm
  // Additional measurements as needed
}
```

### User Profile

```javascript
{
  userId: "user_123",
  preferences: {
    fit: "slim",
    style: "casual"
  },
  savedMeasurements: true
}
```
