# Changelog

## v0.3.0 (Current)

### Features
- Implemented fully responsive widget design that adapts to different device types
- Added desktop-specific modal view with overlay background
- Mobile/tablet displays now use full-screen layout for better experience
- Improved widget animations with device-specific transitions
- Enhanced UI spacing and layout for better usability across devices
- Updated iframe handling to better fit different screen sizes
- Improved connecting UI with responsive design
- Added responsive measurements display using flexbox

### Fixes
- Fixed issue where widget wouldn't reopen after being closed without page refresh
- Fixed "Retake Measurements" button not providing fresh measurements
- Improved spacing between logo and text in the button using flex with gap
- Fixed various CSS layout issues for better cross-device compatibility
- Enhanced iframe embedding for better performance and appearance

## v0.2.1

### Fixes
- Fixed critical issue with button clicks not working after the first click
- Improved touch event handling to properly distinguish between taps and drags
- Enhanced event propagation management to prevent conflicts between drag and click events
- Added proper event cleanup and state reset after interactions
- Fixed issue with hover effects not being applied properly

## v0.2.0 

### Features
- Complete redesign of the button to a circular, logo-only style
- Added draggable functionality with position memory across page refreshes
- Improved mobile compatibility with touch-specific event handling
- Fixed issues with drag direction for more intuitive movement
- Added position validation to keep button within screen boundaries
- Enhanced responsiveness for different screen sizes and orientations
- Added resize handling to prevent button from moving off-screen
- Improved SVG logo handling with fallback options

### Fixes
- Fixed issue with mobile click events not firing properly
- Corrected drag direction to match finger/cursor movement
- Fixed potential issues with multiple touch points
- Improved error handling throughout the codebase
- Fixed positioning when transitioning between mobile and desktop views
