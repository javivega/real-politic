interface CachedAnalysis {
  id: string;
  analysis: any;
  timestamp: number;
  cost: number;
  initiativeHash: string;
}

class AICacheService {
  private readonly CACHE_KEY = 'ai_analysis_cache';
  private readonly MAX_CACHE_SIZE = 1000; // Store up to 1000 analyses
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  
  /**
   * Get cached analysis for an initiative
   */
  getCachedAnalysis(initiativeId: string, initiativeHash: string): any | null {
    try {
      const cache = this.getCache();
      const cached = cache[initiativeId];
      
      if (!cached) return null;
      
      // Check if hash matches (content hasn't changed)
      if (cached.initiativeHash !== initiativeHash) {
        console.log('🔄 Initiative content changed, invalidating cache');
        this.removeFromCache(initiativeId);
        return null;
      }
      
      // Check if cache is still valid
      if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
        console.log('⏰ Cache expired, removing old analysis');
        this.removeFromCache(initiativeId);
        return null;
      }
      
      console.log('✅ Using cached AI analysis (saved $0.001)');
      return cached.analysis;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }
  
  /**
   * Cache analysis result
   */
  cacheAnalysis(initiativeId: string, analysis: any, initiativeHash: string): void {
    try {
      const cache = this.getCache();
      
      // Clean up old entries if cache is full
      if (Object.keys(cache).length >= this.MAX_CACHE_SIZE) {
        this.cleanupOldEntries();
      }
      
      // Store new analysis
      cache[initiativeId] = {
        id: initiativeId,
        analysis,
        timestamp: Date.now(),
        cost: 0.001, // Estimated cost saved
        initiativeHash
      };
      
      this.saveCache(cache);
      console.log('💾 AI analysis cached for future use');
    } catch (error) {
      console.error('Error caching analysis:', error);
    }
  }
  
  /**
   * Remove specific analysis from cache
   */
  removeFromCache(initiativeId: string): void {
    try {
      const cache = this.getCache();
      delete cache[initiativeId];
      this.saveCache(cache);
    } catch (error) {
      console.error('Error removing from cache:', error);
    }
  }
  
  /**
   * Clear entire cache
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      console.log('🗑️ AI analysis cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalCostSaved: number;
    oldestEntry: Date | null;
    cacheSize: string;
  } {
    try {
      const cache = this.getCache();
      const entries = Object.values(cache);
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          totalCostSaved: 0,
          oldestEntry: null,
          cacheSize: '0 KB'
        };
      }
      
      const totalCostSaved = entries.reduce((sum, entry) => sum + entry.cost, 0);
      const oldestTimestamp = Math.min(...entries.map(e => e.timestamp));
      const oldestEntry = new Date(oldestTimestamp);
      
      // Calculate cache size
      const cacheSize = new Blob([JSON.stringify(cache)]).size;
      const cacheSizeKB = (cacheSize / 1024).toFixed(2);
      
      return {
        totalEntries: entries.length,
        totalCostSaved: totalCostSaved,
        oldestEntry,
        cacheSize: `${cacheSizeKB} KB`
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalCostSaved: 0,
        oldestEntry: null,
        cacheSize: '0 KB'
      };
    }
  }
  
  /**
   * Clean up old cache entries
   */
  private cleanupOldEntries(): void {
    try {
      const cache = this.getCache();
      const now = Date.now();
      const entries = Object.entries(cache);
      
      // Sort by timestamp (oldest first)
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      // Remove oldest 20% of entries
      const entriesToRemove = Math.ceil(entries.length * 0.2);
      const removedEntries = entries.slice(0, entriesToRemove);
      
      removedEntries.forEach(([id]) => {
        delete cache[id];
      });
      
      this.saveCache(cache);
      console.log(`🧹 Cleaned up ${removedEntries.length} old cache entries`);
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }
  
  /**
   * Generate hash for initiative content to detect changes
   */
  generateInitiativeHash(objeto: string, partido?: string, resultado?: string): string {
    const content = `${objeto}|${partido || ''}|${resultado || ''}`;
    let hash = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }
  
  /**
   * Get cache from localStorage
   */
  private getCache(): Record<string, CachedAnalysis> {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Error reading cache from localStorage:', error);
      return {};
    }
  }
  
  /**
   * Save cache to localStorage
   */
  private saveCache(cache: Record<string, CachedAnalysis>): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
    }
  }
}

export default AICacheService;
export type { CachedAnalysis }; 