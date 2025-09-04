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
- **Position Memory**: The button remembers its position across page refreshes using localStorage
- **Edge Protection**: The button cannot be dragged off-screen
- **Mobile Optimization**: On mobile devices, the button initially positions higher to avoid navigation bars and other common UI elements
- **Smooth Transitions**: The button smoothly animates when hovered, but disables animations during dragging for better performance

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
