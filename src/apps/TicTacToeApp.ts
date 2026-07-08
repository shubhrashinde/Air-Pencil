import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import type { Results, NormalizedLandmark } from '@mediapipe/hands';

export class TicTacToeApp implements BaseApp {
  private container!: HTMLElement;
  private engine = HandTrackingEngine.getInstance();
  private onHandResults!: HandEventCallback;

  private board: string[] = Array(9).fill('');
  private currentPlayer: 'X' | 'O' = 'X';
  private gameOver: boolean = false;
  private statusText!: HTMLElement;

  private cursor!: HTMLElement;
  private isPinching: boolean = false;
  private lastPinchTime: number = 0;
  private gameMode: 'vsAI' | '2Player' = 'vsAI';

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
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; padding-top: 60px;">
        <h1 style="font-family: 'Inter', sans-serif; font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">Tic-Tac-Toe</h1>
        <h3 id="ttt-status" style="margin-bottom: 2rem; color: #4cc9f0; font-family: 'Inter', sans-serif;">Your Turn (X)</h3>
        
        <div id="ttt-board" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 12px;">
          ${Array(9).fill(0).map((_, i) => `
            <div class="ttt-cell" data-index="${i}" style="width: 100px; height: 100px; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 4rem; font-family: 'Inter', sans-serif; font-weight: bold; cursor: pointer; border-radius: 8px; transition: background 0.2s;"></div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
          <button id="ttt-mode" style="padding: 12px 32px; font-size: 1.2rem; font-family: 'Inter', sans-serif; font-weight: bold; background: #ff6b9d; color: white; border: none; border-radius: 50px; cursor: pointer;">Mode: Vs AI</button>
          <button id="ttt-reset" style="padding: 12px 32px; font-size: 1.2rem; font-family: 'Inter', sans-serif; font-weight: bold; background: white; color: black; border: none; border-radius: 50px; cursor: pointer;">Restart Game</button>
        </div>
      </div>
      <div id="ttt-cursor" style="position: absolute; width: 20px; height: 20px; background: #06d6a0; border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 15px #06d6a0;"></div>
    `;

    this.statusText = this.container.querySelector('#ttt-status') as HTMLElement;
    this.cursor = this.container.querySelector('#ttt-cursor') as HTMLElement;

    const cells = this.container.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => this.handleCellClick(e.target as HTMLElement));
      // Hover effects for cursor
      cell.addEventListener('mouseenter', (e) => {
        (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
      });
      cell.addEventListener('mouseleave', (e) => {
        (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.6)';
      });
    });

    const resetBtn = this.container.querySelector('#ttt-reset') as HTMLButtonElement;
    resetBtn.addEventListener('click', () => this.resetGame());

    const modeBtn = this.container.querySelector('#ttt-mode') as HTMLButtonElement;
    modeBtn.addEventListener('click', () => {
      this.gameMode = this.gameMode === 'vsAI' ? '2Player' : 'vsAI';
      modeBtn.innerText = `Mode: ${this.gameMode === 'vsAI' ? 'Vs AI' : '2 Player'}`;
      modeBtn.style.background = this.gameMode === 'vsAI' ? '#ff6b9d' : '#06d6a0';
      this.resetGame();
    });
  }

  private handleCellClick(cell: HTMLElement) {
    if (this.gameOver) return;
    if (this.gameMode === 'vsAI' && this.currentPlayer !== 'X') return;

    const index = parseInt(cell.getAttribute('data-index') || '0');
    if (this.board[index] !== '') return;

    this.makeMove(index, this.currentPlayer, cell);
    
    if (!this.gameOver) {
      if (this.gameMode === 'vsAI') {
        this.currentPlayer = 'O';
        this.statusText.innerText = 'AI Thinking...';
        this.statusText.style.color = '#ff6b9d';
        setTimeout(() => this.makeAIMove(), 600);
      } else {
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this.statusText.innerText = `Player ${this.currentPlayer}'s Turn`;
        this.statusText.style.color = this.currentPlayer === 'X' ? '#4cc9f0' : '#ff6b9d';
      }
    }
  }

  private makeMove(index: number, player: 'X' | 'O', cellElement?: HTMLElement) {
    this.board[index] = player;
    const el = cellElement || this.container.querySelector(`.ttt-cell[data-index="${index}"]`) as HTMLElement;
    
    el.innerText = player;
    el.style.color = player === 'X' ? '#4cc9f0' : '#ff6b9d';

    this.checkWin();
  }

  private makeAIMove() {
    if (this.gameOver) return;

    // Simple AI: Try to find empty spot
    const emptyIndices = this.board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
    
    if (emptyIndices.length > 0) {
      // Pick random empty spot
      const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      this.makeMove(randomIndex, 'O');
    }

    if (!this.gameOver) {
      this.currentPlayer = 'X';
      this.statusText.innerText = 'Your Turn (X)';
      this.statusText.style.color = '#4cc9f0';
    }
  }

  private checkWin() {
    const winPatterns = [
      [0,1,2], [3,4,5], [6,7,8], // Rows
      [0,3,6], [1,4,7], [2,5,8], // Cols
      [0,4,8], [2,4,6]           // Diagonals
    ];

    let winner = null;

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        winner = this.board[a];
        break;
      }
    }

    if (winner) {
      this.gameOver = true;
      this.statusText.innerText = `${winner} WINS!`;
      this.statusText.style.color = winner === 'X' ? '#4cc9f0' : '#ff6b9d';
      return;
    }

    if (!this.board.includes('')) {
      this.gameOver = true;
      this.statusText.innerText = `DRAW!`;
      this.statusText.style.color = '#ffd166';
    }
  }

  private resetGame() {
    this.board = Array(9).fill('');
    this.currentPlayer = 'X';
    this.gameOver = false;
    this.statusText.innerText = 'Your Turn (X)';
    this.statusText.style.color = '#4cc9f0';

    const cells = this.container.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
      (cell as HTMLElement).innerText = '';
    });
  }

  private processHands(results: Results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (this.cursor) this.cursor.style.display = 'none';
      return;
    }

    // Hard cooldown block
    const now = Date.now();
    const cooldownMs = 2500; // Reduced to 2.5s to make 2-player mode bearable
    if (now - this.lastPinchTime < cooldownMs) {
      if (this.cursor) this.cursor.style.display = 'none';
      if (this.statusText && !this.gameOver && (this.gameMode === '2Player' || this.currentPlayer === 'X')) {
        const remaining = Math.ceil((cooldownMs - (now - this.lastPinchTime)) / 1000);
        this.statusText.innerText = `Cooldown: ${remaining}s...`;
        this.statusText.style.color = '#ffd166';
      }
      return;
    } else if (this.statusText.innerText.startsWith('Cooldown')) {
       if (this.gameMode === 'vsAI') {
         this.statusText.innerText = 'Your Turn (X)';
         this.statusText.style.color = '#4cc9f0';
       } else {
         this.statusText.innerText = `Player ${this.currentPlayer}'s Turn`;
         this.statusText.style.color = this.currentPlayer === 'X' ? '#4cc9f0' : '#ff6b9d';
       }
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
    const pinchThreshold = handSize * 0.35; // Scales with how close hand is to camera
    
    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const isCurrentlyPinching = pinchDist < pinchThreshold;

    if (isCurrentlyPinching && !this.isPinching) {
      this.lastPinchTime = Date.now();
      
      // Temporarily hide cursor to not intercept elementFromPoint
      this.cursor.style.display = 'none';
      
      // Find element at coordinates
      const element = document.elementFromPoint(clientX, clientY) as HTMLElement;
      
      // Re-show cursor
      this.cursor.style.display = 'block';

      if (element) {
        // Trigger click
        element.click();
        
        // Visual feedback
        this.cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
        this.cursor.style.background = '#ff6b9d';
        setTimeout(() => {
          this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          this.cursor.style.background = '#06d6a0';
        }, 200);
      }
    }

    this.isPinching = isCurrentlyPinching;
  }
}
