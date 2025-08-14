# Supabase Integration Guide

This guide explains how to upload the processed Spanish Congress data to Supabase and use the database functions.

## 🗄️ Database Schema

The integration creates the following tables in your Supabase database:

### 1. `congress_initiatives` - Main initiatives table
- **Primary key**: `id` (UUID)
- **Unique constraint**: `num_expediente` (Congress expediente number)
- **Key fields**: tipo, objeto, autor, fechas, comisiones, etc.

### 2. `congress_timeline_events` - Timeline for each initiative
- **Foreign key**: `initiative_id` → `congress_initiatives.id`
- **Fields**: evento, fecha_inicio, fecha_fin, descripcion, orden

### 3. `congress_relationships` - Relationships between initiatives
- **Types**: 'relacionada', 'origen', 'similar'
- **Similarity score**: 0.0 to 1.0 for similarity relationships
- **Bidirectional**: Similarity relationships are automatically mirrored

### 4. `congress_keywords` - Extracted keywords
- **Fields**: palabra, frecuencia
- **Auto-extracted** from initiative text using Spanish language processing

### 5. `congress_initiative_keywords` - Junction table
- **Links** initiatives to keywords with relevance scores

## 🚀 Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Apply Database Migration
```sql
-- Run the migration file in your Supabase SQL editor
-- File: backend/supabase/migrations/003_create_congress_tables.sql
```

### 3. Install Dependencies
```bash
cd backend/laws/congress
npm install
```

### 4. Create Environment File
```bash
# Create .env file with your Supabase credentials
cp .env.example .env
# Edit .env and add your actual values
```

### 5. Run the Upload Script
```bash
node uploadToSupabase.js
```

## 🔧 Database Functions

### Get Related Initiatives
```sql
SELECT * FROM get_related_initiatives('121/000001/0000', 10);
```

**Returns**:
- `expediente`: Related initiative number
- `tipo`: Initiative type
- `objeto`: Initiative description
- `relationship_type`: Type of relationship
- `similarity_score`: Similarity percentage (0-100)
- `relevance_score`: Calculated relevance score

### Get Initiative Timeline
```sql
SELECT * FROM get_initiative_timeline('121/000001/0000');
```

**Returns**:
- `evento`: Event name
- `fecha_inicio`: Start date
- `fecha_fin`: End date
- `descripcion`: Event description
- `orden`: Chronological order

### Extract Keywords
```sql
SELECT * FROM extract_initiative_keywords('Texto de la iniciativa...');
```

**Returns**: Array of relevant keywords extracted from text

## 📊 Query Examples

### Find Similar Initiatives
```sql
-- Get initiatives similar to a specific one
SELECT 
    ci.num_expediente,
    ci.objeto,
    cr.similarity_score
FROM congress_initiatives ci
INNER JOIN congress_relationships cr ON ci.id = cr.target_initiative_id
INNER JOIN congress_initiatives source ON source.id = cr.source_initiative_id
WHERE source.num_expediente = '121/000001/0000'
AND cr.relationship_type = 'similar'
ORDER BY cr.similarity_score DESC;
```

### Search by Keywords
```sql
-- Find initiatives containing specific keywords
SELECT DISTINCT
    ci.num_expediente,
    ci.objeto,
    ci.autor
FROM congress_initiatives ci
INNER JOIN congress_initiative_keywords cik ON ci.id = cik.initiative_id
INNER JOIN congress_keywords ck ON cik.keyword_id = ck.id
WHERE ck.palabra IN ('salud', 'sanidad', 'hospitales')
ORDER BY cik.relevancia DESC;
```

### Get Initiative Statistics
```sql
-- Count initiatives by type and status
SELECT 
    tipo,
    situacion_actual,
    COUNT(*) as total
FROM congress_initiatives
GROUP BY tipo, situacion_actual
ORDER BY tipo, total DESC;
```

### Find Most Related Initiatives
```sql
-- Initiatives with most relationships
SELECT 
    ci.num_expediente,
    ci.objeto,
    COUNT(cr.id) as total_relationships
FROM congress_initiatives ci
LEFT JOIN congress_relationships cr ON ci.id = cr.source_initiative_id
GROUP BY ci.id, ci.num_expediente, ci.objeto
ORDER BY total_relationships DESC
LIMIT 10;
```

## 🔗 Frontend Integration

### Using Supabase Client

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Get related initiatives
async function getRelatedInitiatives(expediente) {
  const { data, error } = await supabase
    .rpc('get_related_initiatives', { 
      initiative_expediente: expediente, 
      max_results: 10 
    })
  
  if (error) throw error
  return data
}

// Get initiative timeline
async function getInitiativeTimeline(expediente) {
  const { data, error } = await supabase
    .rpc('get_initiative_timeline', { 
      initiative_expediente: expediente 
    })
  
  if (error) throw error
  return data
}

// Search initiatives
async function searchInitiatives(query) {
  const { data, error } = await supabase
    .from('congress_initiatives')
    .select('*')
    .textSearch('objeto', query, {
      type: 'websearch',
      config: 'spanish'
    })
  
  if (error) throw error
  return data
}
```

### Graph Visualization

```javascript
// Get all relationships for graph visualization
async function getRelationshipsGraph() {
  const { data, error } = await supabase
    .from('congress_relationships')
    .select(`
      source_initiative_id,
      target_initiative_id,
      relationship_type,
      similarity_score
    `)
  
  if (error) throw error
  
  // Transform for graph library (e.g., D3.js, vis.js)
  const nodes = []
  const edges = []
  
  // Process data to create nodes and edges
  // ... graph transformation logic
  
  return { nodes, edges }
}
```

## 📈 Performance Optimization

### Indexes Created
- **Primary keys**: All tables have UUID primary keys
- **Foreign keys**: Properly indexed for JOIN operations
- **Search indexes**: Full-text search on Spanish text
- **Composite indexes**: For common query patterns

### Query Optimization Tips
1. **Use RPC functions** for complex queries (they're optimized)
2. **Limit results** when possible
3. **Use specific columns** instead of `SELECT *`
4. **Leverage full-text search** for text queries

## 🔒 Security & Permissions

### Row Level Security (RLS)
- **All Congress data is public** (readable by everyone)
- **No write permissions** for anonymous users
- **Admin operations** require service role key

### Access Control
```sql
-- Example: Make data read-only for authenticated users
CREATE POLICY "Congress data read-only" ON congress_initiatives
    FOR SELECT USING (true);

CREATE POLICY "No insert/update for users" ON congress_initiatives
    FOR ALL USING (false);
```

## 🚨 Troubleshooting

### Common Issues

1. **Migration fails**
   - Check if you have admin access to Supabase
   - Verify the SQL syntax is correct
   - Ensure extensions are enabled

2. **Upload fails**
   - Verify your environment variables
   - Check your internet connection
   - Ensure the database tables exist

3. **Performance issues**
   - Check if indexes are created
   - Monitor query execution plans
   - Consider pagination for large datasets

### Debug Queries

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'congress%';

-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'congress_initiatives';

-- Check relationships
SELECT COUNT(*) as total_relationships FROM congress_relationships;
```

## 📚 Next Steps

1. **Verify data upload** in Supabase dashboard
2. **Test database functions** with sample queries
3. **Build frontend components** using the data
4. **Implement search functionality** with full-text search
5. **Create graph visualizations** using relationship data
6. **Set up monitoring** for database performance

## 🤝 Support

For issues with:
- **Database schema**: Check migration file
- **Upload process**: Review error logs
- **Query performance**: Use EXPLAIN ANALYZE
- **Supabase setup**: Consult Supabase documentation 