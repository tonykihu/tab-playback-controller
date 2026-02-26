// Scroll-triggered animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .premium-card, .pricing-card, .install-card').forEach((el, i) => {
    el.style.transitionDelay = `${i % 3 * 100}ms`;
    observer.observe(el);
});

// Smooth nav background on scroll
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        nav.style.borderBottomColor = 'rgba(255, 255, 255, 0.08)';
    } else {
        nav.style.borderBottomColor = 'rgba(255, 255, 255, 0.04)';
    }
}, { passive: true });

// Plausible Analytics (add this script tag to index.html when ready)
// <script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
