// Simple sliding window rate limiter for real-time socket events (PRD Section 10)

export class RateLimiter {
  private windowMs: number;
  private maxEvents: number;
  // Map of socketId -> array of event timestamps
  private records: Map<string, number[]> = new Map();

  constructor(maxEvents: number, windowMs: number = 1000) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
  }

  /**
   * Checks if an incoming event exceeds the allowed rate.
   * Returns true if allowed, false if rate limit exceeded.
   */
  public allow(key: string): boolean {
    const now = Date.now();
    let timestamps = this.records.get(key);

    if (!timestamps) {
      timestamps = [now];
      this.records.set(key, timestamps);
      return true;
    }

    // Filter out timestamps outside the sliding window
    const threshold = now - this.windowMs;
    const recent = timestamps.filter((t) => t > threshold);

    if (recent.length >= this.maxEvents) {
      this.records.set(key, recent);
      return false; // Rate limit exceeded
    }

    recent.push(now);
    this.records.set(key, recent);
    return true;
  }

  /**
   * Cleans up tracking data when a socket disconnects
   */
  public cleanup(key: string): void {
    this.records.delete(key);
  }
}

// Global rate limiter for draw_move events (120 moves per second per socket)
export const drawMoveRateLimiter = new RateLimiter(120, 1000);

// Rate limiter for guess/chat events (5 messages per 3 seconds per socket, PRD Section 10)
export const generalRateLimiter = new RateLimiter(5, 3000);
