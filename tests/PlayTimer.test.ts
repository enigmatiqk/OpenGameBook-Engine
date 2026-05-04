import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PlayTimer } from '../src/engine/PlayTimer'

describe('PlayTimer', () => {
  let timer: PlayTimer

  beforeEach(() => {
    vi.useFakeTimers()
    timer = new PlayTimer()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 before start', () => {
    expect(timer.getElapsedMs()).toBe(0)
  })

  it('accumulates time after start', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 1000)
    expect(timer.getElapsedMs()).toBe(1000)
  })

  it('stops accumulating after pause', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 500)
    timer.pause()
    const elapsed = timer.getElapsedMs()
    vi.setSystemTime(Date.now() + 1000) // advance time while paused
    expect(timer.getElapsedMs()).toBe(elapsed) // should not change
  })

  it('resumes accumulating after resume', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 300)
    timer.pause()
    vi.setSystemTime(Date.now() + 500) // time passes while paused — not counted
    timer.resume()
    vi.setSystemTime(Date.now() + 200)
    expect(timer.getElapsedMs()).toBe(500) // 300 + 200
  })

  it('accumulates time across multiple pause/resume cycles', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 100)
    timer.pause()

    vi.setSystemTime(Date.now() + 999) // idle — not counted
    timer.resume()
    vi.setSystemTime(Date.now() + 200)
    timer.pause()

    vi.setSystemTime(Date.now() + 999) // idle — not counted
    timer.resume()
    vi.setSystemTime(Date.now() + 300)

    expect(timer.getElapsedMs()).toBe(600) // 100 + 200 + 300
  })

  it('reset brings elapsed back to 0 and stops the timer', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 1000)
    timer.reset()
    expect(timer.getElapsedMs()).toBe(0)
    vi.setSystemTime(Date.now() + 500) // time passes after reset — not counted
    expect(timer.getElapsedMs()).toBe(0)
  })

  it('start is idempotent — calling start twice does not reset accumulated time', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 400)
    timer.start() // second call should be a no-op
    vi.setSystemTime(Date.now() + 100)
    expect(timer.getElapsedMs()).toBe(500)
  })

  it('resume is idempotent — calling resume while running has no effect', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 200)
    timer.resume() // no-op
    vi.setSystemTime(Date.now() + 300)
    expect(timer.getElapsedMs()).toBe(500)
  })

  it('pause is idempotent — calling pause while already paused has no effect', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 100)
    timer.pause()
    timer.pause() // no-op
    expect(timer.getElapsedMs()).toBe(100)
  })

  it('start after reset restarts from zero', () => {
    timer.start()
    vi.setSystemTime(Date.now() + 1000)
    timer.reset()
    timer.start()
    vi.setSystemTime(Date.now() + 250)
    expect(timer.getElapsedMs()).toBe(250)
  })
})
