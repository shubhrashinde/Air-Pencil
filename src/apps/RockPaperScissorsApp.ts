import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import type { Results, NormalizedLandmark } from '@mediapipe/hands';

type Gesture = 'rock' | 'paper' | 'scissors' | 'unknown';
type GameState = 'idle' | 'countdown' | 'result';

export class RockPaperScissorsApp implements BaseApp {
  private container!: HTMLElement;
  private engine = HandTrackingEngine.getInstance();
  private onHandResults!: HandEventCallback;

  private gameState: GameState = 'idle';
  private countdownValue: number = 3;
  private currentDetectedGesture: Gesture = 'unknown';
  
  private uiOverlay!: HTMLElement;
  private startBtn!: HTMLButtonElement;
  private statusText!: HTMLElement;
  private playerMoveImg!: HTMLElement;
  private aiMoveImg!: HTMLElement;

  private countdownInterval: number | null = null;

  public start(container: HTMLElement): void {
    this.container = container;
    this.renderUI();
    
    this.onHandResults = (results: Results) => this.processHands(results);
    this.engine.subscribe(this.onHandResults);
  }

  public stop(): void {
    this.engine.unsubscribe(this.onHandResults);
    this.container.innerHTML = '';
    if (this.countdownInterval) window.clearInterval(this.countdownInterval);
  }

  private renderUI() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; padding-top: 60px;">
        <h1 style="font-family: 'Inter', sans-serif; font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">Rock Paper Scissors</h1>
        
        <div id="gameArena" style="display: flex; gap: 4rem; margin: 2rem 0; align-items: center;">
          <div style="text-align: center;">
            <h3 style="margin-bottom: 1rem; color: #4cc9f0;">You</h3>
            <div id="playerMove" style="font-size: 5rem; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.2);">🤔</div>
          </div>
          
          <div id="statusText" style="font-size: 4rem; font-weight: bold; width: 200px; text-align: center; color: #ffd166;">VS</div>
          
          <div style="text-align: center;">
            <h3 style="margin-bottom: 1rem; color: #ff6b9d;">AI</h3>
            <div id="aiMove" style="font-size: 5rem; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.2);">🤖</div>
          </div>
        </div>

        <p id="currentGestureLabel" style="color: #06d6a0; margin-bottom: 2rem; min-height: 24px; font-weight: bold;">Detecting hand...</p>

        <button id="startGameBtn" style="padding: 16px 48px; font-size: 1.5rem; font-family: 'Inter', sans-serif; font-weight: bold; background: white; color: black; border: none; border-radius: 50px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 10px 30px rgba(255,255,255,0.2);">Play Match</button>
      </div>
    `;

    this.startBtn = this.container.querySelector('#startGameBtn') as HTMLButtonElement;
    this.statusText = this.container.querySelector('#statusText') as HTMLElement;
    this.playerMoveImg = this.container.querySelector('#playerMove') as HTMLElement;
    this.aiMoveImg = this.container.querySelector('#aiMove') as HTMLElement;
    const currentGestureLabel = this.container.querySelector('#currentGestureLabel') as HTMLElement;

    this.startBtn.addEventListener('click', () => this.startGame());

    // Update real-time gesture label
    setInterval(() => {
      if (this.gameState === 'idle') {
        const icons = { 'rock': '✊ Rock', 'paper': '✋ Paper', 'scissors': '✌️ Scissors', 'unknown': '❓ Waiting for hand...' };
        currentGestureLabel.innerText = icons[this.currentDetectedGesture];
      } else {
        currentGestureLabel.innerText = '';
      }
    }, 100);
  }

  private startGame() {
    if (this.gameState !== 'idle') return;
    
    this.gameState = 'countdown';
    this.countdownValue = 3;
    this.startBtn.style.display = 'none';
    this.playerMoveImg.innerText = '🤔';
    this.aiMoveImg.innerText = '🤖';

    this.countdownInterval = window.setInterval(() => {
      if (this.countdownValue > 0) {
        this.statusText.innerText = this.countdownValue.toString();
        this.countdownValue--;
      } else {
        this.statusText.innerText = 'SHOOT!';
        if (this.countdownInterval) window.clearInterval(this.countdownInterval);
        setTimeout(() => this.resolveMatch(), 500);
      }
    }, 1000);
  }

  private resolveMatch() {
    this.gameState = 'result';
    
    const playerMove = this.currentDetectedGesture;
    
    if (playerMove === 'unknown') {
      this.statusText.innerText = 'No Hand!';
      this.statusText.style.color = '#ff6b9d';
      this.resetGame();
      return;
    }

    const moves: Gesture[] = ['rock', 'paper', 'scissors'];
    const aiMove = moves[Math.floor(Math.random() * 3)];

    const icons = { 'rock': '✊', 'paper': '✋', 'scissors': '✌️', 'unknown': '' };
    this.playerMoveImg.innerText = icons[playerMove];
    this.aiMoveImg.innerText = icons[aiMove];

    let result = '';
    let color = '#ffffff';

    if (playerMove === aiMove) {
      result = 'DRAW!';
      color = '#ffd166';
    } else if (
      (playerMove === 'rock' && aiMove === 'scissors') ||
      (playerMove === 'paper' && aiMove === 'rock') ||
      (playerMove === 'scissors' && aiMove === 'paper')
    ) {
      result = 'YOU WIN!';
      color = '#06d6a0';
    } else {
      result = 'AI WINS!';
      color = '#ff6b9d';
    }

    this.statusText.innerText = result;
    this.statusText.style.color = color;

    this.resetGame();
  }

  private resetGame() {
    setTimeout(() => {
      this.gameState = 'idle';
      this.startBtn.style.display = 'block';
      this.startBtn.innerText = 'Play Again';
      this.statusText.innerText = 'VS';
      this.statusText.style.color = '#ffd166';
    }, 3000);
  }

  private processHands(results: Results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.currentDetectedGesture = 'unknown';
      return;
    }

    // Only process the first hand for RPS
    const landmarks = results.multiHandLandmarks[0];
    const wrist = landmarks[0];

    const pinkyBase = landmarks[17];
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    
    const isThumbExtended = Math.hypot(thumbTip.x - pinkyBase.x, thumbTip.y - pinkyBase.y) > 
                            Math.hypot(thumbMcp.x - pinkyBase.x, thumbMcp.y - pinkyBase.y);

    // Palm size as a reference metric for hand scale
    const palmSize = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y);

    const isFingerExtended = (tip: NormalizedLandmark, mcp: NormalizedLandmark) => {
      // Distance from tip to its own base knuckle
      const fingerLength = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
      // If the finger is extended, its tip is far from its base (typically close to palm size).
      // If it's curled, the tip is close to the base.
      return fingerLength > palmSize * 0.75;
    };

    const isIndexExtended = isFingerExtended(landmarks[8], landmarks[5]);
    const isMiddleExtended = isFingerExtended(landmarks[12], landmarks[9]);
    const isRingExtended = isFingerExtended(landmarks[16], landmarks[13]);
    const isPinkyExtended = isFingerExtended(landmarks[20], landmarks[17]);

    const extendedCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

    if (extendedCount === 0 && !isThumbExtended) {
      this.currentDetectedGesture = 'rock';
    } else if (extendedCount >= 3) {
      // If 3 or 4 fingers are up (plus optionally thumb), it's paper
      this.currentDetectedGesture = 'paper';
    } else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      this.currentDetectedGesture = 'scissors';
    } else {
      this.currentDetectedGesture = 'unknown'; // Transitional state
    }
  }
}
