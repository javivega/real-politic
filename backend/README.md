# Real Politic Backend - Supabase

A modern, scalable backend for the Real Politic app using Supabase (PostgreSQL + Authentication + Real-time).

## 🚀 Why Supabase?

- **PostgreSQL Database**: Robust, scalable database with advanced features
- **Built-in Authentication**: User management, OAuth, and JWT tokens
- **Real-time Subscriptions**: Live updates for law changes and notifications
- **Row Level Security**: Fine-grained access control
- **Auto-generated APIs**: RESTful endpoints with automatic CRUD operations
- **Edge Functions**: Serverless functions for complex business logic
- **Dashboard**: Beautiful admin interface for data management

## 🛠️ Tech Stack

- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with JWT
- **API**: Express.js with TypeScript
- **Real-time**: WebSocket subscriptions
- **Storage**: Supabase Storage for files
- **Deployment**: Supabase Cloud or self-hosted

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI (for local development)
- PostgreSQL knowledge (helpful but not required)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Supabase

#### Option A: Supabase Cloud (Recommended for production)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and API keys
4. Create a `.env` file:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://yourdomain.com
```

#### Option B: Local Development

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Start local Supabase:
```bash
supabase start
```

3. Create `.env` file:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### 3. Set Up Database

1. Apply the database schema:
```bash
# For local development
supabase db reset

# For production (using Supabase dashboard)
# Copy and paste the SQL from supabase/migrations/001_initial_schema.sql
```

2. Seed the database with initial data:
```bash
npm run db:seed
```

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📊 Database Schema

### Core Tables

- **`users`**: User accounts and profiles
- **`topics`**: Political topics and categories
- **`laws`**: Parliamentary laws and bills
- **`law_details`**: Detailed information about laws
- **`law_timelines`**: Progress tracking for laws
- **`law_parties`**: Political party positions on laws
- **`political_parties`**: Political party information
- **`user_topics`**: User topic preferences
- **`user_laws`**: User law bookmarks and follows

### Key Features

- **Row Level Security (RLS)**: Automatic data access control
- **Full-text Search**: PostgreSQL search capabilities
- **JSON Fields**: Flexible data storage for preferences
- **Automatic Timestamps**: Created/updated tracking
- **Foreign Key Constraints**: Data integrity
- **Indexes**: Performance optimization

## 🔐 Authentication

Supabase provides built-in authentication with:

- Email/password signup and login
- OAuth providers (Google, GitHub, etc.)
- Magic link authentication
- Phone number authentication
- JWT token management
- User session handling

### User Management

```typescript
import { supabase } from './lib/supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

## 📡 API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Available Endpoints

- `GET /health` - Health check
- `GET /topics` - List all topics
- `GET /topics/:id` - Get specific topic
- `GET /laws` - List laws with filters
- `GET /laws/:id` - Get specific law with details
- `GET /parties` - List political parties
- `GET /statistics` - Get app statistics

### Example API Calls

```bash
# Get all topics
curl http://localhost:5000/api/v1/topics

# Get laws with filters
curl "http://localhost:5000/api/v1/laws?stage=debating&type=bill&page=1&limit=10"

# Get specific law
curl http://localhost:5000/api/v1/laws/law-id-here

# Get statistics
curl http://localhost:5000/api/v1/statistics
```

## 🔄 Real-time Features

Supabase provides real-time subscriptions for:

- Law status changes
- New law proposals
- User notifications
- Topic updates

```typescript
// Subscribe to law changes
const subscription = supabase
  .channel('law-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'laws' },
    (payload) => {
      console.log('Law changed:', payload);
    }
  )
  .subscribe();
```

## 🗄️ Database Operations

### Using Supabase Client

```typescript
import { supabase } from './lib/supabase';

// Get topics
const { data, error } = await supabase
  .from('topics')
  .select('*')
  .eq('is_active', true);

// Insert new law
const { data, error } = await supabase
  .from('laws')
  .insert({
    title: 'New Law',
    description: 'Description here',
    type: 'bill',
    proposer: 'John Doe'
  })
  .select();

// Update law
const { data, error } = await supabase
  .from('laws')
  .update({ stage: 'voting' })
  .eq('id', 'law-id')
  .select();

// Delete law
const { error } = await supabase
  .from('laws')
  .delete()
  .eq('id', 'law-id');
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="topics"
```

## 🚀 Deployment

### Supabase Cloud

1. Push your local schema to production:
```bash
supabase db push --db-url your_production_db_url
```

2. Set environment variables in your hosting platform
3. Deploy your Express server

### Self-hosted

1. Set up PostgreSQL database
2. Run migration scripts
3. Configure environment variables
4. Deploy Express server

## 📈 Monitoring & Analytics

- **Supabase Dashboard**: Database metrics and usage
- **Logs**: Server and database logs
- **Performance**: Query performance insights
- **Security**: Authentication and access logs

## 🔧 Development Commands

```bash
# Start local Supabase
npm run db:start

# Stop local Supabase
npm run db:stop

# Reset local database
npm run db:reset

# Apply migrations
npm run db:migrate

# Seed database
npm run db:seed

# Generate TypeScript types
npm run db:generate-types

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check Supabase URL and keys
   - Verify network connectivity
   - Check firewall settings

2. **Authentication Errors**
   - Verify JWT secret
   - Check user permissions
   - Review RLS policies

3. **Real-time Not Working**
   - Check WebSocket connectivity
   - Verify channel subscriptions
   - Review event triggers

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Community](https://github.com/supabase/supabase/discussions)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Real Politic Backend** - Powered by Supabase and PostgreSQL for scalable, real-time parliamentary transparency. 