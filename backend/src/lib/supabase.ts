import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Create admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database helper functions
export const db = {
  // Users
  users: () => supabase.from('users'),
  userProfiles: () => supabase.from('user_profiles'),
  
  // Topics
  topics: () => supabase.from('topics'),
  userTopics: () => supabase.from('user_topics'),
  
  // Laws
  laws: () => supabase.from('laws'),
  lawDetails: () => supabase.from('law_details'),
  lawTimelines: () => supabase.from('law_timelines'),
  lawParties: () => supabase.from('law_parties'),
  lawTopics: () => supabase.from('law_topics'),
  userLaws: () => supabase.from('user_laws'),
  
  // Political parties
  politicalParties: () => supabase.from('political_parties'),
  
  // Storage
  storage: () => supabase.storage,
  
  // Auth
  auth: () => supabase.auth,
};

// Type-safe database operations
export const createUser = async (userData: any) => {
  const { data, error } = await db.users().insert(userData).select().single();
  if (error) throw error;
  return data;
};

export const getUserById = async (id: string) => {
  const { data, error } = await db.users().select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email: string) => {
  const { data, error } = await db.users().select('*').eq('email', email).single();
  if (error) throw error;
  return data;
};

export const updateUser = async (id: string, updates: any) => {
  const { data, error } = await db.users().update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteUser = async (id: string) => {
  const { error } = await db.users().delete().eq('id', id);
  if (error) throw error;
  return true;
};

// Topic operations
export const getTopics = async (filters?: any) => {
  let query = db.topics().select('*');
  
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getTopicById = async (id: string) => {
  const { data, error } = await db.topics().select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

// Law operations
export const getLaws = async (filters?: any, pagination?: any) => {
  let query = db.laws().select(`
    *,
    law_details (*),
    law_topics (topic_id),
    topics (id, name, icon)
  `);
  
  if (filters?.stage) {
    query = query.in('stage', filters.stage);
  }
  
  if (filters?.type) {
    query = query.in('type', filters.type);
  }
  
  if (filters?.topics) {
    query = query.in('law_topics.topic_id', filters.topics);
  }
  
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  
  if (pagination?.page && pagination?.limit) {
    const offset = (pagination.page - 1) * pagination.limit;
    query = query.range(offset, offset + pagination.limit - 1);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getLawById = async (id: string) => {
  const { data, error } = await db.laws().select(`
    *,
    law_details (*),
    law_timelines (*),
    law_parties (*),
    law_topics (topic_id),
    topics (id, name, icon)
  `).eq('id', id).single();
  
  if (error) throw error;
  return data;
};

// User topic operations
export const getUserTopics = async (userId: string) => {
  const { data, error } = await db.userTopics()
    .select(`
      *,
      topics (*)
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};

export const followTopic = async (userId: string, topicId: string) => {
  const { data, error } = await db.userTopics().upsert({
    user_id: userId,
    topic_id: topicId,
    is_followed: true,
    notification_level: 'high',
  }).select().single();
  
  if (error) throw error;
  return data;
};

export const unfollowTopic = async (userId: string, topicId: string) => {
  const { error } = await db.userTopics()
    .delete()
    .eq('user_id', userId)
    .eq('topic_id', topicId);
  
  if (error) throw error;
  return true;
};

// User law operations
export const followLaw = async (userId: string, lawId: string) => {
  const { data, error } = await db.userLaws().upsert({
    user_id: userId,
    law_id: lawId,
    is_followed: true,
  }).select().single();
  
  if (error) throw error;
  return data;
};

export const unfollowLaw = async (userId: string, lawId: string) => {
  const { error } = await db.userLaws()
    .delete()
    .eq('user_id', userId)
    .eq('law_id', lawId);
  
  if (error) throw error;
  return true;
};

// Statistics operations
export const getLawStatistics = async () => {
  const { data, error } = await supabase.rpc('get_law_statistics');
  if (error) throw error;
  return data;
};

export const getTopicStatistics = async () => {
  const { data, error } = await supabase.rpc('get_topic_statistics');
  if (error) throw error;
  return data;
};

export default supabase; 