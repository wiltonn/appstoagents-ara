// TanStack Query Configuration - Task 3.1: Performance Optimization
// Optimized client-side caching with intelligent cache policies

import { QueryClient } from '@tanstack/react-query';

/**
 * Query key factories for consistent cache management
 */
export const queryKeys = {
  // Session related
  session: (sessionId?: string) => sessionId ? ['session', sessionId] : ['session'],
  sessionAnswers: (sessionId: string) => ['session', sessionId, 'answers'],
  sessionProgress: (sessionId: string) => ['session', sessionId, 'progress'],
  
  // User related
  userProfile: (userId: string) => ['user', userId, 'profile'],
  userSessions: (userId: string, filters?: any) => 
    ['user', userId, 'sessions', ...(filters ? [filters] : [])],
  
  // Configuration
  wizardConfig: () => ['config', 'wizard'],
  scoringConfig: () => ['config', 'scoring'],
  
  // Chat
  chatMessages: (sessionId: string, page?: number) => 
    ['chat', sessionId, 'messages', ...(page !== undefined ? [page] : [])],
  
  // Analytics
  analytics: (period: string, filters?: any) => 
    ['analytics', period, ...(filters ? [filters] : [])],
  
  // Reports
  reports: (userId?: string, filters?: any) => 
    ['reports', ...(userId ? [userId] : []), ...(filters ? [filters] : [])],
  
  // Performance
  performance: () => ['performance'],
} as const;

/**
 * Cache time configurations (in milliseconds)
 */
export const cacheTime = {
  // Very short cache for real-time data
  realtime: 30 * 1000,          // 30 seconds
  
  // Short cache for frequently changing data
  short: 2 * 60 * 1000,         // 2 minutes
  
  // Medium cache for semi-static data
  medium: 5 * 60 * 1000,        // 5 minutes
  
  // Long cache for static data
  long: 15 * 60 * 1000,         // 15 minutes
  
  // Very long cache for configuration data
  veryLong: 60 * 60 * 1000,     // 1 hour
  
  // Infinite cache for immutable data
  infinite: Infinity,
} as const;

/**
 * Stale time configurations
 */
export const staleTime = {
  // Data considered stale immediately
  immediate: 0,
  
  // Short stale time for dynamic data
  short: 30 * 1000,             // 30 seconds
  
  // Medium stale time for semi-dynamic data
  medium: 2 * 60 * 1000,        // 2 minutes
  
  // Long stale time for relatively static data
  long: 5 * 60 * 1000,          // 5 minutes
  
  // Very long stale time for configuration
  veryLong: 30 * 60 * 1000,     // 30 minutes
} as const;

/**
 * Create optimized query client with performance-focused defaults
 */
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Global query defaults
        staleTime: staleTime.short,
        cacheTime: cacheTime.medium,
        
        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Performance optimizations
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        refetchOnMount: 'always',
        
        // Background refetch for better UX
        refetchInterval: false,
        refetchIntervalInBackground: false,
        
        // Error handling
        useErrorBoundary: false,
        
        // Suspense support
        suspense: false,
        
        // Keep unused data in cache
        keepPreviousData: true,
        
        // Structure sharing for better performance
        structuralSharing: true,
        
        // Default select function for data transformation
        select: undefined,
        
        // Network mode for offline support
        networkMode: 'online',
      },
      
      mutations: {
        // Global mutation defaults
        retry: 1,
        retryDelay: 1000,
        useErrorBoundary: false,
        networkMode: 'online',
        
        // Optimistic updates
        onMutate: undefined,
        onError: undefined,
        onSuccess: undefined,
        onSettled: undefined,
      },
    },
    
    // Cache configuration
    queryCache: undefined,
    mutationCache: undefined,
    
    // Logger for debugging (remove in production)
    logger: {
      log: (...args) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Query:', ...args);
        }
      },
      warn: (...args) => {
        console.warn('⚠️ Query Warning:', ...args);
      },
      error: (...args) => {
        console.error('❌ Query Error:', ...args);
      },
    },
  });
}

/**
 * Query options factories for common patterns
 */
export const queryOptions = {
  // Session data with optimistic caching
  session: (sessionId?: string) => ({
    queryKey: queryKeys.session(sessionId),
    staleTime: staleTime.short,
    cacheTime: cacheTime.medium,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  }),
  
  // Session answers with aggressive caching
  sessionAnswers: (sessionId: string) => ({
    queryKey: queryKeys.sessionAnswers(sessionId),
    staleTime: staleTime.medium,
    cacheTime: cacheTime.long,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  }),
  
  // Configuration data with very long cache
  wizardConfig: () => ({
    queryKey: queryKeys.wizardConfig(),
    staleTime: staleTime.veryLong,
    cacheTime: cacheTime.veryLong,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  }),
  
  // Chat messages with pagination
  chatMessages: (sessionId: string, page: number = 0) => ({
    queryKey: queryKeys.chatMessages(sessionId, page),
    staleTime: staleTime.short,
    cacheTime: cacheTime.medium,
    keepPreviousData: true,
    getPreviousPageParam: (firstPage: any) => firstPage.previousPage ?? undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextPage ?? undefined,
  }),
  
  // User sessions with filters
  userSessions: (userId: string, filters?: any) => ({
    queryKey: queryKeys.userSessions(userId, filters),
    staleTime: staleTime.medium,
    cacheTime: cacheTime.long,
    keepPreviousData: true,
  }),
  
  // Analytics with longer cache
  analytics: (period: string, filters?: any) => ({
    queryKey: queryKeys.analytics(period, filters),
    staleTime: staleTime.long,
    cacheTime: cacheTime.veryLong,
    refetchOnWindowFocus: false,
  }),
  
  // Performance metrics with real-time updates
  performance: () => ({
    queryKey: queryKeys.performance(),
    staleTime: staleTime.immediate,
    cacheTime: cacheTime.realtime,
    refetchInterval: 30000, // Refetch every 30 seconds
  }),
} as const;

/**
 * Mutation options for common operations
 */
export const mutationOptions = {
  // Save answer with optimistic updates
  saveAnswer: (queryClient: QueryClient, sessionId: string) => ({
    onMutate: async (newAnswer: any) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.sessionAnswers(sessionId) });
      
      // Snapshot the previous value
      const previousAnswers = queryClient.getQueryData(queryKeys.sessionAnswers(sessionId));
      
      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.sessionAnswers(sessionId), (old: any) => {
        if (!old) return [newAnswer];
        
        const existingIndex = old.findIndex((a: any) => a.questionKey === newAnswer.questionKey);
        if (existingIndex >= 0) {
          // Update existing answer
          const newAnswers = [...old];
          newAnswers[existingIndex] = { ...newAnswers[existingIndex], ...newAnswer };
          return newAnswers;
        } else {
          // Add new answer
          return [...old, newAnswer];
        }
      });
      
      return { previousAnswers };
    },
    
    onError: (err: any, newAnswer: any, context: any) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.sessionAnswers(sessionId), context.previousAnswers);
    },
    
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionAnswers(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(sessionId) });
    },
  }),
  
  // Submit session with cache invalidation
  submitSession: (queryClient: QueryClient, sessionId: string, userId?: string) => ({
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(sessionId) });
      
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.userSessions(userId) });
      }
      
      // Refetch analytics
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  }),
  
  // Generic mutation with error handling
  generic: () => ({
    onError: (error: any) => {
      console.error('Mutation error:', error);
      
      // You could show a toast notification here
      // toast.error(error.message || 'An error occurred');
    },
  }),
} as const;

/**
 * Cache utility functions
 */
export const cacheUtils = {
  // Prefetch session data
  prefetchSession: (queryClient: QueryClient, sessionId: string) => {
    return Promise.all([
      queryClient.prefetchQuery({
        ...queryOptions.session(sessionId),
        queryFn: () => fetchSession(sessionId),
      }),
      queryClient.prefetchQuery({
        ...queryOptions.sessionAnswers(sessionId),
        queryFn: () => fetchSessionAnswers(sessionId),
      }),
    ]);
  },
  
  // Invalidate all session data
  invalidateSession: (queryClient: QueryClient, sessionId: string) => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionAnswers(sessionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(sessionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(sessionId) }),
    ]);
  },
  
  // Clear all user data
  clearUserData: (queryClient: QueryClient, userId: string) => {
    return Promise.all([
      queryClient.removeQueries({ queryKey: queryKeys.userProfile(userId) }),
      queryClient.removeQueries({ queryKey: queryKeys.userSessions(userId) }),
    ]);
  },
  
  // Get cache statistics
  getCacheStats: (queryClient: QueryClient) => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.state.fetchStatus !== 'idle').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      memoryUsage: JSON.stringify(queries).length, // Rough estimate
    };
  },
};

// Placeholder fetch functions (replace with actual API calls)
async function fetchSession(sessionId: string) {
  // Implementation would call your actual API
  throw new Error('fetchSession not implemented');
}

async function fetchSessionAnswers(sessionId: string) {
  // Implementation would call your actual API
  throw new Error('fetchSessionAnswers not implemented');
}

// Export singleton query client
export const queryClient = createOptimizedQueryClient();