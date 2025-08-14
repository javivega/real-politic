const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');

/**
 * Supabase Uploader for Spanish Congress Data
 * Uploads processed XML data to Supabase database
 */

class CongressSupabaseUploader {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.uploadedInitiatives = new Map(); // expediente -> id
    this.uploadedKeywords = new Map(); // palabra -> id
  }

  /**
   * Convert Spanish date format (DD/MM/YYYY) to ISO date
   * @param {string} fechaEspanol - Date in DD/MM/YYYY format
   * @returns {string|null} ISO date string or null if invalid
   */
  convertSpanishDate(fechaEspanol) {
    if (!fechaEspanol || typeof fechaEspanol !== 'string') {
      return null;
    }
    
    const match = fechaEspanol.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return null;
    }
    
    const [, dia, mes, año] = match;
    return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  /**
   * Convert initiative type to database enum
   * @param {string} tipo - Initiative type from XML
   * @returns {string} Database enum value
   */
  convertInitiativeType(tipo) {
    if (!tipo) return 'Proyecto de ley';
    
    const typeMapping = {
      'Proyecto de ley': 'Proyecto de ley',
      'Proposición de ley': 'Proposición de ley',
      'Propuesta de reforma': 'Propuesta de reforma',
      'Iniciativa legislativa aprobada': 'Iniciativa legislativa aprobada',
      'Ley': 'Ley'
    };
    
    return typeMapping[tipo] || 'Proyecto de ley';
  }

  /**
   * Upload a single initiative to the database
   * @param {Object} iniciativa - Initiative data from JSON
   * @returns {Object} Uploaded initiative with database ID
   */
  async uploadInitiative(iniciativa) {
    try {
      // Prepare initiative data for database
      const initiativeData = {
        num_expediente: iniciativa.numExpediente,
        tipo: this.convertInitiativeType(iniciativa.tipo),
        objeto: iniciativa.objeto,
        autor: iniciativa.autor,
        fecha_presentacion: this.convertSpanishDate(iniciativa.fechaPresentacion),
        fecha_calificacion: this.convertSpanishDate(iniciativa.fechaCalificacion),
        legislatura: iniciativa.legislatura,
        supertipo: iniciativa.supertipo,
        agrupacion: iniciativa.agrupacion,
        tipo_tramitacion: iniciativa.tipotramitacion,
        resultado_tramitacion: iniciativa.resultadoTramitacion,
        situacion_actual: iniciativa.situacionActual,
        comision_competente: iniciativa.comisionCompetente,
        plazos: iniciativa.plazos,
        ponentes: iniciativa.ponentes,
        enlaces_bocg: iniciativa.enlacesBOCG,
        enlaces_ds: iniciativa.enlacesDS,
        tramitacion_texto: iniciativa.tramitacion
      };

      // Check if initiative already exists
      const { data: existing } = await this.supabase
        .from('congress_initiatives')
        .select('id')
        .eq('num_expediente', iniciativa.numExpediente)
        .single();

      let result;
      if (existing) {
        // Update existing initiative
        const { data, error } = await this.supabase
          .from('congress_initiatives')
          .update(initiativeData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
        console.log(`🔄 Updated initiative: ${iniciativa.numExpediente}`);
      } else {
        // Insert new initiative
        const { data, error } = await this.supabase
          .from('congress_initiatives')
          .insert(initiativeData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
        console.log(`✅ Uploaded initiative: ${iniciativa.numExpediente}`);
      }

      // Store the mapping for relationships
      this.uploadedInitiatives.set(iniciativa.numExpediente, result.id);
      
      return result;
    } catch (error) {
      console.error(`❌ Error uploading initiative ${iniciativa.numExpediente}:`, error);
      throw error;
    }
  }

  /**
   * Upload timeline events for an initiative
   * @param {string} initiativeId - Database ID of the initiative
   * @param {Array} timeline - Timeline events array
   */
  async uploadTimeline(initiativeId, timeline) {
    if (!timeline || timeline.length === 0) return;

    try {
      // Delete existing timeline events
      await this.supabase
        .from('congress_timeline_events')
        .delete()
        .eq('initiative_id', initiativeId);

      // Prepare timeline events
      const timelineEvents = timeline.map((evento, index) => ({
        initiative_id: initiativeId,
        evento: evento.evento,
        fecha_inicio: this.convertSpanishDate(evento.fechaInicio),
        fecha_fin: this.convertSpanishDate(evento.fechaFin),
        descripcion: evento.descripcion,
        orden: index + 1
      }));

      // Insert timeline events
      const { error } = await this.supabase
        .from('congress_timeline_events')
        .insert(timelineEvents);

      if (error) throw error;
      console.log(`📅 Uploaded ${timelineEvents.length} timeline events for initiative ${initiativeId}`);
    } catch (error) {
      console.error(`❌ Error uploading timeline for initiative ${initiativeId}:`, error);
    }
  }

  /**
   * Upload keywords for an initiative
   * @param {string} initiativeId - Database ID of the initiative
   * @param {string} objeto - Initiative text to extract keywords from
   */
  async uploadKeywords(initiativeId, objeto) {
    try {
      // Extract keywords using the database function
      const { data: keywords, error } = await this.supabase
        .rpc('extract_initiative_keywords', { initiative_text: objeto });

      if (error) throw error;

      if (keywords && keywords.length > 0) {
        // Process each keyword
        for (const palabra of keywords) {
          // Get or create keyword
          let keywordId = this.uploadedKeywords.get(palabra);
          
          if (!keywordId) {
            // Try to find existing keyword
            const { data: existing } = await this.supabase
              .from('congress_keywords')
              .select('id')
              .eq('palabra', palabra)
              .single();

            if (existing) {
              keywordId = existing.id;
              // Update frequency
              await this.supabase
                .from('congress_keywords')
                .update({ frecuencia: existing.frecuencia + 1 })
                .eq('id', existing.id);
            } else {
              // Create new keyword
              const { data: newKeyword, error: createError } = await this.supabase
                .from('congress_keywords')
                .insert({ palabra })
                .select()
                .single();
              
              if (createError) throw createError;
              keywordId = newKeyword.id;
            }
            
            this.uploadedKeywords.set(palabra, keywordId);
          }

          // Link keyword to initiative
          await this.supabase
            .from('congress_initiative_keywords')
            .upsert({
              initiative_id: initiativeId,
              keyword_id: keywordId,
              relevancia: 50
            }, { onConflict: 'initiative_id,keyword_id' });
        }
      }
    } catch (error) {
      console.error(`❌ Error uploading keywords for initiative ${initiativeId}:`, error);
    }
  }

  /**
   * Upload relationships between initiatives
   * @param {Array} iniciativas - Array of all initiatives
   */
  async uploadRelationships(iniciativas) {
    try {
      console.log('🔗 Uploading relationships...');
      
      // Clear existing relationships
      await this.supabase
        .from('congress_relationships')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      let totalRelationships = 0;

      for (const iniciativa of iniciativas) {
        const sourceId = this.uploadedInitiatives.get(iniciativa.numExpediente);
        if (!sourceId) continue;

        // Upload direct relationships
        for (const relacion of iniciativa.relacionesDirectas) {
          const targetId = this.uploadedInitiatives.get(relacion.expediente);
          if (targetId && targetId !== sourceId) {
            await this.supabase
              .from('congress_relationships')
              .insert({
                source_initiative_id: sourceId,
                target_initiative_id: targetId,
                relationship_type: relacion.tipo,
                similarity_score: null
              });
            totalRelationships++;
          }
        }

        // Upload similarity relationships
        for (const similar of iniciativa.similares) {
          const targetId = this.uploadedInitiatives.get(similar.expediente);
          if (targetId && targetId !== sourceId) {
            await this.supabase
              .from('congress_relationships')
              .insert({
                source_initiative_id: sourceId,
                target_initiative_id: targetId,
                relationship_type: 'similar',
                similarity_score: similar.similitud
              });
            totalRelationships++;
          }
        }
      }

      console.log(`✅ Uploaded ${totalRelationships} relationships`);
    } catch (error) {
      console.error('❌ Error uploading relationships:', error);
      throw error;
    }
  }

  /**
   * Upload all Congress data from JSON file
   * @param {string} jsonFilePath - Path to the JSON file with processed data
   */
  async uploadFromJSON(jsonFilePath) {
    try {
      console.log('🚀 Starting Supabase upload...');
      
      // Read JSON file
      const data = await fs.readJson(jsonFilePath);
      console.log(`📊 Found ${data.length} initiatives to upload`);

      // Upload initiatives first
      for (const iniciativa of data) {
        const uploadedInitiative = await this.uploadInitiative(iniciativa);
        
        // Upload timeline
        if (iniciativa.timeline && iniciativa.timeline.length > 0) {
          await this.uploadTimeline(uploadedInitiative.id, iniciativa.timeline);
        }
        
        // Upload keywords
        if (iniciativa.objeto) {
          await this.uploadKeywords(uploadedInitiative.id, iniciativa.objeto);
        }
      }

      // Upload relationships after all initiatives are uploaded
      await this.uploadRelationships(data);

      console.log('✅ Supabase upload completed successfully!');
      
      // Print summary
      console.log('\n📊 Upload Summary:');
      console.log(`   • Initiatives: ${this.uploadedInitiatives.size}`);
      console.log(`   • Keywords: ${this.uploadedKeywords.size}`);
      
    } catch (error) {
      console.error('❌ Error during Supabase upload:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('congress_initiatives')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }
}

module.exports = CongressSupabaseUploader; 