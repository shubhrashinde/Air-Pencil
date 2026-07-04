import './styles/main.css';
import './styles/landing.css';
import { ColorBends } from './core/ColorBends';

const initLanding = () => {
  const landingView = document.getElementById('landingView');
  
  if (landingView) {
    // Start the background effect
    new ColorBends(landingView, {
      colors: ["#b48aff", "#ff6b9d", "#4cc9f0"],
      rotation: 90,
      speed: 0.2,
      scale: 1,
      frequency: 1,
      warpStrength: 1,
      mouseInfluence: 1,
      noise: 0.15,
      parallax: 0.5,
      iterations: 1,
      intensity: 1.5,
      bandWidth: 6,
      transparent: true,
    });
  }

  // Coffee Modal Logic
  const coffeeBtn = document.getElementById('coffeeBtn');
  const coffeeModal = document.getElementById('coffeeModal');
  const closeCoffeeBtn = document.getElementById('closeCoffeeBtn');

  if (coffeeBtn && coffeeModal && closeCoffeeBtn) {
    coffeeBtn.addEventListener('click', () => {
      coffeeModal.style.display = 'flex';
      // Force a reflow so the transition applies after display changes
      void coffeeModal.offsetWidth;
      coffeeModal.classList.remove('hidden');
    });

    closeCoffeeBtn.addEventListener('click', () => {
      coffeeModal.classList.add('hidden');
      setTimeout(() => {
        coffeeModal.style.display = 'none';
      }, 300); // matches transition time
    });

    coffeeModal.addEventListener('click', (e) => {
      if (e.target === coffeeModal) {
        coffeeModal.classList.add('hidden');
        setTimeout(() => {
          coffeeModal.style.display = 'none';
        }, 300);
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanding);
} else {
  initLanding();
}
