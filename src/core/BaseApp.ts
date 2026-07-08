export interface BaseApp {
  /** Called when the app is mounted/started. Should initialize UI and subscriptions. */
  start(container: HTMLElement): void;
  
  /** Called when the app is unmounted/stopped. Should clean up UI and subscriptions. */
  stop(): void;
}
