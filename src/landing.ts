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
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanding);
} else {
  initLanding();
}
