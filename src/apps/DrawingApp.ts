import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import { CanvasRenderer } from '../core/CanvasRenderer';
import { UIManager } from '../core/UIManager';
import { state } from '../core/State';
import type { Results, NormalizedLandmark } from '@mediapipe/hands';

export class DrawingApp implements BaseApp {
  private renderer!: CanvasRenderer;
  private uiManager!: UIManager;
  private engine = HandTrackingEngine.getInstance();
  private onHandResultsCallback!: HandEventCallback;

  // State
  private isModalOpen = false;
  private openPalmStartTime = 0;
  private lastWristX = 0;
  private lastTime = 0;
  
  private initialPinchDist = 0;
  private initialScale = 1;
  private prevPinchCenterX = 0;
  private prevPinchCenterY = 0;
  private isZoomPanning = false;
  private smoothedDepthScale = 1.0;

  public start(_container: HTMLElement): void {
    const canvas = document.getElementById('paintCanvas') as HTMLCanvasElement;
    if (!canvas) return; 

    this.renderer = new CanvasRenderer(canvas);
    this.uiManager = new UIManager(this.renderer);

    this.bindUI();

    this.onHandResultsCallback = (results: Results) => this.onHandResults(results, canvas);
    this.engine.subscribe(this.onHandResultsCallback);
    this.uiManager.hideStatus();
  }

  public stop(): void {
    this.engine.unsubscribe(this.onHandResultsCallback);
    // Unbind listeners if needed
  }

  private bindUI() {
    const manualBtn = document.getElementById('manualBtn');
    const closeManualBtn = document.getElementById('closeManualBtn');

    if (manualBtn) manualBtn.addEventListener('click', () => { this.isModalOpen = true; });
    if (closeManualBtn) closeManualBtn.addEventListener('click', () => {
      this.isModalOpen = false;
      state.lastActionTime = Date.now() + 500;
    });
  }

  private isFingerExtended(tip: NormalizedLandmark, pip: NormalizedLandmark, wrist: NormalizedLandmark) {
    const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    return dTip > dPip;
  }
  
  private getPinchInfo(landmarks: NormalizedLandmark[], canvas: HTMLCanvasElement) {
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
  }

  private onHandResults(results: Results, canvas: HTMLCanvasElement) {
    const now = Date.now();

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.renderer.endStroke();
      this.uiManager.updateCursor(0, 0, false, false);
      this.isZoomPanning = false;
      return;
    }

    // Handle Two Hands (Zoom & Pan)
    if (results.multiHandLandmarks.length === 2) {
      this.renderer.endStroke(); 
      this.uiManager.updateCursor(0, 0, false, false);
      
      const hand1 = this.getPinchInfo(results.multiHandLandmarks[0], canvas);
      const hand2 = this.getPinchInfo(results.multiHandLandmarks[1], canvas);
      
      if (hand1.isPinching && hand2.isPinching) {
        const dist = Math.hypot(hand1.cx - hand2.cx, hand1.cy - hand2.cy);
        const centerX = (hand1.cx + hand2.cx) / 2;
        const centerY = (hand1.cy + hand2.cy) / 2;
        
        if (!this.isZoomPanning) {
          this.isZoomPanning = true;
          this.initialPinchDist = dist;
          this.initialScale = state.scale;
          this.prevPinchCenterX = centerX;
          this.prevPinchCenterY = centerY;
        } else {
          // Zoom
          const scaleDelta = dist / this.initialPinchDist;
          state.scale = Math.max(0.5, Math.min(5, this.initialScale * scaleDelta));
          
          // Pan
          const dx = centerX - this.prevPinchCenterX;
          const dy = centerY - this.prevPinchCenterY;
          state.offsetX += dx;
          state.offsetY += dy;
          
          this.prevPinchCenterX = centerX;
          this.prevPinchCenterY = centerY;
          
          this.uiManager.updateTransform();
        }
      } else {
        this.isZoomPanning = false;
      }
      return;
    }

    // ── Single Hand Logic (Drawing) ──
    this.isZoomPanning = false;
    const hand = this.getPinchInfo(results.multiHandLandmarks[0], canvas);
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

    const indexExt = this.isFingerExtended(indexTip, indexPip, wrist);
    const middleExt = this.isFingerExtended(middleTip, middlePip, wrist);
    const ringExt = this.isFingerExtended(ringTip, ringPip, wrist);
    const pinkyExt = this.isFingerExtended(pinkyTip, pinkyPip, wrist);

    // 1. Pinky Eraser
    if (pinkyExt && !indexExt && !middleExt && !ringExt) {
      if (!state.erasing) {
        state.erasing = true;
        this.uiManager.updateEraserUI();
      }
    } else if (state.erasing && (indexExt || middleExt || ringExt)) {
      state.erasing = false;
      this.uiManager.updateEraserUI();
    }

    // 2. Open Palm (Clear & Swipe)
    const isOpenPalm = indexExt && middleExt && ringExt && pinkyExt;
    
    if (isOpenPalm) {
      if (this.openPalmStartTime === 0) {
        this.openPalmStartTime = now;
      } else if (now - this.openPalmStartTime > 1500 && now - state.lastActionTime > 2000) {
        this.renderer.clear();
        state.lastActionTime = now;
        this.openPalmStartTime = 0;
      }

      if (this.lastTime > 0) {
        const dt = now - this.lastTime;
        const dx = (1 - wrist.x) - (1 - this.lastWristX); 
        const velocity = dx / dt; 

        if (Math.abs(velocity) > 0.0015 && now - state.lastActionTime > 1000) {
          if (velocity < 0) this.renderer.undo();
          else this.renderer.redo();
          state.lastActionTime = now;
        }
      }
    } else {
      this.openPalmStartTime = 0;
    }

    this.lastWristX = wrist.x;
    this.lastTime = now;

    // 3. Dynamic Brush Size (Smoothed)
    const indexBase = landmarks[5];
    const depthDist = Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y);
    const targetDepthScale = Math.max(0.5, Math.min(2.0, depthDist * 5));
    
    // EMA smoothing for depth to prevent jitter
    this.smoothedDepthScale = this.smoothedDepthScale * 0.8 + targetDepthScale * 0.2;
    state.brushSize = state.baseBrushSize * this.smoothedDepthScale;

    // If the modal is open, intercept interactions
    if (this.isModalOpen) {
      this.uiManager.updateCursor(x, y, isPinching, true);
      if (isPinching) {
        if (now - state.lastActionTime > 1000) {
          // Only allow clicking the close button or elements inside modal
          this.uiManager.triggerAirClick(x, y);
          state.lastActionTime = now;
        }
      }
      return; // Stop drawing logic entirely while modal is open
    }

    if (isPinching) {
      this.renderer.endStroke();
      if (now - state.lastActionTime > 1000) {
        this.uiManager.triggerAirClick(x, y);
        state.lastActionTime = now;
      }
      return;
    }

    if (indexExt && !isOpenPalm) {
      this.renderer.drawStroke(x, y);
    } else {
      this.renderer.endStroke();
    }
  }
}
