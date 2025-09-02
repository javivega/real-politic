import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://xxlhysubtwqeztvzfexv.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bGh5c3VidHdxZXp0dnpmZXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTExMzksImV4cCI6MjA3MDU4NzEzOX0.lCMYmK8bx68H6D7vV339ARf9pgixnDrSjMLQ-e4h58w';

// Debug environment variables
console.log('🔍 Supabase Configuration Debug:');
console.log('  - REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
console.log('  - REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('  - Using URL:', supabaseUrl);
console.log('  - Using Key:', supabaseKey ? 'SET' : 'NOT SET');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Test the connection
(async () => {
  try {
    const result = await supabase.from('congress_initiatives').select('count').limit(1);
    if (result.error) {
      console.error('❌ Supabase connection test failed:', result.error);
    } else {
      console.log('✅ Supabase connection test successful');
    }
  } catch (error: unknown) {
    console.error('❌ Supabase connection test error:', error);
  }
})();

// Types for Congress data
export interface CongressInitiative {
  id: string;
  num_expediente: string;
  tipo: string;
  objeto: string;
  autor: string;
  fecha_presentacion: string;
  fecha_calificacion: string;
  legislatura: string;
  supertipo: string;
  agrupacion: string;
  tipo_tramitacion: string;
  resultado_tramitacion: string;
  situacion_actual: string;
  comision_competente: string;
  plazos: string;
  ponentes: string;
  enlaces_bocg: string;
  enlaces_ds: string;
  tramitacion_texto: string;
  congress_initiative_type: string;
  political_party_id: string;
  political_party_name: string;
  political_party_short_name: string;
  political_party_confidence: string;
  political_party_method: string;
  political_party_color: string;
  // NLP processed fields
  accessible_title: string;
  nlp_subject_area: string;
  nlp_urgency: string;
  nlp_complexity: string;
  nlp_readability: number;
  nlp_action: string;
  nlp_purpose: string;
  nlp_specific_changes: string;
  nlp_regulation_scope: string;
  // New stage classification fields
  stage?: 'proposed' | 'debating' | 'committee' | 'voting' | 'passed' | 'rejected' | 'withdrawn' | 'closed' | 'published';
  current_step?: number;
  stage_reason?: any;
  // New BOE publication fields
  boe_id?: string;
  boe_url?: string;
  boe_publication_date?: string;
  publication_confidence?: 'high' | 'medium' | 'low' | 'not_identified';
  created_at: string;
  updated_at: string;
}

export interface PoliticalParty {
  id: string;
  name: string;
  short_name: string;
  logo: string;
  color: string;
  ideology: string;
  leader: string;
  seats: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InitiativePartyRelationship {
  id: string;
  initiative_id: string;
  party_id: string;
  relationship_type: string;
  confidence: string;
  method: string;
  created_at: string;
  updated_at: string;
} 