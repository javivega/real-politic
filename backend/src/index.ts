import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';

// Import Supabase client
import { supabase } from './lib/supabase';

// Import routes
import congressRoutes from './routes/congress';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(morgan('combined')); // Logging
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(limiter); // Rate limiting
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    message: 'Real Politic API',
    version: API_VERSION,
    backend: 'Supabase',
    endpoints: {
      topics: `/api/${API_VERSION}/topics`,
      laws: `/api/${API_VERSION}/laws`,
      parties: `/api/${API_VERSION}/parties`,
      statistics: `/api/${API_VERSION}/statistics`,
      congress: `/api/${API_VERSION}/congress`,
    },
    documentation: 'This API uses Supabase for data storage and authentication',
  });
});

// Congress data routes
app.use(`/api/${API_VERSION}/congress`, congressRoutes);

// Topics API
app.get(`/api/${API_VERSION}/topics`, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Topics retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topics',
    });
  }
});

app.get(`/api/${API_VERSION}/topics/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    return res.json({
      success: true,
      data,
      message: 'Topic retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching topic:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch topic',
    });
  }
});

// Laws API
app.get(`/api/${API_VERSION}/laws`, async (req, res) => {
  try {
    const { stage, type, search, page = 1, limit = 10 } = req.query;
    
    let query = supabase
      .from('laws')
      .select(`
        *,
        law_details (*),
        law_topics (topic_id),
        topics (id, name, icon)
      `)
      .eq('is_active', true);

    if (stage) {
      query = query.in('stage', Array.isArray(stage) ? stage : [stage]);
    }

    if (type) {
      query = query.in('type', Array.isArray(type) ? type : [type]);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query = query.range(offset, offset + parseInt(limit as string) - 1);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Laws retrieved successfully',
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        hasNext: data.length === parseInt(limit as string),
      },
    });
  } catch (error) {
    console.error('Error fetching laws:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch laws',
    });
  }
});

app.get(`/api/${API_VERSION}/laws/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('laws')
      .select(`
        *,
        law_details (*),
        law_timelines (*),
        law_parties (*),
        law_topics (topic_id),
        topics (id, name, icon)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Law not found',
      });
    }

    return res.json({
      success: true,
      data,
      message: 'Law retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching law:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch law',
    });
  }
});

// Political Parties API
app.get(`/api/${API_VERSION}/parties`, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('political_parties')
      .select('*')
      .eq('is_active', true)
      .order('seats', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Political parties retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching political parties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch political parties',
    });
  }
});

// Statistics API
app.get(`/api/${API_VERSION}/statistics`, async (req, res) => {
  try {
    // Get basic counts
    const [topicsCount, lawsCount, partiesCount] = await Promise.all([
      supabase.from('topics').select('*', { count: 'exact', head: true }),
      supabase.from('laws').select('*', { count: 'exact', head: true }),
      supabase.from('political_parties').select('*', { count: 'exact', head: true }),
    ]);

    // Get laws by stage
    const { data: lawsByStage } = await supabase
      .from('laws')
      .select('stage')
      .eq('is_active', true);

    const stageCounts = lawsByStage?.reduce((acc: Record<string, number>, law: { stage: string }) => {
      acc[law.stage] = (acc[law.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get laws by type
    const { data: lawsByType } = await supabase
      .from('laws')
      .select('type')
      .eq('is_active', true);

    const typeCounts = lawsByType?.reduce((acc: Record<string, number>, law: { type: string }) => {
      acc[law.type] = (acc[law.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    res.json({
      success: true,
      data: {
        total: {
          topics: topicsCount.count || 0,
          laws: lawsCount.count || 0,
          parties: partiesCount.count || 0,
        },
        lawsByStage: stageCounts,
        lawsByType: typeCounts,
      },
      message: 'Statistics retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

// Database Seeding API
app.post(`/api/${API_VERSION}/seed`, async (req, res) => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Insert political parties first
    const partiesData = [
      { name: 'Progressive Democrats', short_name: 'PD', logo: '🟦', color: '#3B82F6', ideology: 'Progressive', leader: 'Sarah Johnson', seats: 45, is_active: true },
      { name: 'Conservative Union', short_name: 'CU', logo: '🟥', color: '#EF4444', ideology: 'Conservative', leader: 'Michael Chen', seats: 38, is_active: true },
      { name: 'Green Alliance', short_name: 'GA', logo: '🟩', color: '#10B981', ideology: 'Environmental', leader: 'Emma Rodriguez', seats: 22, is_active: true },
      { name: 'Liberty Party', short_name: 'LP', logo: '🟨', color: '#F59E0B', ideology: 'Libertarian', leader: 'David Thompson', seats: 15, is_active: true },
      { name: 'Unity Coalition', short_name: 'UC', logo: '🟪', color: '#8B5CF6', ideology: 'Centrist', leader: 'Lisa Wang', seats: 20, is_active: true }
    ];

    for (const party of partiesData) {
      const { error } = await supabase
        .from('political_parties')
        .upsert(party, { onConflict: 'short_name' });
      
      if (error) {
        console.error(`Error inserting party ${party.short_name}:`, error);
      }
    }

    // Insert topics
    const topicsData = [
      { name: 'Education', slug: 'education', icon: '📚', description: 'Educational policies, school funding, curriculum changes', category: 'Social' },
      { name: 'Healthcare', slug: 'healthcare', icon: '🏥', description: 'Healthcare access, medical policies, public health', category: 'Social' },
      { name: 'Economy', slug: 'economy', icon: '💰', description: 'Economic policies, taxation, business regulations', category: 'Economic' },
      { name: 'Environment', slug: 'environment', icon: '🌱', description: 'Environmental protection, climate change, sustainability', category: 'Environmental' },
      { name: 'Justice', slug: 'justice', icon: '⚖️', description: 'Legal reforms, criminal justice, civil rights', category: 'Legal' },
      { name: 'Transportation', slug: 'transportation', icon: '🚗', description: 'Infrastructure, public transit, road safety', category: 'Infrastructure' },
      { name: 'Housing', slug: 'housing', icon: '🏠', description: 'Affordable housing, urban development, property rights', category: 'Social' },
      { name: 'Technology', slug: 'technology', icon: '💻', description: 'Digital policies, internet regulation, tech innovation', category: 'Technology' }
    ];

    for (const topic of topicsData) {
      const { error } = await supabase
        .from('topics')
        .upsert(topic, { onConflict: 'slug' });
      
      if (error) {
        console.error(`Error inserting topic ${topic.slug}:`, error);
      }
    }

    // Insert sample laws
    const lawsData = [
      {
        title: 'Education Reform Act 2024',
        slug: 'education-reform-act-2024',
        description: 'Comprehensive reform of the national education system to improve student outcomes and teacher support.',
        summary: 'Modernizes education standards and increases funding for public schools',
        stage: 'debating',
        type: 'bill',
        proposer: 'Sen. Sarah Johnson',
        proposer_party: 'PD',
        introduction_date: '2024-01-15'
      },
      {
        title: 'Universal Healthcare Coverage',
        slug: 'universal-healthcare-coverage',
        description: 'Establishes comprehensive healthcare coverage for all citizens with focus on preventive care.',
        summary: 'Provides healthcare access to all citizens',
        stage: 'proposed',
        type: 'bill',
        proposer: 'Rep. Emma Rodriguez',
        proposer_party: 'GA',
        introduction_date: '2024-02-01'
      },
      {
        title: 'Climate Action Plan',
        slug: 'climate-action-plan',
        description: 'Sets ambitious targets for carbon reduction and renewable energy adoption.',
        summary: 'Comprehensive climate change mitigation strategy',
        stage: 'voting',
        type: 'bill',
        proposer: 'Sen. Emma Rodriguez',
        proposer_party: 'GA',
        introduction_date: '2024-01-20'
      },
      {
        title: 'Digital Privacy Protection',
        slug: 'digital-privacy-protection',
        description: 'Strengthens online privacy rights and regulates data collection practices.',
        summary: 'Protects user privacy in the digital age',
        stage: 'passed',
        type: 'bill',
        proposer: 'Rep. David Thompson',
        proposer_party: 'LP',
        introduction_date: '2023-12-10'
      },
      {
        title: 'Infrastructure Modernization',
        slug: 'infrastructure-modernization',
        description: 'Major investment in roads, bridges, and public transportation systems.',
        summary: 'Modernizes national infrastructure',
        stage: 'debating',
        type: 'bill',
        proposer: 'Sen. Michael Chen',
        proposer_party: 'CU',
        introduction_date: '2024-01-25'
      }
    ];

    for (const law of lawsData) {
      const { error } = await supabase
        .from('laws')
        .upsert(law, { onConflict: 'slug' });
      
      if (error) {
        console.error(`Error inserting law ${law.slug}:`, error);
      }
    }

    // Insert law details
    const lawDetailsData = [
      {
        law_slug: 'education-reform-act-2024',
        problem: 'Declining student performance and outdated curriculum standards',
        pros: ['Improved student outcomes', 'Better teacher training', 'Modernized curriculum'],
        cons: ['High implementation cost', 'Resistance from some educators'],
        impact: 'Expected 15% improvement in test scores over 5 years',
        cost: '$2.5 billion over 5 years',
        official_source: 'https://parliament.gov.bills/edu-reform-2024'
      },
      {
        law_slug: 'universal-healthcare-coverage',
        problem: 'Millions lack access to basic healthcare services',
        pros: ['Universal access to healthcare', 'Reduced healthcare costs', 'Better preventive care'],
        cons: ['High initial cost', 'Complex implementation'],
        impact: 'Coverage for 95% of population within 3 years',
        cost: '$15 billion annually',
        official_source: 'https://parliament.gov.bills/healthcare-2024'
      },
      {
        law_slug: 'climate-action-plan',
        problem: 'Climate change threatens national security and economy',
        pros: ['Reduces carbon emissions', 'Creates green jobs', 'Improves air quality'],
        cons: ['Economic transition costs', 'Industry resistance'],
        impact: '50% carbon reduction by 2030',
        cost: '$8 billion over 10 years',
        official_source: 'https://parliament.gov.bills/climate-2024'
      },
      {
        law_slug: 'digital-privacy-protection',
        problem: 'Unregulated data collection threatens personal privacy',
        pros: ['Protects user privacy', 'Increases transparency', 'Gives users control'],
        cons: ['May limit innovation', 'Compliance costs for businesses'],
        impact: 'Enhanced privacy for all digital users',
        cost: '$500 million annually',
        official_source: 'https://parliament.gov.bills/privacy-2023'
      },
      {
        law_slug: 'infrastructure-modernization',
        problem: 'Aging infrastructure poses safety risks and limits economic growth',
        pros: ['Improves safety', 'Creates jobs', 'Boosts economy'],
        cons: ['High construction costs', 'Temporary disruptions'],
        impact: 'Modernized infrastructure across the nation',
        cost: '$12 billion over 8 years',
        official_source: 'https://parliament.gov.bills/infrastructure-2024'
      }
    ];

    for (const detail of lawDetailsData) {
      // Get the law ID first
      const { data: law } = await supabase
        .from('laws')
        .select('id')
        .eq('slug', detail.law_slug)
        .single();

      if (law) {
        const { error } = await supabase
          .from('law_details')
          .upsert({
            law_id: law.id,
            problem: detail.problem,
            pros: detail.pros,
            cons: detail.cons,
            impact: detail.impact,
            cost: detail.cost,
            official_source: detail.official_source
          }, { onConflict: 'law_id' });
        
        if (error) {
          console.error(`Error inserting law detail for ${detail.law_slug}:`, error);
        }
      }
    }

    // Insert law topics relationships
    const lawTopicsData = [
      { law_slug: 'education-reform-act-2024', topic_slug: 'education', relevance: 95 },
      { law_slug: 'universal-healthcare-coverage', topic_slug: 'healthcare', relevance: 100 },
      { law_slug: 'climate-action-plan', topic_slug: 'environment', relevance: 100 },
      { law_slug: 'climate-action-plan', topic_slug: 'economy', relevance: 70 },
      { law_slug: 'digital-privacy-protection', topic_slug: 'technology', relevance: 90 },
      { law_slug: 'digital-privacy-protection', topic_slug: 'justice', relevance: 80 },
      { law_slug: 'infrastructure-modernization', topic_slug: 'transportation', relevance: 85 },
      { law_slug: 'infrastructure-modernization', topic_slug: 'economy', relevance: 75 }
    ];

    for (const lawTopic of lawTopicsData) {
      // Get the law and topic IDs
      const [{ data: law }, { data: topic }] = await Promise.all([
        supabase.from('laws').select('id').eq('slug', lawTopic.law_slug).single(),
        supabase.from('topics').select('id').eq('slug', lawTopic.topic_slug).single()
      ]);

      if (law && topic) {
        const { error } = await supabase
          .from('law_topics')
          .upsert({
            law_id: law.id,
            topic_id: topic.id,
            relevance: lawTopic.relevance
          }, { onConflict: 'law_id,topic_id' });
        
        if (error) {
          console.error(`Error inserting law topic for ${lawTopic.law_slug}:`, error);
        }
      }
    }

    // Create a demo user
    const { data: demoUser, error: userError } = await supabase
      .from('users')
      .upsert({
        email: 'demo@realpolitic.com',
        first_name: 'Demo',
        last_name: 'User',
        is_active: true,
        email_verified: true
      }, { onConflict: 'email' })
      .select()
      .single();

    if (userError) {
      console.error('Error creating demo user:', userError);
    } else if (demoUser) {
      // Create user profile
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: demoUser.id,
          bio: 'Demo user for testing Real Politic app',
          location: 'Demo City',
          theme: 'light'
        }, { onConflict: 'user_id' });

      // Create user topic preferences
      const demoTopics = ['education', 'healthcare', 'environment'];
      for (const topicSlug of demoTopics) {
        const { data: topic } = await supabase
          .from('topics')
          .select('id')
          .eq('slug', topicSlug)
          .single();

        if (topic) {
          await supabase
            .from('user_topics')
            .upsert({
              user_id: demoUser.id,
              topic_id: topic.id,
              is_followed: true,
              notification_level: 'high'
            }, { onConflict: 'user_id,topic_id' });
        }
      }
    }

    console.log('✅ Database seeding completed successfully!');
    
    return res.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        parties: partiesData.length,
        topics: topicsData.length,
        laws: lawsData.length,
        lawDetails: lawDetailsData.length,
        lawTopics: lawTopicsData.length,
        demoUser: demoUser ? 'created' : 'error'
      }
    });

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database seeding failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check database state
app.get(`/api/${API_VERSION}/debug`, async (req, res) => {
  try {
    console.log('🔍 Checking database state...');
    
    // Check political parties
    const { data: parties, error: partiesError } = await supabase
      .from('political_parties')
      .select('*');
    
    // Check topics
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('*');
    
    // Check laws
    const { data: laws, error: lawsError } = await supabase
      .from('laws')
      .select('*');

    return res.json({
      success: true,
      message: 'Database state retrieved',
      data: {
        political_parties: {
          count: parties?.length || 0,
          data: parties || [],
          error: partiesError
        },
        topics: {
          count: topics?.length || 0,
          data: topics || [],
          error: topicsError
        },
        laws: {
          count: laws?.length || 0,
          data: laws || [],
          error: lawsError
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug endpoint failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Real Politic Backend Server running on port ${PORT}`);
  console.log(`📚 API Version: ${API_VERSION}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📖 API Base: http://localhost:${PORT}/api/${API_VERSION}`);
  console.log(`🔄 Backend: Supabase (PostgreSQL)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app; 