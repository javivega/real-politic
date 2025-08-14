-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE law_stage AS ENUM ('proposed', 'debating', 'voting', 'passed', 'rejected', 'withdrawn');
CREATE TYPE law_type AS ENUM ('bill', 'amendment', 'resolution', 'motion');
CREATE TYPE notification_level AS ENUM ('none', 'low', 'high');
CREATE TYPE party_position AS ENUM ('support', 'oppose', 'neutral');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles table
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    avatar TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    notification_settings JSONB DEFAULT '{
        "email": true,
        "push": true,
        "topicUpdates": true,
        "lawUpdates": true,
        "weeklyDigest": false
    }',
    privacy_settings JSONB DEFAULT '{
        "profileVisibility": "public",
        "showEmail": false,
        "showLocation": false
    }',
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Topics table
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Political parties table
CREATE TABLE public.political_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_name TEXT UNIQUE NOT NULL,
    logo TEXT,
    color TEXT NOT NULL,
    ideology TEXT,
    leader TEXT,
    seats INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Laws table
CREATE TABLE public.laws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    summary TEXT,
    stage law_stage DEFAULT 'proposed',
    type law_type NOT NULL,
    proposer TEXT NOT NULL,
    proposer_party TEXT REFERENCES public.political_parties(short_name),
    introduction_date DATE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Law details table
CREATE TABLE public.law_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    law_id UUID REFERENCES public.laws(id) ON DELETE CASCADE,
    problem TEXT NOT NULL,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    impact TEXT,
    cost TEXT,
    official_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(law_id)
);

-- Law timelines table
CREATE TABLE public.law_timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    law_id UUID REFERENCES public.laws(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    date DATE NOT NULL,
    status law_stage NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Law parties table (support/opposition)
CREATE TABLE public.law_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    law_id UUID REFERENCES public.laws(id) ON DELETE CASCADE,
    party_name TEXT NOT NULL,
    position party_position NOT NULL,
    votes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Law topics junction table
CREATE TABLE public.law_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    law_id UUID REFERENCES public.laws(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    relevance INTEGER DEFAULT 50 CHECK (relevance >= 0 AND relevance <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(law_id, topic_id)
);

-- User topics junction table
CREATE TABLE public.user_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    is_followed BOOLEAN DEFAULT true,
    notification_level notification_level DEFAULT 'high',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

-- User laws junction table
CREATE TABLE public.user_laws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    law_id UUID REFERENCES public.laws(id) ON DELETE CASCADE,
    is_followed BOOLEAN DEFAULT true,
    is_bookmarked BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, law_id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_active ON public.users(is_active);
CREATE INDEX idx_topics_slug ON public.topics(slug);
CREATE INDEX idx_topics_category ON public.topics(category);
CREATE INDEX idx_topics_active ON public.topics(is_active);
CREATE INDEX idx_laws_slug ON public.laws(slug);
CREATE INDEX idx_laws_stage ON public.laws(stage);
CREATE INDEX idx_laws_type ON public.laws(type);
CREATE INDEX idx_laws_proposer ON public.laws(proposer);
CREATE INDEX idx_laws_introduction_date ON public.laws(introduction_date);
CREATE INDEX idx_law_topics_law_id ON public.law_topics(law_id);
CREATE INDEX idx_law_topics_topic_id ON public.law_topics(topic_id);
CREATE INDEX idx_user_topics_user_id ON public.user_topics(user_id);
CREATE INDEX idx_user_topics_topic_id ON public.user_topics(topic_id);
CREATE INDEX idx_user_laws_user_id ON public.user_laws(user_id);
CREATE INDEX idx_user_laws_law_id ON public.user_laws(law_id);

-- Create full-text search indexes
CREATE INDEX idx_laws_search ON public.laws USING GIN (to_tsvector('english', title || ' ' || description));
CREATE INDEX idx_topics_search ON public.topics USING GIN (to_tsvector('english', name || ' ' || description));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON public.topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_political_parties_updated_at BEFORE UPDATE ON public.political_parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_laws_updated_at BEFORE UPDATE ON public.laws
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_law_details_updated_at BEFORE UPDATE ON public.law_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_topics_updated_at BEFORE UPDATE ON public.user_topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_laws_updated_at BEFORE UPDATE ON public.user_laws
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.political_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_laws ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- User profiles are public but can only be updated by owner
CREATE POLICY "User profiles are viewable by everyone" ON public.user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Topics are public
CREATE POLICY "Topics are viewable by everyone" ON public.topics
    FOR SELECT USING (true);

-- Political parties are public
CREATE POLICY "Political parties are viewable by everyone" ON public.political_parties
    FOR SELECT USING (true);

-- Laws are public
CREATE POLICY "Laws are viewable by everyone" ON public.laws
    FOR SELECT USING (true);

CREATE POLICY "Law details are viewable by everyone" ON public.law_details
    FOR SELECT USING (true);

CREATE POLICY "Law timelines are viewable by everyone" ON public.law_timelines
    FOR SELECT USING (true);

CREATE POLICY "Law parties are viewable by everyone" ON public.law_parties
    FOR SELECT USING (true);

CREATE POLICY "Law topics are viewable by everyone" ON public.law_topics
    FOR SELECT USING (true);

-- User topics can only be managed by the user
CREATE POLICY "Users can view own topic preferences" ON public.user_topics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own topic preferences" ON public.user_topics
    FOR ALL USING (auth.uid() = user_id);

-- User laws can only be managed by the user
CREATE POLICY "Users can view own law preferences" ON public.user_laws
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own law preferences" ON public.user_laws
    FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated; 