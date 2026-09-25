type BackHandler = () => void;

interface StackItem {
  id: string;
  onPop: BackHandler;
}

class NavigationStack {
  private stack: StackItem[] = [];
  private lastBackPressTime = 0;
  private onToastMessage?: (msg: string) => void;
  private isInitialized = false;
  private pendingProgrammaticPops = 0;
  private popsCleanupTimer: ReturnType<typeof setTimeout> | null = null;

  init(toastCallback?: (msg: string) => void) {
    this.onToastMessage = toastCallback;
    if (this.isInitialized) {
      return () => {};
    }
    this.isInitialized = true;

    // Set initial baseline history traps to prevent accidental exit from root
    try {
      if (!window.history.state || window.history.state.schemaxRoot !== true) {
        window.history.replaceState({ schemaxRoot: true, level: 0 }, '');
        window.history.pushState({ schemaxRoot: true, level: 1 }, '');
      }
    } catch (e) {
      // ignore
    }

    const handlePopState = () => {
      // If this popstate event was triggered by our own in-app navStack.pop(),
      // consume it and do NOT pop anything else from the navigation stack!
      if (this.pendingProgrammaticPops > 0) {
        this.pendingProgrammaticPops--;
        return;
      }

      if (this.stack.length > 0) {
        // Pop the topmost handler and execute it
        const top = this.stack.pop();
        if (top) {
          try {
            top.onPop();
          } catch (err) {
            console.error('Error executing back handler:', err);
          }
        }
      } else {
        // At root dashboard / works
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
          // Double press back within 2 seconds -> Allow natural browser exit
          try {
            window.history.back();
          } catch (e) {}
        } else {
          this.lastBackPressTime = now;
          if (this.onToastMessage) {
            this.onToastMessage('Tekan sekali lagi untuk keluar dari Schemax');
          }
          // Re-trap root history so single tap doesn't exit web app
          try {
            window.history.pushState({ schemaxRoot: true, level: 1 }, '');
          } catch (e) {}
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      this.isInitialized = false;
    };
  }

  push(id: string, onPop: BackHandler) {
    // Prevent duplicate entries of the same id
    this.stack = this.stack.filter((item) => item.id !== id);
    this.stack.push({ id, onPop });
    try {
      window.history.pushState({ schemaxNav: id, time: Date.now() }, '');
    } catch (e) {}
  }

  pop(id?: string) {
    if (this.stack.length === 0) return;

    if (id) {
      const idx = this.stack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        // Remove from stack and trigger history back
        this.stack.splice(idx, 1);
        this.pendingProgrammaticPops++;
        try {
          window.history.back();
        } catch (e) {
          this.pendingProgrammaticPops = Math.max(0, this.pendingProgrammaticPops - 1);
        }
        this.schedulePopsCleanup();
      }
    } else {
      this.stack.pop();
      this.pendingProgrammaticPops++;
      try {
        window.history.back();
      } catch (e) {
        this.pendingProgrammaticPops = Math.max(0, this.pendingProgrammaticPops - 1);
      }
      this.schedulePopsCleanup();
    }
  }

  private schedulePopsCleanup() {
    if (this.popsCleanupTimer) {
      clearTimeout(this.popsCleanupTimer);
    }
    this.popsCleanupTimer = setTimeout(() => {
      if (this.pendingProgrammaticPops > 0) {
        this.pendingProgrammaticPops = 0;
      }
    }, 600);
  }

  has(id: string): boolean {
    return this.stack.some((item) => item.id === id);
  }

  clear() {
    this.stack = [];
    this.pendingProgrammaticPops = 0;
  }
}

export const navStack = new NavigationStack();

