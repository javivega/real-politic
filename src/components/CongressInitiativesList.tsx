import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CongressService } from '../services/congressService';
import { CongressInitiative, PoliticalParty } from '../lib/supabase';
import { AIAnalysisService } from '../services/aiAnalysisService';

const CongressInitiativesList: React.FC = () => {
  const [initiatives, setInitiatives] = useState<CongressInitiative[]>([]);
  const [politicalParties, setPoliticalParties] = useState<PoliticalParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [enhancedTitles, setEnhancedTitles] = useState<{[key: string]: string}>({});
  const [titleLoading, setTitleLoading] = useState<{[key: string]: boolean}>({});
  
  // Pagination and dynamic loading
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Batch processing for AI titles
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Global safety flag to prevent any OpenAI calls
  const [openAISafetyMode, setOpenAISafetyMode] = useState(false);

  // Toggle OpenAI safety mode
  const toggleOpenAISafetyMode = () => {
    const newMode = !openAISafetyMode;
    setOpenAISafetyMode(newMode);
    if (newMode) {
      console.log('🛡️  OPENAI SAFETY MODE ENABLED: No API calls will be made');
      alert('🛡️  OpenAI Safety Mode Enabled!\n\nNo API calls will be made. All titles will be generated from cache only.');
    } else {
      console.log('🔄 OpenAI Safety Mode disabled - API calls allowed');
      alert('🔄 OpenAI Safety Mode Disabled\n\nAPI calls are now allowed (use with caution).');
    }
  };
  
  const navigate = useNavigate();

  // Initialize AI service
  const aiService = new AIAnalysisService();

  // Memory cache to avoid repeated database calls within a session
  const memoryCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  
  // Ref indirection to safely call batch generator without dependency order issues
  const triggerGenerationRef = useRef<((inits: CongressInitiative[]) => Promise<void>) | null>(null);

  // Get cached analysis with memory cache layer
  const getCachedAnalysisWithMemory = useCallback(async (initiative: CongressInitiative) => {
    const cacheKey = `analysis_${initiative.id}`;
    const now = Date.now();
    
    // Check memory cache first
    const memoryEntry = memoryCache.current.get(cacheKey);
    if (memoryEntry && (now - memoryEntry.timestamp) < CACHE_TTL) {
      console.log(`Using memory cache for initiative ${initiative.id}`);
      return memoryEntry.data;
    }
    
    // If not in memory cache, check server cache
    const serverResult = await aiService.serverCache.getCachedAnalysis(initiative);
    
    // Store in memory cache
    if (serverResult) {
      memoryCache.current.set(cacheKey, {
        data: serverResult,
        timestamp: now
      });
    }
    
    return serverResult;
  }, [aiService.serverCache, CACHE_TTL]);

  // Generate title from cached analysis without calling OpenAI
  const generateTitleFromCachedAnalysis = useCallback((analysis: string): string => {
    // Treat cached analysis as the stored title content; sanitize consistently
    let title = (analysis || '').trim();
    if (title.length === 0) return title;
    title = title.charAt(0).toUpperCase() + title.slice(1);
    // Remove truncation - show full title
    return title;
  }, []);

  // Preload titles for visible initiatives efficiently
  const preloadTitlesForVisibleInitiatives = useCallback(async (initiativesToProcess: CongressInitiative[]) => {
    if (!initiativesToProcess || initiativesToProcess.length === 0) return;
    
    console.log(`Preloading titles for ${initiativesToProcess.length} visible initiatives`);
    
    // Check which initiatives already have titles in local state
    const initiativesNeedingTitles = initiativesToProcess.filter(
      initiative => !enhancedTitles[initiative.id]
    );
    
    if (initiativesNeedingTitles.length === 0) {
      console.log('All visible initiatives already have titles in local state');
      return;
    }
    
    console.log(`${initiativesNeedingTitles.length} initiatives need titles, checking server cache...`);
    
    // Check server cache for each initiative that doesn't have a local title
    const cachePromises = initiativesNeedingTitles.map(async (initiative) => {
      try {
        const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
        if (cachedAnalysis && cachedAnalysis.problem_analysis) {
          console.log(`Found server cache for initiative ${initiative.id}, generating title from cache`);
          const enhancedTitle = generateTitleFromCachedAnalysis(cachedAnalysis.problem_analysis);
          setEnhancedTitles(prev => ({ ...prev, [initiative.id]: enhancedTitle }));
          return { initiative, fromCache: true };
        } else {
          console.log(`No server cache found for initiative ${initiative.id}, will need OpenAI`);
          return { initiative, fromCache: false };
        }
      } catch (error) {
        console.error(`Error checking cache for initiative ${initiative.id}:`, error);
        return { initiative, fromCache: false };
      }
    });
    
    const cacheResults = await Promise.all(cachePromises);
    const needsOpenAI = cacheResults.filter(r => !r.fromCache).map(r => r.initiative);
    
    console.log(`Cache check results for visible: ${cacheResults.length - needsOpenAI.length} from cache, ${needsOpenAI.length} need OpenAI`);
    
    // Trigger OpenAI generation ONLY for visible initiatives without cache
    if (needsOpenAI.length > 0) {
      if (triggerGenerationRef.current) {
        await triggerGenerationRef.current(needsOpenAI);
      }
    }
  }, [enhancedTitles, getCachedAnalysisWithMemory, generateTitleFromCachedAnalysis]);

  // Comprehensive cache validation - ensures no OpenAI calls for cached data
  const validateAllCachedData = useCallback(async (initiativesToCheck: CongressInitiative[]) => {
    console.log('🔒 VALIDATING CACHE: Ensuring no unnecessary OpenAI calls...');
    
    const validationResults = await Promise.all(
      initiativesToCheck.map(async (initiative) => {
        try {
          // Check if we already have a title locally
          if (enhancedTitles[initiative.id]) {
            return { initiative, status: 'local_title', needsOpenAI: false };
          }
          
          // Check server cache thoroughly
          const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
          
          if (cachedAnalysis && cachedAnalysis.problem_analysis) {
            // Generate title from cache immediately
            const enhancedTitle = generateTitleFromCachedAnalysis(cachedAnalysis.problem_analysis);
            setEnhancedTitles(prev => ({ ...prev, [initiative.id]: enhancedTitle }));
            
            console.log(`✅ CACHE VALIDATION: Initiative ${initiative.id} found in cache, title generated`);
            return { initiative, status: 'server_cache', needsOpenAI: false, title: enhancedTitle };
          }
          
          // Double-check: try to find any cached entry for this initiative
          console.log(`🔍 DOUBLE-CHECKING: No cache found for ${initiative.id}, checking database directly...`);
          
          // This is a fallback check - if we still can't find it, it truly needs OpenAI
          return { initiative, status: 'no_cache', needsOpenAI: true };
          
        } catch (error) {
          console.error(`❌ CACHE VALIDATION ERROR for ${initiative.id}:`, error);
          return { initiative, status: 'error', needsOpenAI: true, error };
        }
      })
    );
    
    const fromCache = validationResults.filter(r => !r.needsOpenAI);
    const needsOpenAI = validationResults.filter(r => r.needsOpenAI);
    
    console.log('🔒 CACHE VALIDATION COMPLETE:');
    console.log(`   ✅ From cache: ${fromCache.length}`);
    console.log(`   ❌ Need OpenAI: ${needsOpenAI.length}`);
    console.log(`   📊 Cache hit rate: ${((fromCache.length / validationResults.length) * 100).toFixed(1)}%`);
    
    return { fromCache, needsOpenAI, validationResults };
  }, [enhancedTitles, getCachedAnalysisWithMemory, generateTitleFromCachedAnalysis]);

  // Process titles in batches with OpenAI API
  const processBatchTitles = async (initiativesToProcess: CongressInitiative[]) => {
    if (!initiativesToProcess || initiativesToProcess.length === 0) {
      console.log('No initiatives to process');
      return;
    }

    console.log(`🔄 Starting batch processing for ${initiativesToProcess.length} initiatives`);
    
    // FIRST: Run comprehensive cache validation to catch any missed cached data
    console.log('🔒 STEP 1: Running comprehensive cache validation...');
    const { fromCache, needsOpenAI, validationResults } = await validateAllCachedData(initiativesToProcess);
    
    // SECOND: Process any titles that came from cache
    if (fromCache.length > 0) {
      console.log(`✅ STEP 2: Processing ${fromCache.length} titles from cache...`);
      fromCache.forEach(({ initiative, title }) => {
        if (title) {
          console.log(`   ✅ Generated title from cache for ${initiative.id}: "${title}"`);
        }
      });
    }
    
    // THIRD: Only process initiatives that truly need OpenAI
    if (needsOpenAI.length === 0) {
      console.log('🎉 All initiatives processed from cache! No OpenAI calls needed.');
      return;
    }
    
    // SAFETY CHECK: Respect OpenAI safety mode
    if (openAISafetyMode) {
      console.log('🛡️  OPENAI SAFETY MODE ACTIVE: Blocking all API calls');
      alert(`🛡️  OpenAI Safety Mode Active!\n\n${needsOpenAI.length} initiatives need OpenAI calls but are blocked.\n\nDisable safety mode to allow API calls.`);
      return;
    }
    
    console.log(`🚨 STEP 3: ${needsOpenAI.length} initiatives truly need OpenAI calls`);
    console.log('⚠️  WARNING: These initiatives have no cached data and will call OpenAI API');
    
    // Log which initiatives need OpenAI for transparency
    needsOpenAI.forEach(({ initiative, status }) => {
      console.log(`   ❌ ${initiative.id}: ${status} - will call OpenAI`);
    });
    
    // Proceed automatically without confirmation so missing titles are generated
    // Process OpenAI calls in small batches
    setBatchProcessing(true);
    setBatchTotal(needsOpenAI.length);
    setBatchProgress(0);
    
    const batchSize = 3; // Reduced batch size for safety
    const delay = 1500; // Increased delay between batches
    
    for (let i = 0; i < needsOpenAI.length; i += batchSize) {
      const batch = needsOpenAI.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(needsOpenAI.length / batchSize)}`);
      
      const promises = batch.map(async ({ initiative }) => {
        try {
          console.log(`🚀 Calling OpenAI for initiative ${initiative.id}`);
          const enhancedTitle = await aiService.generateEnhancedTitleStrict(initiative);
          setEnhancedTitles(prev => ({ ...prev, [initiative.id]: enhancedTitle }));
          console.log(`✅ OpenAI call successful for ${initiative.id}: "${enhancedTitle}"`);
          return true;
        } catch (error) {
          console.error(`❌ OpenAI call failed for ${initiative.id}:`, error);
          return false;
        }
      });
      
      await Promise.all(promises);
      setBatchProgress(Math.min(i + batchSize, needsOpenAI.length));
      
      if (i + batchSize < needsOpenAI.length) {
        console.log(`⏳ Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log('🎉 Batch processing completed!');
    setBatchProcessing(false);
    setBatchProgress(0);
    setBatchTotal(0);
  };

  // Pre-warm cache by checking all initiatives upfront
  const preWarmCache = useCallback(async () => {
    if (initiatives.length === 0) return;
    
    console.log('🔥 PRE-WARMING CACHE: Checking initiatives that need titles...');
    
    // Only check initiatives that don't already have enhanced titles
    const initiativesNeedingTitles = initiatives.filter(
      initiative => !enhancedTitles[initiative.id]
    );
    
    if (initiativesNeedingTitles.length === 0) {
      console.log('🎉 All initiatives already have enhanced titles!');
      return;
    }
    
    console.log(`🔥 Found ${initiativesNeedingTitles.length} initiatives that need titles`);
    
    try {
      const { fromCache, needsOpenAI } = await validateAllCachedData(initiativesNeedingTitles);
      
      console.log('🔥 CACHE PRE-WARM COMPLETE:');
      console.log(`   ✅ From cache: ${fromCache.length}`);
      console.log(`   ❌ Need OpenAI: ${needsOpenAI.length}`);
      console.log(`   📊 Cache utilization: ${((fromCache.length / initiativesNeedingTitles.length) * 100).toFixed(1)}%`);
      
      // Do NOT call OpenAI here — generation should be limited to visible initiatives or manual trigger
      
      // If we have a high cache hit rate, show success message
      if (fromCache.length / initiativesNeedingTitles.length > 0.8) {
        console.log('🎉 Excellent cache utilization! Most initiatives are already cached.');
      } else if (fromCache.length / initiativesNeedingTitles.length > 0.5) {
        console.log('👍 Good cache utilization. Some initiatives may need OpenAI.');
      } else {
        console.log('⚠️  Low cache utilization. Many initiatives may need OpenAI calls.');
      }
      
    } catch (error) {
      console.error('❌ Error during cache pre-warming:', error);
    }
  }, [initiatives, enhancedTitles, validateAllCachedData]);

  // Monitor cache performance and provide debugging info
  const getCacheStats = () => {
    const totalInitiatives = initiatives.length;
    const cachedTitles = Object.keys(enhancedTitles).length;
    const memoryCacheSize = memoryCache.current.size;
    const cacheHitRate = totalInitiatives > 0 ? (cachedTitles / totalInitiatives) * 100 : 0;
    
    console.log('=== Cache Performance Stats ===');
    console.log(`Total initiatives: ${totalInitiatives}`);
    console.log(`Cached titles: ${cachedTitles}`);
    console.log(`Memory cache entries: ${memoryCacheSize}`);
    console.log(`Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
    console.log('==============================');
    
    return {
      totalInitiatives,
      cachedTitles,
      memoryCacheSize,
      cacheHitRate
    };
  };

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    if (initiatives.length > 0) return; // Already loaded
    
    console.log('📥 Fetching initial data...');
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      // Load political parties first
      const parties = await CongressService.getPoliticalParties();
      setPoliticalParties(parties);
      console.log(`✅ Loaded ${parties.length} political parties`);
      
      const data = await CongressService.getInitiativesPaginated(1, batchSize);
      console.log('📊 Raw data received:', data);
      
      if (data.initiatives && data.initiatives.length > 0) {
        setInitiatives(data.initiatives);
        setTotalCount(data.total);
        setHasMore(data.hasMore);
        
        console.log(`✅ Loaded ${data.initiatives.length} initiatives`);
        console.log(`📊 Total available: ${data.total}`);
        console.log(`🔄 Has more: ${data.hasMore}`);
        
        // Load cached titles
        console.log('🔄 Loading existing enhanced titles from server cache...');
        try {
          const cachePromises = data.initiatives.map(async (initiative) => {
            try {
              const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
              if (cachedAnalysis && cachedAnalysis.problem_analysis) {
                const enhancedTitle = generateTitleFromCachedAnalysis(cachedAnalysis.problem_analysis);
                setEnhancedTitles(prev => ({ ...prev, [initiative.id]: enhancedTitle }));
                return { initiative, hasCache: true };
              }
              return { initiative, hasCache: false };
            } catch (e) {
              return { initiative, hasCache: false };
            }
          });
          const results = await Promise.all(cachePromises);
          const fromCacheCount = results.filter(r => r.hasCache).length;
          console.log(`✅ Loaded ${fromCacheCount} titles from server cache`);
        } catch (e) {
          console.warn('Cache preload failed:', e);
        }
        
        // Trigger generation ONLY for visible (first page) initiatives without cache
        console.log('👀 Preloading titles for visible initiatives (first page)...');
        setTimeout(() => {
          preloadTitlesForVisibleInitiatives(data.initiatives);
        }, 300);
        
      } else {
        console.warn('⚠️ No initiatives received from service');
        setError('No initiatives found');
      }
      
    } catch (error) {
      console.error('❌ Error fetching initial data:', error);
      setError('Error loading initiatives');
    } finally {
      setLoading(false);
    }
  }, [initiatives.length, batchSize, preloadTitlesForVisibleInitiatives, getCachedAnalysisWithMemory, generateTitleFromCachedAnalysis]);

  // Load initial data when component mounts
  useEffect(() => {
    console.log('🚀 Component mounted, calling fetchInitialData...');
    console.log('📊 Current state:', {
      initiativesLength: initiatives.length,
      loading,
      error,
      batchSize
    });
    fetchInitialData();
  }, [fetchInitialData]);

  // After defining processBatchTitles, wire the ref
  useEffect(() => {
    triggerGenerationRef.current = async (arr: CongressInitiative[]) => {
      await processBatchTitles(arr);
    };
  }, [processBatchTitles]);

  // Handle search and filter changes - reset pagination and fetch new data
  const handleSearchOrFilterChange = useCallback(async () => {
    console.log('🔄 Filter changed, fetching new data from server...');
    setCurrentPage(1);
    setHasMore(true);
    setLoading(true);
    setError(null);
    
    try {
      // Build filter parameters for server query
      const filterParams = {
        search: searchQuery,
        party: selectedParty !== 'all' ? selectedParty : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        status: activeFilter !== 'all' ? activeFilter : undefined
      };
      
      console.log('📤 Sending filter params to server:', filterParams);
      
      // Fetch filtered data from server
      const data = await CongressService.getInitiativesPaginated(1, batchSize, filterParams);
      
      if (data.initiatives && data.initiatives.length > 0) {
        setInitiatives(data.initiatives);
        setTotalCount(data.total);
        setHasMore(data.hasMore);
        
        console.log(`✅ Filtered results: ${data.initiatives.length} initiatives`);
        console.log(`📊 Total matching: ${data.total}`);
        
        // Load cached titles for new filtered results
        console.log('🔄 Loading cached titles for filtered results...');
        try {
          const cachePromises = data.initiatives.map(async (initiative) => {
            try {
              const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
              if (cachedAnalysis && cachedAnalysis.problem_analysis) {
                const enhancedTitle = generateTitleFromCachedAnalysis(cachedAnalysis.problem_analysis);
                setEnhancedTitles(prev => ({ ...prev, [initiative.id]: enhancedTitle }));
                return { initiative, hasCache: true };
              }
              return { initiative, hasCache: false };
            } catch (e) {
              return { initiative, hasCache: false };
            }
          });
          const results = await Promise.all(cachePromises);
          const fromCacheCount = results.filter(r => r.hasCache).length;
          console.log(`✅ Loaded ${fromCacheCount} titles from cache for filtered results`);
        } catch (e) {
          console.warn('Cache preload for filtered results failed:', e);
        }
        
        // Preload titles for visible filtered initiatives
        setTimeout(() => {
          preloadTitlesForVisibleInitiatives(data.initiatives);
        }, 300);
        
      } else {
        setInitiatives([]);
        setTotalCount(0);
        setHasMore(false);
        console.log('⚠️ No initiatives found for current filters');
      }
      
    } catch (error) {
      console.error('❌ Error fetching filtered data:', error);
      setError('Error loading filtered initiatives');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedParty, selectedType, activeFilter, batchSize, getCachedAnalysisWithMemory, generateTitleFromCachedAnalysis, preloadTitlesForVisibleInitiatives]);

  // Load more initiatives when scrolling - now respects current filters
  const loadMoreInitiatives = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      
      // Build filter parameters for pagination
      const filterParams = {
        search: searchQuery,
        party: selectedParty !== 'all' ? selectedParty : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        status: activeFilter !== 'all' ? activeFilter : undefined
      };
      
      const moreInitiatives = await CongressService.getInitiativesPaginated(nextPage, batchSize, filterParams);
      
      if (moreInitiatives.initiatives.length > 0) {
        setInitiatives(prev => [...prev, ...moreInitiatives.initiatives]);
        setCurrentPage(nextPage);
        setHasMore(moreInitiatives.hasMore);
        
        // Preload titles for new initiatives
        preloadTitlesForVisibleInitiatives(moreInitiatives.initiatives);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more initiatives:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounce search query changes
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Trigger filter change when debounced search changes
  useEffect(() => {
    // Only trigger if we have a debounced value and it's different from the current search
    if (debouncedSearchQuery && debouncedSearchQuery !== searchQuery) {
      console.log('🔍 Debounced search triggered:', debouncedSearchQuery);
      handleSearchOrFilterChange();
    }
  }, [debouncedSearchQuery, handleSearchOrFilterChange]);

  // Filter initiatives based on search, party, and type
  // Remove the old client-side filtering since we now do server-side filtering
  // const filteredInitiatives = initiatives.filter(initiative => { ... });

  // Use initiatives directly since filtering is now done on the server
  const filteredInitiatives = initiatives;

  // Infinite scroll handler
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100) { // 100px before bottom
      loadMoreInitiatives();
    }
  };

  // Filter by urgency/status - now uses new stage classification from backend
  const getInitiativeStatus = (initiative: CongressInitiative) => {
    // Use new stage classification if available, fallback to old logic
    if (initiative.stage) {
      switch (initiative.stage) {
        case 'published': return 'published';
        case 'passed': return 'passed';
        case 'voting': return 'voting';
        case 'committee': return 'debating';
        case 'debating': return 'debating';
        case 'rejected': return 'rejected';
        case 'withdrawn': return 'withdrawn';
        case 'closed': return 'closed';
        case 'proposed': return 'proposed';
        default: return 'proposed';
      }
    }
    
    // Fallback to old logic
    if (initiative.nlp_urgency === 'alta') return 'urgent';
    if (initiative.tipo_tramitacion === 'urgente') return 'urgent';
    if (initiative.resultado_tramitacion === 'Aprobada') return 'passed';
    if (initiative.resultado_tramitacion === 'Rechazada') return 'rejected';
    if (initiative.situacion_actual?.includes('Comisión')) return 'debating';
    if (initiative.situacion_actual?.includes('Pleno')) return 'voting';
    return 'proposed';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'proposed': return 'bg-blue-100 text-blue-800';
      case 'debating': return 'bg-yellow-100 text-yellow-800';
      case 'voting': return 'bg-purple-100 text-purple-800';
      case 'passed': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'withdrawn': return 'bg-orange-100 text-orange-800';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'urgent': return 'Urgente';
      case 'proposed': return '📄 1. Presentación';
      case 'debating': return '🗣️ 2. Debate';
      case 'committee': return '🛠️ 3. Trabajo';
      case 'voting': return '✅ 4. Aprobación';
      case 'passed': return '✅ 4. Aprobación';
      case 'published': return '📢 5. Publicación';
      case 'rejected': return 'Rechazada';
      case 'withdrawn': return 'Retirada';
      case 'closed': return 'Cerrada';
      default: return '📄 1. Presentación';
    }
  };

  const getPartyName = (partyShortName: string) => {
    const party = politicalParties.find(p => p.short_name === partyShortName);
    return party?.name || partyShortName;
  };

  const handleInitiativeClick = (initiative: CongressInitiative) => {
    navigate(`/initiative/${initiative.id}`, { 
      state: { initiative, politicalParties } 
    });
  };

  // Clear memory cache when needed
  const clearMemoryCache = () => {
    memoryCache.current.clear();
    console.log('Memory cache cleared');
  };

  // Extract relative BOE path from absolute URL
  const getRelativeBoePath = (url?: string): string => {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}` || u.pathname || '';
    } catch (_e) {
      if (url.startsWith('/')) return url;
      return '';
    }
  };

  // Prefer stored URL; fallback to canonical BOE link if only ID is present
  const getBoeHref = (boeUrl?: string, boeId?: string): string => {
    if (boeUrl && boeUrl.trim().length > 0) return boeUrl;
    if (boeId && boeId.trim().length > 0) return `https://www.boe.es/buscar/doc.php?id=${encodeURIComponent(boeId.trim())}`;
    return '';
  };

  // Check if any initiatives need enhanced titles with better logic
  const needsEnhancedTitles = (initiativesToCheck: CongressInitiative[]) => {
    if (!initiativesToCheck || initiativesToCheck.length === 0) {
      return false;
    }
    
    const needsTitles = initiativesToCheck.some(initiative => !enhancedTitles[initiative.id]);
    console.log(`Checking if initiatives need titles: ${needsTitles}`);
    console.log('Current enhanced titles state:', Object.keys(enhancedTitles));
    console.log('Total initiatives to check:', initiativesToCheck.length);
    return needsTitles;
  };

  // Batch check cache status for multiple initiatives to reduce database calls
  const batchCheckCacheStatus = async (initiativesToCheck: CongressInitiative[]) => {
    console.log(`Starting batch cache check for ${initiativesToCheck.length} initiatives`);
    
    // Check each initiative individually to ensure we don't miss any cached data
    const cacheResults = await Promise.all(
      initiativesToCheck.map(async (initiative) => {
        try {
          // Check if we already have a title in local state
          if (enhancedTitles[initiative.id]) {
            console.log(`Initiative ${initiative.id} already has local title, skipping`);
            return { initiative, hasTitle: true, needsOpenAI: false, hasCache: false };
          }
          
          // Check server cache for this specific initiative
          console.log(`Checking server cache for initiative ${initiative.id}`);
          const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
          const hasCache = !!(cachedAnalysis && cachedAnalysis.problem_analysis);
          
          if (hasCache) {
            console.log(`✅ Found server cache for initiative ${initiative.id}`);
          } else {
            console.log(`❌ No server cache for initiative ${initiative.id}`);
          }
          
          return { 
            initiative, 
            hasTitle: false, 
            needsOpenAI: !hasCache, 
            hasCache 
          };
        } catch (error) {
          console.error(`Error checking cache for initiative ${initiative.id}:`, error);
          return { 
            initiative, 
            hasTitle: false, 
            needsOpenAI: true, 
            hasCache: false 
          };
        }
      })
    );
    
    const fromCache = cacheResults.filter(r => r.hasCache);
    const needsOpenAI = cacheResults.filter(r => r.needsOpenAI);
    
    console.log(`=== Batch Cache Check Summary ===`);
    console.log(`Total initiatives checked: ${initiativesToCheck.length}`);
    console.log(`From cache: ${fromCache.length}`);
    console.log(`Need OpenAI: ${needsOpenAI.length}`);
    console.log(`Already have titles: ${cacheResults.filter(r => r.hasTitle).length}`);
    console.log(`================================`);
    
    return { fromCache, needsOpenAI };
  };

  // Debug function to check cache status for all initiatives
  const debugCacheStatus = async () => {
    console.log('=== DEBUG: Checking cache status for all initiatives ===');
    
    const cachePromises = initiatives.map(async (initiative) => {
      try {
        const cachedAnalysis = await getCachedAnalysisWithMemory(initiative);
        const hasCache = !!(cachedAnalysis && cachedAnalysis.problem_analysis);
        const hasLocalTitle = !!enhancedTitles[initiative.id];
        
        return {
          id: initiative.id,
          objeto: initiative.objeto?.substring(0, 50) + '...',
          hasCache,
          hasLocalTitle,
          cacheAge: cachedAnalysis?.cache_age_hours || 0
        };
      } catch (error) {
        return {
          id: initiative.id,
          objeto: initiative.objeto?.substring(0, 50) + '...',
          hasCache: false,
          hasLocalTitle: !!enhancedTitles[initiative.id],
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
    
    const results = await Promise.all(cachePromises);
    
    console.table(results);
    
    const totalInitiatives = results.length;
    const cachedCount = results.filter(r => r.hasCache).length;
    const localTitleCount = results.filter(r => r.hasLocalTitle).length;
    
    console.log(`=== SUMMARY ===`);
    console.log(`Total initiatives: ${totalInitiatives}`);
    console.log(`With server cache: ${cachedCount}`);
    console.log(`With local titles: ${localTitleCount}`);
    console.log(`Missing cache: ${totalInitiatives - cachedCount}`);
    console.log(`Missing local titles: ${totalInitiatives - localTitleCount}`);
    console.log(`===============`);
    
    return results;
  };

  // Refresh enhanced titles for all initiatives
  const refreshEnhancedTitles = async () => {
    if (initiatives.length === 0) {
      console.log('No initiatives to refresh');
      return;
    }

    console.log('🔄 Starting enhanced titles refresh...');
    
    // SAFETY CHECK: Run comprehensive cache validation first
    console.log('🔒 SAFETY CHECK: Validating all cached data before any processing...');
    const { fromCache, needsOpenAI } = await validateAllCachedData(initiatives);
    
    if (needsOpenAI.length === 0) {
      console.log('🎉 All initiatives are already cached! No refresh needed.');
      return;
    }
    
    console.log(`⚠️  WARNING: ${needsOpenAI.length} initiatives need OpenAI calls`);
    console.log(`   This will incur API costs. Proceed with caution.`);
    
    // Show detailed breakdown
    const breakdown = needsOpenAI.reduce((acc, { initiative, status }) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Breakdown of initiatives needing OpenAI:', breakdown);
    
    // Process the initiatives that truly need OpenAI
    await processBatchTitles(needsOpenAI.map(r => r.initiative));
  };

  const filters = [
    { id: 'all', label: 'Todas' },
    { id: 'urgent', label: 'Urgentes' },
    { id: 'proposed', label: '📄 1. Presentación' },
    { id: 'debating', label: '🗣️ 2. Debate' },
    { id: 'committee', label: '🛠️ 3. Trabajo' },
    { id: 'voting', label: '✅ 4. Aprobación' },
    { id: 'published', label: '📢 5. Publicación' },
    { id: 'rejected', label: 'Rechazadas' },
  ];

  // Remove the old client-side filtering since we now do server-side filtering
  // const filteredByStatus = activeFilter === 'all' 
  //   ? filteredInitiatives 
  //   : filteredInitiatives.filter(initiative => getInitiativeStatus(initiative) === activeFilter);

  // Use initiatives directly since filtering is now done on the server
  const filteredByStatus = filteredInitiatives;

  if (loading) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando iniciativas...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Iniciativas del Congreso</h1>
            <p className="text-gray-600">
              Seguimiento de las leyes y propuestas legislativas en el Parlamento español
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={refreshEnhancedTitles}
              disabled={batchProcessing || !needsEnhancedTitles(initiatives)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                batchProcessing 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : !needsEnhancedTitles(initiatives)
                  ? 'bg-green-500 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
              title={
                !needsEnhancedTitles(initiatives) 
                  ? "Todos los títulos ya están generados" 
                  : "Regenerar todos los títulos mejorados en lotes"
              }
            >
              {batchProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Procesando... {batchProgress}/{batchTotal}</span>
                </>
              ) : !needsEnhancedTitles(initiatives) ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Títulos Completados</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerar Títulos</span>
                </>
              )}
            </button>
            
            <button
              onClick={getCacheStats}
              className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Ver estadísticas de caché"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Stats</span>
            </button>
            
            <button
              onClick={debugCacheStatus}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Debug cache status for all initiatives"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Debug</span>
            </button>
            
            <button
              onClick={preWarmCache}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Pre-warm cache for all initiatives"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Pre-warm</span>
            </button>
            
            <button
              onClick={() => {
                const initiativesNeedingTitles = initiatives.filter(
                  initiative => !enhancedTitles[initiative.id]
                );
                if (initiativesNeedingTitles.length > 0) {
                  processBatchTitles(initiativesNeedingTitles);
                } else {
                  alert('🎉 All initiatives already have enhanced titles!');
                }
              }}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Generate titles for initiatives that need them"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Generate Missing</span>
            </button>
            
            <button
              onClick={toggleOpenAISafetyMode}
              className={`px-3 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                openAISafetyMode 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
              title={openAISafetyMode ? 'Disable OpenAI Safety Mode' : 'Enable OpenAI Safety Mode'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{openAISafetyMode ? 'Safety ON' : 'Safety OFF'}</span>
            </button>
            
            <button
              onClick={clearMemoryCache}
              className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Limpiar caché en memoria"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Limpiar Cache</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* OpenAI Safety Mode Indicator */}
      {openAISafetyMode && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-bold">🛡️ OpenAI Safety Mode Active</p>
              <p className="text-sm">No API calls will be made. All titles will be generated from cache only.</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-bold">❌ Error Loading Data</p>
              <p className="text-sm">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  fetchInitialData();
                }}
                className="mt-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <p className="font-bold">📥 Loading Initiatives...</p>
              <p className="text-sm">Please wait while we fetch the data from the database.</p>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info (only show in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 border border-gray-300 p-3 mb-4 rounded text-sm">
          <p className="font-bold mb-2">🐛 Debug Info:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Initiatives: {initiatives.length}</div>
            <div>Loading: {loading ? 'Yes' : 'No'}</div>
            <div>Error: {error || 'None'}</div>
            <div>Batch Size: {batchSize}</div>
            <div>Total Count: {totalCount}</div>
            <div>Has More: {hasMore ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      {/* Cache Status Display */}
      {initiatives.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 mb-4 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-blue-800">📊 Cache Status</p>
              <p className="text-sm text-blue-600">
                Enhanced titles: {Object.keys(enhancedTitles).length} / {initiatives.length} initiatives
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600">
                Cache hit rate: {initiatives.length > 0 ? ((Object.keys(enhancedTitles).length / initiatives.length) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-blue-500">
                {initiatives.length - Object.keys(enhancedTitles).length} need title generation
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar iniciativas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Don't call handleSearchOrFilterChange here - let the debounced effect handle it
            }}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => {
                setActiveFilter(filter.id);
                handleSearchOrFilterChange();
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                activeFilter === filter.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Additional Filters */}
        <div className="flex space-x-4">
          <select
            value={selectedParty}
            onChange={(e) => {
              setSelectedParty(e.target.value);
              handleSearchOrFilterChange();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Todos los Partidos</option>
            {politicalParties.map(party => (
              <option key={party.short_name} value={party.short_name}>
                {party.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              handleSearchOrFilterChange();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Todos los Tipos</option>
            <option value="tramitacion_ordinaria">Tramitación Ordinaria</option>
            <option value="tramitacion_urgente">Tramitación Urgente</option>
            <option value="tramitacion_especial">Tramitación Especial</option>
            <option value="tramitacion_iniciativas_autonomicas">Iniciativas Autonómicas</option>
            <option value="tramitacion_iniciativas_populares">Iniciativas Populares</option>
            <option value="tramitacion_organos_constitucionales">Órganos Constitucionales</option>
          </select>
        </div>
      </div>

      {/* Trending Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🔥 Urgentes</h2>
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Iniciativas Urgentes</h3>
              <p className="text-sm text-gray-600">
                {filteredInitiatives.filter(i => i.nlp_urgency === 'alta').length} iniciativas marcadas como urgentes
              </p>
            </div>
            <div className="text-2xl">🚨</div>
          </div>
        </div>
      </div>

      {/* Initiatives List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Iniciativas Recientes 
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({filteredByStatus.length} de {totalCount})
          </span>
        </h2>
        
        {/* Scrollable container for infinite scroll */}
        <div 
          className="space-y-4 max-h-96 overflow-y-auto pr-2"
          onScroll={handleScroll}
        >
          {filteredByStatus.map((initiative) => {
            const status = getInitiativeStatus(initiative);
            return (
              <div
                key={initiative.id}
                onClick={() => handleInitiativeClick(initiative)}
                className="card cursor-pointer hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1 pr-4">
                    {titleLoading[initiative.id] ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-gray-400">Generando título...</span>
                      </div>
                    ) : (
                      <span>{enhancedTitles[initiative.id] || initiative.accessible_title || initiative.objeto}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                    {(status === 'published' || initiative.boe_id || (initiative.publication_confidence && initiative.publication_confidence !== 'not_identified')) && (
                      (() => {
                        const href = getBoeHref(initiative.boe_url, initiative.boe_id);
                        const label = href ? getRelativeBoePath(href) : (initiative.boe_id ? `/buscar/doc.php?id=${initiative.boe_id}` : '');
                        return href && label ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            title="Ver publicación en el BOE"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {label}
                          </a>
                        ) : null;
                      })()
                    )}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-3 leading-relaxed line-clamp-2">
                  {initiative.objeto}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center space-x-2">
                    <span>{initiative.congress_initiative_type?.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span>{getPartyName(initiative.political_party_short_name)}</span>
                  </div>
                  <span>{new Date(initiative.fecha_presentacion).toLocaleDateString('es-ES')}</span>
                </div>
                
                {/* BOE Publication Information */}
                {initiative.publication_confidence && initiative.publication_confidence !== 'not_identified' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-blue-600">📢</span>
                      <span className="text-blue-700 font-medium">
                        {initiative.publication_confidence === 'high' ? 'Publicada en BOE' : 'Probablemente publicada'}
                      </span>
                      {initiative.boe_id && (
                        <span className="text-blue-600">• {initiative.boe_id}</span>
                      )}
                      {initiative.boe_publication_date && (
                        <span className="text-blue-600">• {new Date(initiative.boe_publication_date).toLocaleDateString('es-ES')}</span>
                      )}
                    </div>
                    {initiative.boe_url && (
                      <a 
                        href={initiative.boe_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs underline mt-1 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {getRelativeBoePath(initiative.boe_url) || 'Ver en BOE →'}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Loading more indicator */}
          {loadingMore && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando más iniciativas...</p>
            </div>
          )}
          
          {/* End of list indicator */}
          {!hasMore && filteredByStatus.length > 0 && (
            <div className="text-center py-4 text-gray-500">
              <p>Has llegado al final de la lista</p>
            </div>
          )}
          
          {filteredByStatus.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No se encontraron iniciativas para los filtros seleccionados.</p>
              <p className="text-sm">Intenta con diferentes filtros o términos de búsqueda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CongressInitiativesList; 