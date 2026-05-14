/**
 * Kalakroti Rugs - Global Loading System
 * A premium, hardware-accelerated cinematic loading experience.
 */

const KalakrotiLoader = (function() {
    // --- SVG Assets ---
    // Minimalist, elegant silhouette paths
    const SVG_CHARACTER = `
    <svg viewBox="0 0 100 150" class="klk-character-svg" aria-hidden="true">
        <!-- Main Body -->
        <path d="M50 30 C 35 30 20 60 25 110 C 27 130 40 140 50 140 C 60 140 73 130 75 110 C 80 60 65 30 50 30 Z" />
        <!-- Head -->
        <circle cx="50" cy="15" r="12" />
        <!-- Stylized Hair/Headwrap -->
        <path d="M40 5 C 45 0 55 0 60 5 C 65 10 65 15 60 15 C 50 12 40 15 40 15 C 35 15 35 10 40 5 Z" />
        <!-- Scarf Tail (Animated) -->
        <g class="klk-scarf-tail">
            <path d="M60 40 C 70 45 90 70 85 90 C 80 100 70 80 65 50 Z" />
        </g>
    </svg>`;

    const SVG_CARPET = `
    <svg viewBox="0 0 200 60" class="klk-carpet-svg" aria-hidden="true">
        <!-- Carpet Base -->
        <path d="M 10 30 Q 50 10 100 25 T 190 30 Q 150 50 100 35 T 10 30 Z" />
        <!-- Tassels -->
        <path d="M 10 30 L 0 35 M 10 30 L 5 40 M 190 30 L 200 35 M 190 30 L 195 40" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

    // --- State ---
    let overlayEl = null;
    let textInterval = null;
    let currentTexts = [];
    let textIndex = 0;

    // Default luxury phrases
    const DEFAULT_PHRASES = [
        "Weaving your experience...",
        "Summoning the carpet...",
        "Crafting your journey...",
        "Finding the perfect piece..."
    ];

    // --- DOM Construction ---
    function createLoaderDOM(isInline = false) {
        const container = document.createElement('div');
        container.className = 'klk-loader-container';
        
        container.innerHTML = `
            <div class="klk-carpet-wrapper">
                ${SVG_CARPET}
            </div>
        `;
        return container;
    }

    function initOverlay() {
        if (overlayEl) return;
        
        overlayEl = document.createElement('div');
        overlayEl.className = 'klk-loader-overlay';
        overlayEl.setAttribute('role', 'alert');
        overlayEl.setAttribute('aria-busy', 'true');

        const container = createLoaderDOM();
        
        const textContainer = document.createElement('div');
        textContainer.className = 'klk-loader-text-container';
        
        const textEl = document.createElement('div');
        textEl.className = 'klk-loader-text klk-active';
        textEl.id = 'klk-global-text';
        
        textContainer.appendChild(textEl);
        overlayEl.appendChild(container);
        overlayEl.appendChild(textContainer);
        
        document.body.appendChild(overlayEl);
    }

    // --- Text Cycling ---
    function cycleText() {
        if (!currentTexts || currentTexts.length <= 1) return;
        
        const textEl = document.getElementById('klk-global-text');
        if (!textEl) return;

        textEl.classList.remove('klk-active');
        
        setTimeout(() => {
            textIndex = (textIndex + 1) % currentTexts.length;
            textEl.textContent = currentTexts[textIndex];
            textEl.classList.add('klk-active');
        }, 500); // Wait for fade out
    }

    // --- Public API ---
    return {
        /**
         * Show the cinematic fullscreen loader
         * @param {Array<string>|string} phrases - Text or array of texts to cycle
         */
        showFullscreen: function(phrases = DEFAULT_PHRASES) {
            initOverlay();
            
            currentTexts = Array.isArray(phrases) ? phrases : [phrases];
            textIndex = 0;
            
            const textEl = document.getElementById('klk-global-text');
            textEl.textContent = currentTexts[0];
            textEl.classList.add('klk-active');

            if (textInterval) clearInterval(textInterval);
            if (currentTexts.length > 1) {
                textInterval = setInterval(cycleText, 3000);
            }

            // Force reflow
            void overlayEl.offsetWidth;
            overlayEl.classList.add('klk-active');
            document.body.style.overflow = 'hidden';
        },

        /**
         * Hide the fullscreen loader
         */
        hideFullscreen: function() {
            if (!overlayEl) return;
            overlayEl.classList.remove('klk-active');
            document.body.style.overflow = '';
            
            if (textInterval) {
                clearInterval(textInterval);
                textInterval = null;
            }
        },

        /**
         * Inject an inline loader into a specific container
         * @param {HTMLElement} targetEl - The container to inject into
         * @param {string} text - Optional text to display next to the loader
         */
        injectInline: function(targetEl, text = "Loading...") {
            if (!targetEl) return;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'klk-inline-loader';
            wrapper.innerHTML = `
                ${createLoaderDOM(true).outerHTML}
                <div class="klk-loader-text-container">
                    <div class="klk-loader-text klk-active" style="position:static; transform:none; opacity:1;">${text}</div>
                </div>
            `;
            
            targetEl.innerHTML = '';
            targetEl.appendChild(wrapper);
        },

        /**
         * Transform a button into a loading state
         * @param {HTMLButtonElement} btn - The button to transform
         */
        startButtonLoad: function(btn) {
            if (!btn || btn.hasAttribute('data-loading')) return;
            
            const originalWidth = btn.offsetWidth;
            const originalText = btn.innerHTML;
            
            btn.setAttribute('data-loading', 'true');
            btn.setAttribute('data-original-text', originalText);
            btn.style.width = originalWidth + 'px'; // Fix width to prevent jank
            btn.classList.add('klk-btn-loading');
            
            const loaderWrapper = document.createElement('div');
            loaderWrapper.className = 'klk-btn-loader-wrapper';
            loaderWrapper.innerHTML = createLoaderDOM(true).outerHTML;
            
            btn.appendChild(loaderWrapper);
            btn.disabled = true;
        },

        /**
         * Restore a button from loading state
         * @param {HTMLButtonElement} btn - The button to restore
         */
        stopButtonLoad: function(btn) {
            if (!btn || !btn.hasAttribute('data-loading')) return;
            
            btn.innerHTML = btn.getAttribute('data-original-text');
            btn.removeAttribute('data-loading');
            btn.removeAttribute('data-original-text');
            btn.style.width = '';
            btn.classList.remove('klk-btn-loading');
            btn.disabled = false;
        }
    };
})();

// Export for module environments if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KalakrotiLoader;
}
