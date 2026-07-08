import type { Hands, Results } from '@mediapipe/hands';
import type { Camera } from '@mediapipe/camera_utils';

declare global {
  interface Window {
    Hands: typeof Hands;
    Camera: typeof Camera;
  }
}

export type HandEventCallback = (results: Results) => void;

export class HandTrackingEngine {
  private static instance: HandTrackingEngine | null = null;
  private hands: Hands | null = null;
  private camera: Camera | null = null;
  private listeners: HandEventCallback[] = [];
  private videoElement: HTMLVideoElement | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  public static getInstance(): HandTrackingEngine {
    if (!HandTrackingEngine.instance) {
      HandTrackingEngine.instance = new HandTrackingEngine();
    }
    return HandTrackingEngine.instance;
  }

  public async start(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isRunning) return;
    this.videoElement = videoElement;

    if (!this.hands) {
      this.hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.75,
      });

      this.hands.onResults((results) => {
        this.listeners.forEach((cb) => cb(results));
      });
    }

    this.camera = new window.Camera(this.videoElement, {
      onFrame: async () => {
        if (this.videoElement && this.hands) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: 1280,
      height: 720,
    });

    await this.camera.start();
    this.isRunning = true;
  }

  public stop() {
    if (this.camera) {
      this.camera.stop();
    }
    this.isRunning = false;
  }

  public subscribe(callback: HandEventCallback) {
    this.listeners.push(callback);
  }

  public unsubscribe(callback: HandEventCallback) {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }
}
