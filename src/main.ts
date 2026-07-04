import './styles/main.css';
import './styles/ui.css';
import './styles/canvas.css';

import { CanvasRenderer } from './core/CanvasRenderer';
import { UIManager } from './core/UIManager';
import { HandTracker } from './core/HandTracker';
import { state } from './core/State';
import type { Results, NormalizedLandmark } from '@mediapipe/hands';

const initApp = () => {
  // Add modal open state to core state if not already there, or just track locally
  let isModalOpen = false;

  const video = document.getElementById('webcam') as HTMLVideoElement;
  const canvas = document.getElementById('paintCanvas') as HTMLCanvasElement;

  const renderer = new CanvasRenderer(canvas);
  const uiManager = new UIManager(renderer);

  // Swipe & gesture detection state
  let openPalmStartTime = 0;
  let lastWristX = 0;
  let lastTime = 0;
  
  // Two-hand transform state
  let initialPinchDist = 0;
  let initialScale = 1;
  let prevPinchCenterX = 0;
  let prevPinchCenterY = 0;
  let isZoomPanning = false;

  // Smoothing states for depth
  let smoothedDepthScale = 1.0;

  const isFingerExtended = (tip: NormalizedLandmark, pip: NormalizedLandmark, wrist: NormalizedLandmark) => {
    // Back to wrist distance, which is more reliable in 2D than MCP
    const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    return dTip > dPip;
  };
  
  const getPinchInfo = (landmarks: NormalizedLandmark[]) => {
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const indexBase = landmarks[5];
    const wrist = landmarks[0];
    
    // Pinch distance
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dist = Math.hypot(dx, dy);
    
    // Hand scale relative to screen to normalize pinch threshold
    const handSize = Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y);
    const pinchThreshold = handSize * 0.25; // Proper threshold to avoid accidental pinches
    
    // Map center point to screen coords with aspect ratio correction
    // The video stream from MediaPipe is usually 16:9
    const videoAspect = 16 / 9;
    const canvasAspect = canvas.width / canvas.height;
    
    let normX = 1 - ((indexTip.x + thumbTip.x) / 2); // Flipped X
    let normY = (indexTip.y + thumbTip.y) / 2;
    
    if (canvasAspect > videoAspect) {
      // Canvas is wider than video (video cropped at top/bottom)
      const visibleHeightRatio = videoAspect / canvasAspect;
      normY = (normY - 0.5) / visibleHeightRatio + 0.5;
    } else {
      // Canvas is taller than video (video cropped at sides)
      const visibleWidthRatio = canvasAspect / videoAspect;
      normX = (normX - 0.5) / visibleWidthRatio + 0.5;
    }
    
    const cx = normX * canvas.width;
    const cy = normY * canvas.height;
    
    return { isPinching: dist < pinchThreshold, cx, cy, indexTip, thumbTip, wrist, landmarks };
  };

  const onHandResults = (results: Results) => {
    const now = Date.now();

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      renderer.endStroke();
      uiManager.updateCursor(0, 0, false, false);
      isZoomPanning = false;
      return;
    }

    // Handle Two Hands (Zoom & Pan)
    if (results.multiHandLandmarks.length === 2) {
      renderer.endStroke(); // Don't draw while two hands are in frame
      uiManager.updateCursor(0, 0, false, false);
      
      const hand1 = getPinchInfo(results.multiHandLandmarks[0]);
      const hand2 = getPinchInfo(results.multiHandLandmarks[1]);
      
      if (hand1.isPinching && hand2.isPinching) {
        const dist = Math.hypot(hand1.cx - hand2.cx, hand1.cy - hand2.cy);
        const centerX = (hand1.cx + hand2.cx) / 2;
        const centerY = (hand1.cy + hand2.cy) / 2;
        
        if (!isZoomPanning) {
          isZoomPanning = true;
          initialPinchDist = dist;
          initialScale = state.scale;
          prevPinchCenterX = centerX;
          prevPinchCenterY = centerY;
        } else {
          // Zoom
          const scaleDelta = dist / initialPinchDist;
          state.scale = Math.max(0.5, Math.min(5, initialScale * scaleDelta));
          
          // Pan
          const dx = centerX - prevPinchCenterX;
          const dy = centerY - prevPinchCenterY;
          state.offsetX += dx;
          state.offsetY += dy;
          
          prevPinchCenterX = centerX;
          prevPinchCenterY = centerY;
          
          uiManager.updateTransform();
        }
      } else {
        isZoomPanning = false;
      }
      return;
    }

    // ── Single Hand Logic (Drawing) ──
    isZoomPanning = false;
    const hand = getPinchInfo(results.multiHandLandmarks[0]);
    const { landmarks, wrist, indexTip, isPinching } = hand;
    
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Aspect ratio correction for drawing coordinate mapping
    const videoAspect = 16 / 9;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawX = (1 - indexTip.x);
    let drawY = indexTip.y;
    
    if (canvasAspect > videoAspect) {
      const visibleHeightRatio = videoAspect / canvasAspect;
      drawY = (drawY - 0.5) / visibleHeightRatio + 0.5;
    } else {
      const visibleWidthRatio = canvasAspect / videoAspect;
      drawX = (drawX - 0.5) / visibleWidthRatio + 0.5;
    }
    
    const x = drawX * canvas.width;
    const y = drawY * canvas.height;

    const indexExt = isFingerExtended(indexTip, indexPip, wrist);
    const middleExt = isFingerExtended(middleTip, middlePip, wrist);
    const ringExt = isFingerExtended(ringTip, ringPip, wrist);
    const pinkyExt = isFingerExtended(pinkyTip, pinkyPip, wrist);

    // 1. Pinky Eraser
    if (pinkyExt && !indexExt && !middleExt && !ringExt) {
      if (!state.erasing) {
        state.erasing = true;
        uiManager.updateEraserUI();
      }
    } else if (state.erasing && (indexExt || middleExt || ringExt)) {
      state.erasing = false;
      uiManager.updateEraserUI();
    }

    // 2. Open Palm (Clear & Swipe)
    const isOpenPalm = indexExt && middleExt && ringExt && pinkyExt;
    
    if (isOpenPalm) {
      if (openPalmStartTime === 0) {
        openPalmStartTime = now;
      } else if (now - openPalmStartTime > 1500 && now - state.lastActionTime > 2000) {
        renderer.clear();
        state.lastActionTime = now;
        openPalmStartTime = 0;
      }

      if (lastTime > 0) {
        const dt = now - lastTime;
        const dx = (1 - wrist.x) - (1 - lastWristX); 
        const velocity = dx / dt; 

        if (Math.abs(velocity) > 0.0015 && now - state.lastActionTime > 1000) {
          if (velocity < 0) renderer.undo();
          else renderer.redo();
          state.lastActionTime = now;
        }
      }
    } else {
      openPalmStartTime = 0;
    }

    lastWristX = wrist.x;
    lastTime = now;

    // 3. Dynamic Brush Size (Smoothed)
    const indexBase = landmarks[5];
    const depthDist = Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y);
    const targetDepthScale = Math.max(0.5, Math.min(2.0, depthDist * 5));
    
    // EMA smoothing for depth to prevent jitter
    smoothedDepthScale = smoothedDepthScale * 0.8 + targetDepthScale * 0.2;
    state.brushSize = state.baseBrushSize * smoothedDepthScale;

    // If the modal is open, intercept interactions
    if (isModalOpen) {
      uiManager.updateCursor(x, y, isPinching, true);
      if (isPinching) {
        if (now - state.lastActionTime > 1000) {
          // Only allow clicking the close button or elements inside modal
          uiManager.triggerAirClick(x, y);
          state.lastActionTime = now;
        }
      }
      return; // Stop drawing logic entirely while modal is open
    }

    if (isPinching) {
      renderer.endStroke();
      if (now - state.lastActionTime > 1000) {
        uiManager.triggerAirClick(x, y);
        state.lastActionTime = now;
      }
      return;
    }

    if (indexExt && !isOpenPalm) {
      renderer.drawStroke(x, y);
    } else {
      renderer.endStroke();
    }
  };

  const tracker = new HandTracker(video, onHandResults);

  // We need to know when modal opens/closes to pause drawing
  const manualBtn = document.getElementById('manualBtn');
  const closeManualBtn = document.getElementById('closeManualBtn');

  if (manualBtn) manualBtn.addEventListener('click', () => { isModalOpen = true; });
  if (closeManualBtn) closeManualBtn.addEventListener('click', () => {
    isModalOpen = false;
    // Add a slight delay to the click cooldown so the pinch that closed it doesn't immediately draw
    state.lastActionTime = Date.now() + 500;
  });

  // Start camera tracking immediately on app load
  tracker.start().then(() => {
    uiManager.hideStatus();
  }).catch((err) => {
    console.error(err);
    uiManager.showStatusError('Camera blocked', 'Please allow camera access in your browser, then refresh.');
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
