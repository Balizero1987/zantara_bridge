/**
 * Enhanced Visual Effects for Bali Zero Landing Page
 */

class EnhancedEffects {
    constructor() {
        this.init();
    }

    init() {
        this.createParticleSystem();
        this.createMatrixRain();
        this.createLightning();
        this.enhanceInteractions();
        this.addPerformanceOptimizations();
    }

    // Particle System
    createParticleSystem() {
        const container = document.createElement('div');
        container.className = 'particle-system';
        document.body.appendChild(container);

        setInterval(() => {
            if (container.children.length < 50) {
                this.createParticle(container);
            }
        }, 500);
    }

    createParticle(container) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position and properties
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        particle.style.animationDelay = Math.random() * 2 + 's';
        
        // Random size
        const size = 2 + Math.random() * 4;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        container.appendChild(particle);
        
        // Remove after animation
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 15000);
    }

    // Matrix Rain Effect
    createMatrixRain() {
        const container = document.createElement('div');
        container.className = 'matrix-rain';
        document.body.appendChild(container);

        const chars = '01ZANTARA3ALIBALIZEROOMBALIMBARADAM';
        
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                this.createMatrixColumn(container, chars);
            }, i * 200);
        }
    }

    createMatrixColumn(container, chars) {
        const column = document.createElement('div');
        column.className = 'matrix-column';
        
        // Random position
        column.style.left = Math.random() * 100 + '%';
        column.style.animationDuration = (8 + Math.random() * 4) + 's';
        column.style.animationDelay = Math.random() * 5 + 's';
        
        // Random characters
        let text = '';
        for (let i = 0; i < 20; i++) {
            text += chars[Math.floor(Math.random() * chars.length)] + '\n';
        }
        column.textContent = text;
        
        container.appendChild(column);
        
        // Recreate column after animation
        setTimeout(() => {
            if (column.parentNode) {
                column.parentNode.removeChild(column);
                this.createMatrixColumn(container, chars);
            }
        }, 12000);
    }

    // Lightning Effects
    createLightning() {
        const container = document.createElement('div');
        container.className = 'lightning-container';
        document.body.appendChild(container);

        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every interval
                this.createLightningBolt(container);
            }
        }, 2000);
    }

    createLightningBolt(container) {
        const bolt = document.createElement('div');
        bolt.className = 'lightning-bolt';
        
        // Random position and size
        bolt.style.left = Math.random() * 100 + '%';
        bolt.style.height = (50 + Math.random() * 200) + 'px';
        bolt.style.top = Math.random() * 50 + '%';
        bolt.style.animationDelay = Math.random() + 's';
        
        container.appendChild(bolt);
        
        // Remove after animation
        setTimeout(() => {
            if (bolt.parentNode) {
                bolt.parentNode.removeChild(bolt);
            }
        }, 4000);
    }

    // Enhanced Interactions
    enhanceInteractions() {
        // Logo hover effects
        const logoLines = document.querySelectorAll('.logo-line1, .logo-line2');
        logoLines.forEach(line => {
            line.addEventListener('mouseenter', () => {
                line.classList.add('holographic');
            });
            line.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    line.classList.remove('holographic');
                }, 1000);
            });
        });

        // Zantara container effects
        const zantaraContainer = document.querySelector('.zantara-container');
        if (zantaraContainer) {
            // Add energy wave
            const energyWave = document.createElement('div');
            energyWave.className = 'energy-wave';
            zantaraContainer.appendChild(energyWave);

            // Mouse tracking for 3D effect
            zantaraContainer.addEventListener('mousemove', (e) => {
                const rect = zantaraContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / centerY * 10;
                const rotateY = (x - centerX) / centerX * 10;
                
                zantaraContainer.style.transform = 
                    `perspective(1000px) rotateX(${-rotateX}deg) rotateY(${rotateY}deg)`;
            });

            zantaraContainer.addEventListener('mouseleave', () => {
                zantaraContainer.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
            });
        }

        // Enhanced button effects
        const ctaButton = document.querySelector('.cta-button');
        if (ctaButton) {
            ctaButton.addEventListener('mouseenter', () => {
                this.createButtonParticles(ctaButton);
            });
        }

        // Form field enhancements
        const formInputs = document.querySelectorAll('.form-input');
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                this.createInputGlow(input);
            });
        });
    }

    createButtonParticles(button) {
        const rect = button.getBoundingClientRect();
        
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = '3px';
            particle.style.height = '3px';
            particle.style.background = '#ff0000';
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '1000';
            
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            
            document.body.appendChild(particle);
            
            // Animate particle
            const animation = particle.animate([
                { transform: 'scale(0) translateY(0px)', opacity: 1 },
                { transform: 'scale(1) translateY(-20px)', opacity: 0.5 },
                { transform: 'scale(0) translateY(-40px)', opacity: 0 }
            ], {
                duration: 1000,
                easing: 'ease-out'
            });
            
            animation.onfinish = () => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            };
        }
    }

    createInputGlow(input) {
        const glow = document.createElement('div');
        glow.style.position = 'absolute';
        glow.style.top = '0';
        glow.style.left = '0';
        glow.style.right = '0';
        glow.style.bottom = '0';
        glow.style.borderRadius = '50px';
        glow.style.background = 'radial-gradient(circle, rgba(255,0,0,0.2) 0%, transparent 70%)';
        glow.style.pointerEvents = 'none';
        glow.style.zIndex = '-1';
        
        input.style.position = 'relative';
        if (!input.querySelector('.input-glow')) {
            glow.className = 'input-glow';
            input.appendChild(glow);
        }
    }

    // Performance Optimizations
    addPerformanceOptimizations() {
        // Reduce effects on low-performance devices
        if (navigator.hardwareConcurrency < 4) {
            const particleSystem = document.querySelector('.particle-system');
            const matrixRain = document.querySelector('.matrix-rain');
            
            if (particleSystem) particleSystem.style.display = 'none';
            if (matrixRain) matrixRain.style.display = 'none';
        }

        // Pause animations when page is not visible
        document.addEventListener('visibilitychange', () => {
            const animations = document.querySelectorAll('.particle, .matrix-column, .lightning-bolt');
            animations.forEach(el => {
                if (document.hidden) {
                    el.style.animationPlayState = 'paused';
                } else {
                    el.style.animationPlayState = 'running';
                }
            });
        });

        // Add GPU acceleration classes
        const acceleratedElements = document.querySelectorAll(
            '.spiral-ring, .zantara-image-container, .particle, .matrix-column'
        );
        acceleratedElements.forEach(el => {
            el.classList.add('gpu-accelerated');
        });
    }

    // Cosmic Background Generator
    createCosmicBackground() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-3';
        canvas.style.pointerEvents = 'none';
        
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const drawCosmic = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Cosmic nebula effect
            const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
            );
            
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
            gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.05)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            requestAnimationFrame(drawCosmic);
        };
        
        drawCosmic();
        
        // Resize handler
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }
}

// Initialize effects when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add cyberpunk grid
    const grid = document.createElement('div');
    grid.className = 'cyber-grid';
    document.body.appendChild(grid);
    
    // Initialize enhanced effects
    const effects = new EnhancedEffects();
    
    // Mark animations as ready
    setTimeout(() => {
        document.body.classList.add('animation-ready');
    }, 500);
    
    // Create cosmic background
    effects.createCosmicBackground();
});