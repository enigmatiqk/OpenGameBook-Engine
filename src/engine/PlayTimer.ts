/**
 * PlayTimer — measures active play time.
 * Time accumulates only during active phases (between start/resume and pause).
 * Uses Date.now() internally.
 */
export class PlayTimer {
  private accumulatedMs = 0
  private activeStart: number | null = null

  /** Start the timer from zero. No-op if already running. */
  start(): void {
    if (this.activeStart !== null) return
    this.accumulatedMs = 0
    this.activeStart = Date.now()
  }

  /** Pause the timer. Accumulates elapsed time since last start/resume. */
  pause(): void {
    if (this.activeStart === null) return
    this.accumulatedMs += Date.now() - this.activeStart
    this.activeStart = null
  }

  /** Resume after a pause. No-op if already running. */
  resume(): void {
    if (this.activeStart !== null) return
    this.activeStart = Date.now()
  }

  /** Returns total accumulated milliseconds (including current active phase). */
  getElapsedMs(): number {
    if (this.activeStart !== null) {
      return this.accumulatedMs + (Date.now() - this.activeStart)
    }
    return this.accumulatedMs
  }

  /** Reset everything to zero and stop the timer. */
  reset(): void {
    this.accumulatedMs = 0
    this.activeStart = null
  }

  /** Set accumulated time without starting the timer (used to restore saved time). */
  setElapsedMs(ms: number): void {
    this.accumulatedMs = ms
    this.activeStart = null
  }
}
