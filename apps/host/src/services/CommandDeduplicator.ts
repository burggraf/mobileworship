/**
 * Tracks recently processed command IDs to prevent duplicate execution
 * when commands arrive via both local WebSocket and Supabase Realtime
 */
export class CommandDeduplicator {
  private processedIds: Map<string, number> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 50, ttlMs = 5000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Check if a command ID has been seen recently
   * @returns true if this is a duplicate (should be skipped)
   */
  isDuplicate(commandId: string): boolean {
    const now = Date.now();

    // Clean up expired entries
    this.cleanup(now);

    // Check if we've seen this ID
    if (this.processedIds.has(commandId)) {
      return true;
    }

    // Record this ID
    this.processedIds.set(commandId, now);
    return false;
  }

  private cleanup(now: number): void {
    // Remove expired entries
    for (const [id, timestamp] of this.processedIds) {
      if (now - timestamp > this.ttlMs) {
        this.processedIds.delete(id);
      }
    }

    // If still too large, remove oldest
    if (this.processedIds.size > this.maxSize) {
      const entries = Array.from(this.processedIds.entries());
      entries.sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - this.maxSize);
      for (const [id] of toRemove) {
        this.processedIds.delete(id);
      }
    }
  }

  clear(): void {
    this.processedIds.clear();
  }
}
