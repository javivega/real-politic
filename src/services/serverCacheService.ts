import { supabase } from '../lib/supabase';
import { CongressInitiative } from '../lib/supabase';

export interface AIAnalysisCache {
  id: string;
  initiative_id: string;
  problem_analysis: string | null;
  external_research: string | null;
  technical_pros_cons: {
    analysis: string;
    sources: Array<{
      title: string;
      author: string;
      institution: string;
      year: string;
      url?: string;
      key_findings: string;
    }>;
    economic_impact: string;
    social_impact: string;
    societal_impact: string;
  } | null;
  content_hash: string;
  model_used: string;
  tokens_used: number | null;
  cost_usd: number | null;
  generation_time_ms: number | null;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CachedAnalysis {
  problem_analysis: string | null;
  external_research: string | null;
  technical_pros_cons: {
    analysis: string;
    economic_impact: string;
    social_impact: string;
    societal_impact: string;
  } | null;
  is_cached: boolean;
  cache_age_hours: number;
  cost_saved: number;
}

export class ServerCacheService {
  /**
   * Generates a hash for initiative content to detect changes
   */
  private generateContentHash(initiative: CongressInitiative): string {
    const content = `${initiative.objeto || ''}-${initiative.tipo || ''}-${initiative.political_party_short_name || ''}-${initiative.fecha_presentacion || ''}`;
    
    // Create a URL-safe hash using a simple approach
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to a positive hex string and take first 16 characters
    const positiveHash = Math.abs(hash).toString(16).padStart(8, '0');
    const finalHash = positiveHash.slice(0, 16);
    
    console.log('🔍 Content hash generation details:');
    console.log('  - objeto:', initiative.objeto?.substring(0, 100) + '...');
    console.log('  - tipo:', initiative.tipo);
    console.log('  - political_party_short_name:', initiative.political_party_short_name);
    console.log('  - fecha_presentacion:', initiative.fecha_presentacion);
    console.log('  - raw content:', content);
    console.log('  - generated hash:', finalHash);
    return finalHash;
  }

  /**
   * Gets cached analysis for an initiative
   */
  async getCachedAnalysis(initiative: CongressInitiative): Promise<CachedAnalysis | null> {
    try {
      const contentHash = this.generateContentHash(initiative);
      console.log('🔍 Checking cache for initiative:', initiative.id);
      console.log('🔍 Content hash:', contentHash);
      
      // First, let's test if the table exists and has data
      const { data: testData, error: testError } = await supabase
        .from('ai_analysis_cache')
        .select('count')
        .limit(1);
      
      console.log('🔍 Table test result:', { testData, testError });
      
      // First try to find by initiative_id only (more flexible)
      let { data, error } = await supabase
        .from('ai_analysis_cache')
        .select('*')
        .eq('initiative_id', initiative.id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('🔍 Cache query result by initiative_id:', { data, error });

      if (error) {
        console.log('🔍 Database error when checking cache:', error);
        return null;
      }
      
      if (!data) {
        console.log('🔍 No cache entry found for initiative:', initiative.id);
        console.log('🔍 Content hash searched:', contentHash);
        return null;
      }
      
      // If we found data, check if content hash matches (for validation)
      if (data.content_hash !== contentHash) {
        console.log('🔍 Content hash mismatch for initiative:', initiative.id);
        console.log('🔍 Stored hash:', data.content_hash);
        console.log('🔍 Current hash:', contentHash);
        console.log('🔍 But using cached data anyway since initiative_id matches');
      }
      
      console.log('🔍 Cache hit for initiative:', initiative.id);
      console.log('🔍 Cache entry ID:', data.id);
      console.log('🔍 Cache entry created at:', data.created_at);
      console.log('🔍 Has problem analysis:', !!data.problem_analysis);
      console.log('🔍 Has external research:', !!data.external_research);
      console.log('🔍 Has technical pros/cons:', !!data.technical_pros_cons);

      // Calculate cache age and cost savings
      const cacheAge = new Date().getTime() - new Date(data.created_at).getTime();
      const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60));
      const costSaved = data.cost_usd || 0;

      // Ensure technical_pros_cons is properly parsed
      let technicalProsCons = data.technical_pros_cons;
      if (typeof technicalProsCons === 'string') {
        try {
          technicalProsCons = JSON.parse(technicalProsCons);
        } catch (e) {
          console.warn('Failed to parse technical_pros_cons from cache:', e);
          technicalProsCons = null;
        }
      }

      return {
        problem_analysis: data.problem_analysis,
        external_research: data.external_research,
        technical_pros_cons: technicalProsCons,
        is_cached: true,
        cache_age_hours: cacheAgeHours,
        cost_saved: costSaved
      };
    } catch (error) {
      console.error('Error getting cached analysis:', error);
      return null;
    }
  }

  /**
   * Saves analysis to server cache
   */
  async saveToCache(
    initiative: CongressInitiative,
    problemAnalysis: string | null,
    externalResearch: string | null,
    technicalProsCons: any | null,
    metadata: {
      tokensUsed: number;
      costUsd: number;
      generationTimeMs: number;
    }
  ): Promise<void> {
    try {
      const contentHash = this.generateContentHash(initiative);
      
      console.log('🔍 Saving to cache for initiative:', initiative.id);
      console.log('🔍 Content hash:', contentHash);
      console.log('🔍 Has problem analysis:', !!problemAnalysis);
      console.log('🔍 Has external research:', !!externalResearch);
      console.log('🔍 Has technical pros/cons:', !!technicalProsCons);

      // Use UPSERT to handle conflicts gracefully
      const { data, error } = await supabase
        .from('ai_analysis_cache')
        .upsert({
          initiative_id: initiative.id,
          content_hash: contentHash,
          problem_analysis: problemAnalysis || '',
          external_research: externalResearch || '',
          technical_pros_cons: technicalProsCons ? JSON.stringify(technicalProsCons) : null,
          model_used: 'gpt-3.5-turbo',
          is_active: true,
          tokens_used: metadata.tokensUsed,
          cost_usd: metadata.costUsd,
          generation_time_ms: metadata.generationTimeMs
        }, {
          onConflict: 'initiative_id,content_hash',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('🔍 Error upserting cache entry:', error);
        throw error;
      }

      console.log('🔍 Successfully saved to cache for initiative:', initiative.id);
      console.log('🔍 Cache entry upserted successfully');
      
    } catch (error) {
      console.error('🔍 Error saving to cache:', error);
      throw error;
    }
  }

  /**
   * Gets cache statistics
   */
  async getCacheStats(): Promise<{
    total_cached: number;
    total_cost_saved: number;
    average_age_hours: number;
    most_recent: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_cache')
        .select('cost_usd, created_at')
        .eq('is_active', true);

      if (error || !data) {
        return {
          total_cached: 0,
          total_cost_saved: 0,
          average_age_hours: 0,
          most_recent: null
        };
      }

      const totalCached = data.length;
      const totalCostSaved = data.reduce((sum, item) => sum + (item.cost_usd || 0), 0);
      
      const now = new Date().getTime();
      const ages = data.map(item => (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60));
      const averageAgeHours = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
      
      const mostRecent = data.reduce((latest, item) => {
        const itemDate = new Date(item.created_at);
        if (!latest || itemDate > new Date(latest)) {
          return item.created_at;
        }
        return latest;
      }, null as string | null);

      return {
        total_cached: totalCached,
        total_cost_saved: totalCostSaved,
        average_age_hours: averageAgeHours,
        most_recent: mostRecent
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        total_cached: 0,
        total_cost_saved: 0,
        average_age_hours: 0,
        most_recent: null
      };
    }
  }

  /**
   * Clears cache for a specific initiative
   */
  async clearInitiativeCache(initiativeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_analysis_cache')
        .update({ is_active: false })
        .eq('initiative_id', initiativeId);

      if (error) {
        console.error('Error clearing initiative cache:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error clearing initiative cache:', error);
      return false;
    }
  }

  /**
   * Clears all cache
   */
  async clearAllCache(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_analysis_cache')
        .update({ is_active: false });

      if (error) {
        console.error('Error clearing all cache:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error clearing all cache:', error);
      return false;
    }
  }
} 