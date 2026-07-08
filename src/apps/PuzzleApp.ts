import { BaseApp } from '../core/BaseApp';
import { HandTrackingEngine, HandEventCallback } from '../core/HandTrackingEngine';
import type { Results } from '@mediapipe/hands';

type AppState = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'WON';

export class PuzzleApp implements BaseApp {
  private container!: HTMLElement;
  private engine = HandTrackingEngine.getInstance();
  private onHandResults!: HandEventCallback;

  private state: AppState = 'WAITING';
  private uiContainer!: HTMLElement;
  private cursor!: HTMLElement;
  
  // Hand state
  private isPinching: boolean = false;
  private lastPinchTime: number = 0;
  private last5FingerTime: number = 0;

  // Puzzle state
  private countdownValue: number = 10;
  private countdownInterval: number | null = null;
  private tiles: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // 8 is the empty slot
  private dataUrl: string = '';

  // Drag state
  private draggedTileIndex: number | null = null;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragElement: HTMLElement | null = null;
  private translateX: number = 0;
  private translateY: number = 0;

  public start(container: HTMLElement): void {
    this.container = container;
    this.renderInitialUI();
    this.state = 'WAITING';
    this.last5FingerTime = 0;
    
    this.onHandResults = (results: Results) => this.processHands(results);
    this.engine.subscribe(this.onHandResults);
  }

  public stop(): void {
    this.engine.unsubscribe(this.onHandResults);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.container.innerHTML = '';
  }

  private renderInitialUI() {
    this.container.innerHTML = `
      <div id="puzzle-ui" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white;">
        <h1 style="font-family: 'Inter', sans-serif; font-size: 4rem; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">Hold up 5 fingers</h1>
        <h2 style="font-family: 'Inter', sans-serif; font-size: 2rem; color: #4cc9f0;">to start the photo timer!</h2>
      </div>
      <div id="puzzle-cursor" style="position: absolute; width: 20px; height: 20px; background: #06d6a0; border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 15px #06d6a0;"></div>
    `;
    this.uiContainer = this.container.querySelector('#puzzle-ui') as HTMLElement;
    this.cursor = this.container.querySelector('#puzzle-cursor') as HTMLElement;
  }

  private startCountdown() {
    this.state = 'COUNTDOWN';
    this.countdownValue = 10;
    
    this.uiContainer.innerHTML = `
      <h1 style="font-family: 'Inter', sans-serif; font-size: 8rem; color: #ff6b9d; text-shadow: 0 4px 20px rgba(0,0,0,0.5);" id="countdown-text">10</h1>
      <h2 style="font-family: 'Inter', sans-serif; font-size: 2rem;">Get ready to smile!</h2>
    `;
    const textEl = this.container.querySelector('#countdown-text') as HTMLElement;

    this.countdownInterval = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue > 0) {
        textEl.innerText = this.countdownValue.toString();
        // Beep visual
        textEl.style.transform = 'scale(1.2)';
        setTimeout(() => textEl.style.transform = 'scale(1)', 100);
      } else {
        clearInterval(this.countdownInterval!);
        this.takeSnapshotAndStart();
      }
    }, 1000);
  }

  private takeSnapshotAndStart() {
    const video = document.getElementById('webcam') as HTMLVideoElement;
    if (!video) return;

    // Target a 4:3 landscape aspect ratio for the puzzle
    const targetAspect = 4 / 3;
    const videoAspect = video.videoWidth / video.videoHeight;
    let sWidth = video.videoWidth;
    let sHeight = video.videoHeight;
    let startX = 0;
    let startY = 0;

    if (videoAspect > targetAspect) {
      // Video is wider, crop sides
      sWidth = video.videoHeight * targetAspect;
      startX = (video.videoWidth - sWidth) / 2;
    } else {
      // Video is taller, crop top/bottom
      sHeight = video.videoWidth / targetAspect;
      startY = (video.videoHeight - sHeight) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image so it looks like what the user sees
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    
    this.dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    this.state = 'PLAYING';
    this.initPuzzle();
  }

  private initPuzzle() {
    // Generate solvable shuffle
    this.tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 150; i++) {
      const emptyIdx = this.tiles.indexOf(8);
      const row = Math.floor(emptyIdx / 3);
      const col = emptyIdx % 3;
      const neighbors = [];
      if (row > 0) neighbors.push(emptyIdx - 3);
      if (row < 2) neighbors.push(emptyIdx + 3);
      if (col > 0) neighbors.push(emptyIdx - 1);
      if (col < 2) neighbors.push(emptyIdx + 1);
      
      const swapIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      this.tiles[emptyIdx] = this.tiles[swapIdx];
      this.tiles[swapIdx] = 8;
    }

    this.renderPuzzleBoard();
  }

  private renderPuzzleBoard() {
    let tilesHtml = '';
    for (let i = 0; i < 9; i++) {
      const tileVal = this.tiles[i];
      if (tileVal === 8) {
        tilesHtml += `<div class="puzzle-tile empty" data-index="${i}" style="width: 200px; height: 150px; background: rgba(0,0,0,0.5); border-radius: 8px;"></div>`;
      } else {
        const origRow = Math.floor(tileVal / 3);
        const origCol = tileVal % 3;
        tilesHtml += `
          <div class="puzzle-tile" data-index="${i}" style="
            width: 200px; height: 150px; 
            background-image: url(${this.dataUrl}); 
            background-size: 600px 450px; 
            background-position: -${origCol * 200}px -${origRow * 150}px;
            border-radius: 8px; cursor: pointer; border: 2px solid rgba(255,255,255,0.2);
            transition: transform 0.1s;
          "></div>
        `;
      }
    }

    this.uiContainer.innerHTML = `
      <h2 style="font-family: 'Inter', sans-serif; font-size: 2rem; margin-bottom: 20px;">Solve the Puzzle!</h2>
      <div id="puzzle-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: rgba(255,255,255,0.1); padding: 15px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        ${tilesHtml}
      </div>
      <button id="puzzle-restart" style="margin-top: 30px; padding: 12px 32px; font-size: 1.2rem; font-weight: bold; background: #ff6b9d; color: white; border: none; border-radius: 50px; cursor: pointer;">Retake Photo</button>
    `;

    this.uiContainer.querySelectorAll('.puzzle-tile').forEach(tile => {
      // Remove click listeners, as we handle everything in processHands now
      tile.addEventListener('mouseenter', (e) => {
        if (!(e.target as HTMLElement).classList.contains('empty') && this.draggedTileIndex === null) {
          (e.target as HTMLElement).style.transform = 'scale(1.05)';
        }
      });
      tile.addEventListener('mouseleave', (e) => {
        if (this.draggedTileIndex === null) {
          (e.target as HTMLElement).style.transform = 'scale(1)';
        }
      });
    });

    this.uiContainer.querySelector('#puzzle-restart')?.addEventListener('click', () => {
      this.state = 'WAITING';
      this.renderInitialUI();
    });
  }

  private handleTileClick(index: number) {
    // Deprecated for drag and drop, kept for fallback if needed
  }

  private checkWin() {
    let won = true;
    for (let i = 0; i < 9; i++) {
      if (this.tiles[i] !== i) {
        won = false;
        break;
      }
    }

    if (won) {
      this.state = 'WON';
      this.uiContainer.innerHTML = `
        <div style="position: relative; width: 600px; height: 450px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 50px rgba(0,0,0,0.8);">
          <img src="${this.dataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <h1 style="font-family: 'Inter', sans-serif; font-size: 4rem; color: #06d6a0; text-shadow: 0 4px 20px rgba(0,0,0,0.8);">YOU WON!</h1>
            <button id="puzzle-play-again" style="margin-top: 20px; padding: 12px 32px; font-size: 1.2rem; font-weight: bold; background: white; color: black; border: none; border-radius: 50px; cursor: pointer;">Play Again</button>
          </div>
        </div>
      `;

      this.uiContainer.querySelector('#puzzle-play-again')?.addEventListener('click', () => {
        this.state = 'WAITING';
        this.renderInitialUI();
      });
    }
  }

  private processHands(results: Results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (this.cursor) this.cursor.style.display = 'none';
      return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // Detect 5 fingers for WAITING state
    if (this.state === 'WAITING') {
      const tips = [8, 12, 16, 20];
      const bases = [5, 9, 13, 17];
      let fingersUp = 0;
      
      for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y < landmarks[bases[i]].y) fingersUp++;
      }
      
      const thumbTip = landmarks[4];
      const thumbBase = landmarks[2];
      const thumbIsUp = thumbTip.y < thumbBase.y || thumbTip.x < thumbBase.x; 
      if (thumbIsUp) fingersUp++;

      if (fingersUp === 5) {
        const now = Date.now();
        if (this.last5FingerTime === 0) this.last5FingerTime = now;
        if (now - this.last5FingerTime > 1000) { // Hold for 1 second
          this.startCountdown();
        }
      } else {
        this.last5FingerTime = 0;
      }
      return;
    }

    // Air click for PLAYING and WON states
    if (this.state !== 'PLAYING' && this.state !== 'WON') return;

    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    
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

    if (this.cursor) {
      this.cursor.style.display = 'block';
      this.cursor.style.left = `${clientX}px`;
      this.cursor.style.top = `${clientY}px`;
    }

    const wrist = landmarks[0];
    const indexBase = landmarks[5];
    const handSize = Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y);
    const pinchThreshold = handSize * 0.35;
    
    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const isCurrentlyPinching = pinchDist < pinchThreshold;

    if (isCurrentlyPinching && !this.isPinching) {
      // PINCH START
      const now = Date.now();
      if (now - this.lastPinchTime > 200) { // Shorter cooldown for grabbing
        this.lastPinchTime = now;
        
        this.cursor.style.display = 'none';
        const element = document.elementFromPoint(clientX, clientY) as HTMLElement;
        this.cursor.style.display = 'block';

        if (element && element.tagName === 'BUTTON') {
          // Instant click for buttons
          element.click();
          this.cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
          this.cursor.style.background = '#ff6b9d';
          setTimeout(() => {
            this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            this.cursor.style.background = '#06d6a0';
          }, 200);
        } else if (this.state === 'PLAYING' && element && element.classList.contains('puzzle-tile') && !element.classList.contains('empty')) {
          // Grab puzzle tile
          const index = parseInt(element.getAttribute('data-index') || '0');
          const emptyIdx = this.tiles.indexOf(8);
          const row = Math.floor(index / 3);
          const col = index % 3;
          const emptyRow = Math.floor(emptyIdx / 3);
          const emptyCol = emptyIdx % 3;
          
          if (Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1) {
            this.draggedTileIndex = index;
            this.dragStartX = clientX;
            this.dragStartY = clientY;
            this.dragElement = element;
            this.translateX = 0;
            this.translateY = 0;
            
            this.dragElement.style.transition = 'none'; // Disable snap animation while dragging
            this.dragElement.style.zIndex = '100'; // Bring to front
            this.cursor.style.background = '#ffd166'; // Show grab state
          }
        }
      }
    } else if (isCurrentlyPinching && this.isPinching && this.draggedTileIndex !== null && this.dragElement) {
      // DRAGGING
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      
      const emptyIdx = this.tiles.indexOf(8);
      const row = Math.floor(this.draggedTileIndex / 3);
      const col = this.draggedTileIndex % 3;
      const emptyRow = Math.floor(emptyIdx / 3);
      const emptyCol = emptyIdx % 3;
      
      this.translateX = 0;
      this.translateY = 0;
      
      if (emptyRow === row) {
        if (emptyCol > col) this.translateX = Math.max(0, Math.min(dx, 200));
        else this.translateX = Math.min(0, Math.max(dx, -200));
      } else if (emptyCol === col) {
        if (emptyRow > row) this.translateY = Math.max(0, Math.min(dy, 150));
        else this.translateY = Math.min(0, Math.max(dy, -150));
      }
      
      this.dragElement.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`;
      
    } else if (!isCurrentlyPinching && this.isPinching && this.draggedTileIndex !== null) {
      // PINCH RELEASE (DROP)
      const emptyIdx = this.tiles.indexOf(8);
      
      // If dragged more than 50% of the way, swap
      if (Math.abs(this.translateX) > 100 || Math.abs(this.translateY) > 75) {
        this.tiles[emptyIdx] = this.tiles[this.draggedTileIndex];
        this.tiles[this.draggedTileIndex] = 8;
      }
      
      this.draggedTileIndex = null;
      this.dragElement = null;
      this.cursor.style.background = '#06d6a0'; // Reset cursor
      this.renderPuzzleBoard(); // Snap everything back or show new state
      this.checkWin();
    }

    this.isPinching = isCurrentlyPinching;
  }
}
