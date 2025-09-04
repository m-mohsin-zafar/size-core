## Size Core Widget

Development setup using Vite for bundling.

### Scripts

- `npm run dev` – Start Vite dev server (serves `index.html`).
- `npm run build` – Build library output (`dist/size-core.es.js` etc.).
- `npm run preview` – Preview production build.

### Production Usage

After `npm run build`, include the generated UMD or ES module file on host pages.

```html
<script src="/dist/size-core.umd.js" data-store-id="your-store-id" data-logo="/path/to/your-logo.svg"></script>
```

### Button Design

The Size Core widget uses a modern, circular floating action button with the following characteristics:

- **Circular Shape**: Clean, modern circular design that's consistent with current UI trends
- **Logo-Only**: Uses a simple icon instead of text for a more elegant, universal interface
- **Hover Effects**: Subtle scale and shadow effects on hover for better user feedback
- **Responsive Sizing**: Automatically adjusts based on screen size
- **Consistent Styling**: Maintains brand color scheme and visual language

### Logo Configuration

The widget supports flexible logo configuration through data attributes on the script tag:

#### Logo Usage Options

1. Using the `data-logo` attribute (recommended)
```html
<script src="/dist/size-core.umd.js" data-logo="/custom/path/to/logo.svg"></script>
```

2. Default search paths (in priority order):
   - The path specified in `data-logo` attribute (if provided)
   - `/assets/logo.svg`
   - `/images/logo.svg`
   - `/logo.svg`
   - `/assets/images/logo.svg`
   - `/static/logo.svg`
   - `/public/logo.svg`

3. Fallback logo: If no logo is found, the widget will use a simple built-in SVG icon.

#### Best Practices

- Use an SVG logo for best quality and scaling
- Keep your logo simple and clean for better visibility
- For optimal performance, host your logo on the same domain as your website to avoid CORS issues

### Draggable Button Features

The floating button includes advanced user-friendly features:

- **Draggable Positioning**: Users can drag the button to any position on the screen
- **Natural Drag Movement**: The button follows the finger/cursor with intuitive directional movement
- **Position Memory**: The button remembers its position across page refreshes using localStorage
- **Edge Protection**: The button cannot be dragged off-screen
- **Mobile Optimization**: On mobile devices, the button initially positions higher to avoid navigation bars and other common UI elements
- **Touch & Click Compatibility**: Works seamlessly with both touch and mouse interactions
- **Smooth Transitions**: The button smoothly animates when hovered, but disables animations during dragging for better performance
- **Resize Handling**: Button position is validated on window resize to prevent it from getting stuck off-screen

### Mobile Optimization

The Size Core widget is carefully optimized for mobile devices:

- **Higher Initial Position**: Positioned higher on mobile screens to avoid navigation bars and other UI elements
- **Touch-Friendly Size**: Appropriately sized for touch interactions (56px diameter)
- **Smooth Touch Handling**: Separate touch event handling for reliable performance on mobile devices
- **Drag Threshold**: Small movement threshold before activating drag to allow for normal taps
- **Safe Area Insets**: Respects iOS safe area insets for notches and home indicators
- **Orientation Change Support**: Properly handles device orientation changes

### Camera Access and Permissions

The Size Core widget requires camera access to provide size recommendations. To ensure this works properly in iframe contexts:

- **Parent Page Permission Handling**: The widget now handles camera permissions at the parent page level
- **Pre-Request Mechanism**: Camera permission is requested before the iframe loads
- **Permission Status Sharing**: Permission status is communicated to the iframe
- **Message-Based Fallback**: If needed, the iframe can request permission via postMessage
- **Allow Attribute**: The iframe includes the necessary `allow="camera; microphone"` attribute

#### How Camera Permissions Work

1. When the user clicks "Start Guided Photos," the widget requests camera access
2. After permission is granted (or denied), the iframe is loaded with this status
3. The iframe can use this information to adapt its UI accordingly
4. If needed, the iframe can request permission again via postMessage

#### Troubleshooting Camera Access

If users experience issues with camera access:

- Ensure the page uses HTTPS (required for camera access)
- Make sure there are no browser extensions blocking camera access
- Check that the site doesn't have camera permissions explicitly blocked
- For testing locally, add localhost to allowed insecure origins in Chrome

### Theme Customization

You can customize the theme color of the widget by using the `data-theme-color` attribute:

```html
<script src="/dist/size-core.umd.js" data-theme-color="#00aaff"></script>
```

### Store ID Configuration

Always include your store ID for proper tracking and functionality:

```html
<script src="/dist/size-core.umd.js" data-store-id="your-store-id"></script>
```

### Button Design

The widget displays as a subtle circular button with your logo:

- Circular floating button that adapts to different screen sizes
- Displays only your logo for a clean, minimal interface
- Hover effects for better user interaction
- Shadow effects that provide depth without being intrusive
- Draggable functionality - users can position the button where they prefer
- Position persistence - remembers the user's preferred position across page loads
- Mobile-friendly positioning to avoid collisions with common UI elements

You can customize the button's appearance by providing:

1. **Your logo** via the `data-logo` attribute
2. **Theme color** via the `data-theme-color` attribute (used for the fallback logo)

```html
<script 
  src="/dist/size-core.umd.js" 
  data-store-id="your-store-id" 
  data-logo="/assets/images/your-brand-logo.svg"
  data-theme-color="#ff6f61">
</script>
```

### Full Implementation Example

```html
<script 
  src="/dist/size-core.umd.js" 
  data-store-id="your-store-id" 
  data-logo="/assets/images/your-brand-logo.svg"
  data-theme-color="#ff6f61">
</script>
```

### Advanced Usage

The widget has a robust fallback system for logo loading:

1. It tries to load the SVG specified in the `data-logo` attribute
2. If that fails, it searches common locations for logo files
3. If all attempts fail, it generates a simple SVG icon using the theme color

The widget automatically handles navigation changes in single-page applications and re-injects itself when needed.

#### Draggable Button Features

The floating button includes advanced user-friendly features:

- **Draggable Positioning**: Users can drag the button to any position on the screen
- **Natural Drag Movement**: The button follows the finger/cursor with intuitive directional movement
- **Position Memory**: The button remembers its position across page refreshes using localStorage
- **Edge Protection**: The button cannot be dragged off-screen
- **Mobile Optimization**: On mobile devices, the button initially positions higher to avoid navigation bars and other common UI elements
- **Touch & Click Compatibility**: Works seamlessly with both touch and mouse interactions
- **Smooth Transitions**: The button smoothly animates when hovered, but disables animations during dragging for better performance
- **Resize Handling**: Button position is validated on window resize to prevent it from getting stuck off-screen

Inline SVG example:

```html
<script>
window.SIZE_CORE_LOGO_INLINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="black"/><text x="24" y="28" text-anchor="middle" font-size="14" fill="white" font-family="Arial, sans-serif">SZ</text></svg>`;
</script>
<script src="/dist/size-core.umd.js"></script>
```

Or during development set an environment variable in `.env`:

```
VITE_SIZE_CORE_LOGO=/custom/path/logo.svg
```


- Refactor `rec.js` into modular source files (detection, widget, messaging, drag) and import/export cleanly.
- Add minification/terser options if needed (Vite includes esbuild minification by default).
- Optional: generate type declarations (if migrating to TypeScript).
