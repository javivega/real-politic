import { supabase, CongressInitiative, PoliticalParty, InitiativePartyRelationship } from '../lib/supabase';

export class CongressService {
  // Fetch all initiatives with political party information
  static async getInitiatives(): Promise<CongressInitiative[]> {
    try {
      const { data, error } = await supabase
        .from('congress_initiatives')
        .select('*')
        .order('fecha_presentacion', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching initiatives:', error);
      return [];
    }
  }

  // Fetch initiatives with pagination and filtering
  static async getInitiativesPaginated(
    page: number = 1, 
    pageSize: number = 20,
    filters?: {
      search?: string;
      party?: string;
      type?: string;
      status?: string;
    }
  ): Promise<{
    initiatives: CongressInitiative[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build base query
      let query = supabase
        .from('congress_initiatives')
        .select('*');

      // Apply search filter
      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        query = query.or(`accessible_title.ilike.%${searchTerm}%,objeto.ilike.%${searchTerm}%`);
      }

      // Apply party filter
      if (filters?.party && filters.party !== 'all') {
        query = query.eq('political_party_short_name', filters.party);
      }

      // Apply type filter
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('congress_initiative_type', filters.type);
      }

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'urgent':
            query = query.or('nlp_urgency.eq.alta,tipo_tramitacion.eq.urgente');
            break;
          case 'proposed':
            // Default state - no specific filter needed
            break;
          case 'debating':
            query = query.or('situacion_actual.ilike.%Comisión%,situacion_actual.ilike.%Debate%');
            break;
          case 'voting':
            query = query.or('situacion_actual.ilike.%Pleno%,situacion_actual.ilike.%Votación%');
            break;
          case 'passed':
            query = query.eq('resultado_tramitacion', 'Aprobada');
            break;
          case 'published':
            query = query.not('boe_id', 'is', null);
            break;
          case 'rejected':
            query = query.eq('resultado_tramitacion', 'Rechazada');
            break;
          case 'withdrawn':
            query = query.eq('resultado_tramitacion', 'Retirada');
            break;
          case 'closed':
            query = query.eq('resultado_tramitacion', 'Cerrada');
            break;
        }
      }

      // Get total count by creating a separate count query with the same filters
      let countQuery = supabase
        .from('congress_initiatives')
        .select('*', { count: 'exact', head: true });

      // Apply the same filters to count query
      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        countQuery = countQuery.or(`accessible_title.ilike.%${searchTerm}%,objeto.ilike.%${searchTerm}%`);
      }
      if (filters?.party && filters.party !== 'all') {
        countQuery = countQuery.eq('political_party_short_name', filters.party);
      }
      if (filters?.type && filters.type !== 'all') {
        countQuery = countQuery.eq('congress_initiative_type', filters.type);
      }
      if (filters?.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'urgent':
            countQuery = countQuery.or('nlp_urgency.eq.alta,tipo_tramitacion.eq.urgente');
            break;
          case 'debating':
            countQuery = countQuery.or('situacion_actual.ilike.%Comisión%,situacion_actual.ilike.%Debate%');
            break;
          case 'voting':
            countQuery = countQuery.or('situacion_actual.ilike.%Pleno%,situacion_actual.ilike.%Votación%');
            break;
          case 'passed':
            countQuery = countQuery.eq('resultado_tramitacion', 'Aprobada');
            break;
          case 'published':
            countQuery = countQuery.not('boe_id', 'is', null);
            break;
          case 'rejected':
            countQuery = countQuery.eq('resultado_tramitacion', 'Rechazada');
            break;
          case 'withdrawn':
            countQuery = countQuery.eq('resultado_tramitacion', 'Retirada');
            break;
          case 'closed':
            countQuery = countQuery.eq('resultado_tramitacion', 'Cerrada');
            break;
        }
      }

      const { count: total } = await countQuery;

      // Get paginated data with filters
      const { data, error } = await query
        .order('fecha_presentacion', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const initiatives = data || [];
      const hasMore = from + initiatives.length < (total || 0);

      return {
        initiatives,
        total: total || 0,
        page,
        pageSize,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching paginated initiatives:', error);
      return {
        initiatives: [],
        total: 0,
        page,
        pageSize,
        hasMore: false
      };
    }
  }

  // Fetch initiatives by political party
  static async getInitiativesByParty(partyShortName: string): Promise<CongressInitiative[]> {
    try {
      const { data, error } = await supabase
        .from('congress_initiatives')
        .select('*')
        .eq('political_party_short_name', partyShortName)
        .order('fecha_presentacion', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching initiatives by party:', error);
      return [];
    }
  }

  // Fetch all political parties
  static async getPoliticalParties(): Promise<PoliticalParty[]> {
    try {
      const { data, error } = await supabase
        .from('political_parties')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching political parties:', error);
      return [];
    }
  }

  // Fetch party relationships for an initiative
  static async getInitiativePartyRelationships(initiativeId: string): Promise<InitiativePartyRelationship[]> {
    try {
      const { data, error } = await supabase
        .from('congress_initiative_parties')
        .select('*')
        .eq('initiative_id', initiativeId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching party relationships:', error);
      return [];
    }
  }

  // Get statistics for dashboard
  static async getStatistics() {
    try {
      // Get total initiatives
      const { count: totalInitiatives } = await supabase
        .from('congress_initiatives')
        .select('*', { count: 'exact', head: true });

      // Get initiatives by type
      const { data: initiativesByType } = await supabase
        .from('congress_initiatives')
        .select('congress_initiative_type');

      // Get initiatives by party
      const { data: initiativesByParty } = await supabase
        .from('congress_initiatives')
        .select('political_party_short_name, political_party_name, political_party_color');

      // Process the data
      const typeStats = initiativesByType?.reduce((acc: any, item) => {
        const type = item.congress_initiative_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}) || {};

      const partyStats = initiativesByParty?.reduce((acc: any, item) => {
        const party = item.political_party_short_name || 'Unknown';
        if (!acc[party]) {
          acc[party] = {
            name: item.political_party_name || party,
            short_name: party,
            color: item.political_party_color || '#666666',
            count: 0
          };
        }
        acc[party].count++;
        return acc;
      }, {}) || {};

      return {
        totalInitiatives: totalInitiatives || 0,
        typeStats,
        partyStats: Object.values(partyStats),
        recentInitiatives: await this.getInitiatives().then(initiatives => initiatives.slice(0, 5))
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return {
        totalInitiatives: 0,
        typeStats: {},
        partyStats: [],
        recentInitiatives: []
      };
    }
  }

  // Search initiatives
  static async searchInitiatives(query: string): Promise<CongressInitiative[]> {
    try {
      const { data, error } = await supabase
        .from('congress_initiatives')
        .select('*')
        .or(`objeto.ilike.%${query}%,autor.ilike.%${query}%,tipo.ilike.%${query}%`)
        .order('fecha_presentacion', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching initiatives:', error);
      return [];
    }
  }
} 