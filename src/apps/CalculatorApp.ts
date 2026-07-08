import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import type { Results } from '@mediapipe/hands';

export class CalculatorApp implements BaseApp {
  private container!: HTMLElement;
  private engine = HandTrackingEngine.getInstance();
  private onHandResults!: HandEventCallback;

  private cursor!: HTMLElement;
  private isPinching: boolean = false;
  private lastPinchTime: number = 0;

  // Calculator State
  private currentOperand: string = '0';
  private previousOperand: string = '';
  private operation: string | null = null;
  private displayElement!: HTMLElement;
  private previousDisplayElement!: HTMLElement;

  public start(container: HTMLElement): void {
    this.container = container;
    this.renderUI();
    
    this.onHandResults = (results: Results) => this.processHands(results);
    this.engine.subscribe(this.onHandResults);
  }

  public stop(): void {
    this.engine.unsubscribe(this.onHandResults);
    this.container.innerHTML = '';
  }

  private renderUI() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; padding-top: 40px;">
        
        <div id="calc-body" style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 24px; padding: 20px; width: 400px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          
          <div style="background: rgba(0,0,0,0.4); border-radius: 16px; padding: 20px; text-align: right; margin-bottom: 20px; min-height: 100px; display: flex; flex-direction: column; justify-content: flex-end;">
            <div id="calc-prev" style="color: rgba(255,255,255,0.6); font-size: 1.2rem; min-height: 20px; font-family: monospace;"></div>
            <div id="calc-curr" style="color: white; font-size: 3rem; font-weight: bold; font-family: monospace; overflow: hidden; text-overflow: ellipsis;">0</div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <button class="calc-btn op-c" style="grid-column: span 2; background: #ff6b9d;">C</button>
            <button class="calc-btn op-del" style="background: #ffd166;">DEL</button>
            <button class="calc-btn op" data-action="/">/</button>

            <button class="calc-btn num" data-num="7">7</button>
            <button class="calc-btn num" data-num="8">8</button>
            <button class="calc-btn num" data-num="9">9</button>
            <button class="calc-btn op" data-action="*">*</button>

            <button class="calc-btn num" data-num="4">4</button>
            <button class="calc-btn num" data-num="5">5</button>
            <button class="calc-btn num" data-num="6">6</button>
            <button class="calc-btn op" data-action="-">-</button>

            <button class="calc-btn num" data-num="1">1</button>
            <button class="calc-btn num" data-num="2">2</button>
            <button class="calc-btn num" data-num="3">3</button>
            <button class="calc-btn op" data-action="+">+</button>

            <button class="calc-btn num" data-num="0" style="grid-column: span 2;">0</button>
            <button class="calc-btn num" data-num=".">.</button>
            <button class="calc-btn op-eq" style="background: #06d6a0;">=</button>
          </div>
        </div>
      </div>
      <div id="calc-cursor" style="position: absolute; width: 20px; height: 20px; background: #06d6a0; border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 15px #06d6a0;"></div>
    `;

    // Apply styles to all buttons dynamically
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .calc-btn {
        border: none;
        border-radius: 12px;
        font-size: 1.8rem;
        font-family: 'Inter', sans-serif;
        font-weight: bold;
        color: white;
        background: rgba(255,255,255,0.15);
        cursor: pointer;
        padding: 20px 0;
        transition: background 0.1s, transform 0.1s;
      }
      .calc-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.05); }
      .calc-btn:active { transform: scale(0.95); }
      .calc-btn.op { background: #4cc9f0; color: #000; }
      .calc-btn.op-eq { color: #000; }
    `;
    this.container.appendChild(styleTag);

    this.displayElement = this.container.querySelector('#calc-curr') as HTMLElement;
    this.previousDisplayElement = this.container.querySelector('#calc-prev') as HTMLElement;
    this.cursor = this.container.querySelector('#calc-cursor') as HTMLElement;

    // Attach logic
    this.container.querySelectorAll('.num').forEach(btn => {
      btn.addEventListener('click', (e) => this.appendNumber((e.target as HTMLElement).getAttribute('data-num') || ''));
    });
    this.container.querySelectorAll('.op').forEach(btn => {
      btn.addEventListener('click', (e) => this.chooseOperation((e.target as HTMLElement).getAttribute('data-action') || ''));
    });
    this.container.querySelector('.op-c')?.addEventListener('click', () => this.clear());
    this.container.querySelector('.op-del')?.addEventListener('click', () => this.deleteNumber());
    this.container.querySelector('.op-eq')?.addEventListener('click', () => this.compute());
  }

  private updateDisplay() {
    this.displayElement.innerText = this.currentOperand;
    if (this.operation != null) {
      this.previousDisplayElement.innerText = `${this.previousOperand} ${this.operation}`;
    } else {
      this.previousDisplayElement.innerText = '';
    }
  }

  private clear() {
    this.currentOperand = '0';
    this.previousOperand = '';
    this.operation = null;
    this.updateDisplay();
  }

  private deleteNumber() {
    if (this.currentOperand === '0') return;
    this.currentOperand = this.currentOperand.toString().slice(0, -1);
    if (this.currentOperand === '') this.currentOperand = '0';
    this.updateDisplay();
  }

  private appendNumber(number: string) {
    if (number === '.' && this.currentOperand.includes('.')) return;
    if (this.currentOperand === '0' && number !== '.') {
      this.currentOperand = number;
    } else {
      this.currentOperand += number;
    }
    this.updateDisplay();
  }

  private chooseOperation(operation: string) {
    if (this.currentOperand === '0' && this.previousOperand === '') return;
    if (this.previousOperand !== '') {
      this.compute();
    }
    this.operation = operation;
    this.previousOperand = this.currentOperand;
    this.currentOperand = '0';
    this.updateDisplay();
  }

  private compute() {
    let computation;
    const prev = parseFloat(this.previousOperand);
    const current = parseFloat(this.currentOperand);
    if (isNaN(prev) || isNaN(current)) return;
    
    switch (this.operation) {
      case '+': computation = prev + current; break;
      case '-': computation = prev - current; break;
      case '*': computation = prev * current; break;
      case '/': 
        if (current === 0) {
          alert('Cannot divide by zero!');
          this.clear();
          return;
        }
        computation = prev / current; 
        break;
      default: return;
    }
    
    this.currentOperand = computation.toString();
    this.operation = null;
    this.previousOperand = '';
    this.updateDisplay();
  }

  private processHands(results: Results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (this.cursor) this.cursor.style.display = 'none';
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    
    // Map to screen coordinates
    const videoAspect = 16 / 9;
    const windowAspect = window.innerWidth / window.innerHeight;
    
    let normX = 1 - indexTip.x;
    let normY = indexTip.y;
    
    if (windowAspect > videoAspect) {
      const visibleHeightRatio = videoAspect / windowAspect;
      normY = (normY - 0.5) / visibleHeightRatio + 0.5;
    } else {
      const visibleWidthRatio = windowAspect / videoAspect;
      normX = (normX - 0.5) / visibleWidthRatio + 0.5;
    }
    
    const clientX = normX * window.innerWidth;
    const clientY = normY * window.innerHeight;

    // Update Cursor
    if (this.cursor) {
      this.cursor.style.display = 'block';
      this.cursor.style.left = `${clientX}px`;
      this.cursor.style.top = `${clientY}px`;
    }

    // Detect Pinch dynamically based on hand size
    const wrist = landmarks[0];
    const indexBase = landmarks[5];
    const handSize = Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y);
    const pinchThreshold = handSize * 0.35;
    
    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const isCurrentlyPinching = pinchDist < pinchThreshold;

    if (isCurrentlyPinching && !this.isPinching) {
      const now = Date.now();
      if (now - this.lastPinchTime > 400) { // Fast 400ms cooldown for rapid calculation
        this.lastPinchTime = now;
        
        // Temporarily hide cursor to not intercept elementFromPoint
        this.cursor.style.display = 'none';
        
        // Find element at coordinates
        const element = document.elementFromPoint(clientX, clientY) as HTMLElement;
        
        // Re-show cursor
        this.cursor.style.display = 'block';

        if (element && element.tagName === 'BUTTON') {
          element.click();
          
          // Visual feedback
          this.cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
          this.cursor.style.background = '#ff6b9d';
          
          // Button active state visual simulation
          const originalTransform = element.style.transform;
          element.style.transform = 'scale(0.9)';
          setTimeout(() => {
            element.style.transform = originalTransform;
          }, 100);

          setTimeout(() => {
            this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            this.cursor.style.background = '#06d6a0';
          }, 200);
        }
      }
    }

    this.isPinching = isCurrentlyPinching;
  }
}
