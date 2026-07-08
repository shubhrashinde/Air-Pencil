import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import type { Results, NormalizedLandmark } from '@mediapipe/hands';

export class FingerCounterApp implements BaseApp {
  private container!: HTMLElement;
  private numberDisplay!: HTMLElement;
  private onHandResults!: HandEventCallback;
  private engine = HandTrackingEngine.getInstance();
  
  private lastSpokenNumber: number = -1;
  private stableNumber: number = -1;
  private stableStartTime: number = 0;
  private synth = window.speechSynthesis;

  public start(container: HTMLElement): void {
    this.container = container;
    this.renderUI();
    
    this.onHandResults = (results: Results) => this.processHands(results);
    this.engine.subscribe(this.onHandResults);
  }

  public stop(): void {
    this.engine.unsubscribe(this.onHandResults);
    this.container.innerHTML = '';
    this.synth.cancel();
  }

  private renderUI() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: white;">
        <h1 style="font-family: 'Inter', sans-serif; font-size: 3rem; margin-bottom: 2rem;">AI Finger Counter</h1>
        <div id="numberDisplay" style="font-family: monospace; font-size: 15rem; font-weight: bold; text-shadow: 0 0 20px rgba(180, 138, 255, 0.8);">
          0
        </div>
        <p style="font-size: 1.2rem; color: #ccc; margin-top: 2rem;">Hold up your fingers and I will count them out loud.</p>
      </div>
    `;
    this.numberDisplay = this.container.querySelector('#numberDisplay') as HTMLElement;
  }

  private processHands(results: Results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.updateCount(0);
      return;
    }

    let totalFingers = 0;
    
    // Count fingers for all detected hands (up to 2)
    for (const landmarks of results.multiHandLandmarks) {
      totalFingers += this.countFingersOnHand(landmarks);
    }

    this.updateCount(totalFingers);
  }

  private countFingersOnHand(landmarks: NormalizedLandmark[]): number {
    let count = 0;
    
    const wrist = landmarks[0];
    
    // Thumb is special (compare x instead of y, depending on hand handedness, but simplified here using distance)
    const pinkyBase = landmarks[17];
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    
    // For thumb, we check if the tip is further from the pinky base than the thumb MCP
    // This works reliably for both left and right hands because the thumb extends outwards
    const dThumbTip = Math.hypot(thumbTip.x - pinkyBase.x, thumbTip.y - pinkyBase.y);
    const dThumbMcp = Math.hypot(thumbMcp.x - pinkyBase.x, thumbMcp.y - pinkyBase.y);
    
    if (dThumbTip > dThumbMcp) count++; // Thumb

    // Calculate distance from wrist to determine if other fingers are extended
    const isFingerExtended = (tip: NormalizedLandmark, pip: NormalizedLandmark) => {
      const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
      return dTip > dPip;
    };

    if (isFingerExtended(landmarks[8], landmarks[6])) count++; // Index
    if (isFingerExtended(landmarks[12], landmarks[10])) count++; // Middle
    if (isFingerExtended(landmarks[16], landmarks[14])) count++; // Ring
    if (isFingerExtended(landmarks[20], landmarks[18])) count++; // Pinky

    return count;
  }

  private updateCount(count: number) {
    if (this.numberDisplay) {
      this.numberDisplay.innerText = count.toString();
    }

    const now = Date.now();
    
    if (count !== this.stableNumber) {
      this.stableNumber = count;
      this.stableStartTime = now;
    } else {
      // If the number has been stable for 800ms and hasn't been spoken yet
      if (now - this.stableStartTime > 800 && this.lastSpokenNumber !== count) {
        this.speakNumber(count);
        this.lastSpokenNumber = count;
      }
    }
  }

  private speakNumber(num: number) {
    // Don't speak 0 continuously if no hands are present
    if (num === 0 && this.lastSpokenNumber === -1) return;
    
    this.synth.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(num.toString());
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    this.synth.speak(utterance);
  }
}
