# Kalakroti Rugs Global Loading System

## Overview
A premium, cinematic, and hardware-accelerated global loading architecture built specifically for the Kalakroti Rugs ecommerce platform. It features a bespoke vector silhouette of an Arabian fantasy character and a magical flying carpet, fully orchestrated via CSS and JavaScript without heavy dependencies like Lottie or canvas.

## Files Included
1. \`loader.css\` - The CSS animation engine, layout styling, and accessibility fallbacks.
2. \`loader.js\` - The JavaScript orchestration layer containing the SVG architecture and reusable API.

## Installation & Setup

Include the CSS and JS files in your base HTML or Django template (\`base.html\`):

\`\`\`html
<!-- In the <head> -->
<link rel="stylesheet" href="/loader.css">

<!-- Before closing </body> -->
<script src="/loader.js"></script>
\`\`\`

---

## The Reusable Loader API

The system exposes a global \`KalakrotiLoader\` object with four primary methods.

### 1. Fullscreen Cinematic Loader
Use this for major page transitions, checkout processing, and authentication states.

\`\`\`javascript
// Show loader with default rotating luxury phrases
KalakrotiLoader.showFullscreen();

// Show loader with custom rotating phrases
KalakrotiLoader.showFullscreen([
    "Authenticating your session...",
    "Unrolling the carpet...",
    "Preparing your dashboard..."
]);

// Show with a static phrase
KalakrotiLoader.showFullscreen("Processing your payment...");

// Hide the loader
KalakrotiLoader.hideFullscreen();
\`\`\`

### 2. Inline Loader
Use this inside empty containers while fetching data (e.g., product grids, search results).

\`\`\`javascript
const gridContainer = document.getElementById('results-grid');

// Inject the inline loader
KalakrotiLoader.injectInline(gridContainer, "Weaving your collection...");

// Later, replace the container's innerHTML with the actual fetched data.
\`\`\`

### 3. Button Action Loader
Use this for add-to-cart, wishlist, and form submission buttons. It prevents double-clicking and provides immediate micro-interaction feedback.

\`\`\`javascript
const addToCartBtn = document.getElementById('add-to-cart');

addToCartBtn.addEventListener('click', async () => {
    // Start button loading state
    KalakrotiLoader.startButtonLoad(addToCartBtn);
    
    try {
        await submitCartToAPI(); // Your async DRF call
    } finally {
        // Restore the button
        KalakrotiLoader.stopButtonLoad(addToCartBtn);
    }
});
\`\`\`

---

## Django & DRF Integration Examples

### Example: Django Template Form Submission (Authentication)
If using standard Django form posts, you can intercept the submit event to show the loader before the browser navigates away.

\`\`\`html
<form id="login-form" method="POST" action="{% url 'login' %}">
    {% csrf_token %}
    <!-- form fields -->
    <button type="submit" class="btn btn-solid w-full">Sign In</button>
</form>

<script>
document.getElementById('login-form').addEventListener('submit', function() {
    KalakrotiLoader.showFullscreen([
        "Verifying credentials...",
        "Unlocking your collection..."
    ]);
});
</script>
\`\`\`

### Example: DRF Async Fetching (Filters)
When applying filters via DRF, use the inline loader.

\`\`\`javascript
async function fetchFilteredProducts(filters) {
    const grid = document.getElementById('product-grid');
    
    // 1. Show inline loading
    KalakrotiLoader.injectInline(grid, "Finding the perfect piece...");
    
    try {
        // 2. Fetch from DRF
        const response = await fetch(\`/api/products/?space=\${filters.space}\`);
        const data = await response.json();
        
        // 3. Render HTML
        renderProducts(grid, data.results);
    } catch (error) {
        grid.innerHTML = '<p>Failed to load collection.</p>';
    }
}
\`\`\`

---

## Design & Architecture Principles

### Mobile Responsiveness
The loader utilizes CSS \`transform\` for all animations, ensuring zero layout thrashing. The fullscreen wrapper uses \`flexbox\` to maintain perfect center-alignment regardless of the viewport dimensions. Inline and button variants use strictly scaled fixed-dimensions to prevent breaking parent flex/grid layouts on mobile.

### Reduced Motion Accessibility
Built-in support for users who prefer reduced motion. If the OS setting is active (\`prefers-reduced-motion: reduce\`), the system automatically disables the infinite orbiting and floating animations, presenting a static but elegant illustration instead.

### Production Optimization Recommendations
1. **Asset Preloading:** If the loader is critical to the first paint, preload the CSS file in the \`<head>\` using \`<link rel="preload" href="/loader.css" as="style">\`.
2. **Minification:** Minify \`loader.js\` and \`loader.css\` in the production build pipeline. The current JS is lightweight, but removing whitespace will shave bytes.
3. **Hardware Acceleration:** The CSS animations strictly use \`transform\` (translate, scale, rotate) and \`opacity\`. This guarantees the browser will offload the animation to the GPU, preventing CPU spikes and maintaining 60fps on low-end mobile devices.
