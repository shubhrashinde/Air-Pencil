import './styles/main.css';
import './styles/ui.css';
import './styles/canvas.css';

import { DrawingApp } from './apps/DrawingApp';
import { FingerCounterApp } from './apps/FingerCounterApp';
import { RockPaperScissorsApp } from './apps/RockPaperScissorsApp';
import { TicTacToeApp } from './apps/TicTacToeApp';
import { CalculatorApp } from './apps/CalculatorApp';
import { PuzzleApp } from './apps/PuzzleApp';
import { HandTrackingEngine } from './core/HandTrackingEngine';
import { BaseApp } from './core/BaseApp';

const initApp = () => {
  const video = document.getElementById('webcam') as HTMLVideoElement;
  const drawingContainer = document.getElementById('drawingAppContainer') as HTMLElement;
  const drawingControls = document.getElementById('drawingControls') as HTMLElement;
  const dynamicContainer = document.getElementById('dynamicAppContainer') as HTMLElement;
  const appSelector = document.getElementById('appSelector') as HTMLSelectElement;
  
  if (!video || !appSelector) return;

  const engine = HandTrackingEngine.getInstance();
  
  // App Instances
  const apps: Record<string, BaseApp> = {
    'drawing': new DrawingApp(),
    'fingercounter': new FingerCounterApp(),
    'rps': new RockPaperScissorsApp(),
    'tictactoe': new TicTacToeApp(),
    'calculator': new CalculatorApp(),
    'puzzle': new PuzzleApp(),
  };

  let currentApp: BaseApp | null = null;

  const switchApp = (appId: string) => {
    if (currentApp) {
      currentApp.stop();
    }
    
    currentApp = apps[appId];
    if (currentApp) {
      if (appId === 'drawing') {
        if (drawingContainer) drawingContainer.style.display = 'block';
        if (drawingControls) drawingControls.style.display = 'flex';
        if (dynamicContainer) dynamicContainer.style.display = 'none';
        currentApp.start(drawingContainer);
      } else {
        if (drawingContainer) drawingContainer.style.display = 'none';
        if (drawingControls) drawingControls.style.display = 'none';
        if (dynamicContainer) dynamicContainer.style.display = 'block';
        currentApp.start(dynamicContainer);
      }
    }
  };

  appSelector.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    switchApp(target.value);
  });

  // Start engine
  engine.start(video).then(() => {
    // Start default app
    switchApp('drawing');
  }).catch((err) => {
    console.error(err);
    // Could show a global error here
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
