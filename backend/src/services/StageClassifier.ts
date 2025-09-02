import { CongressInitiative } from '../types';

export type CanonicalStage =
  | 'proposed'
  | 'debating'
  | 'committee'
  | 'voting'
  | 'passed'
  | 'rejected'
  | 'withdrawn'
  | 'closed'
  | 'published';

export interface ClassificationResult {
  stage: CanonicalStage;
  step: number; // 1..5 presentation, debate, commission, approval, publication
  reason: Record<string, unknown>;
}

const includesAny = (text: string, keywords: string[]): boolean => {
  const t = (text || '').toLowerCase();
  return keywords.some(k => t.includes(k));
};

export function classifyCongressInitiative(initiative: CongressInitiative): ClassificationResult {
  const resultado = initiative.RESULTADOTRAMITACION || '';
  const situacion = initiative.SITUACIONACTUAL || '';
  const tramitacion = initiative.TRAMITACIONSEGUIDA || '';
  const comision = initiative.COMISIONCOMPETENTE || '';
  const enlaces = `${initiative.ENLACESBOCG || ''} ${initiative.ENLACESDS || ''}`;

  const text = `${resultado} ${situacion} ${tramitacion} ${comision} ${enlaces}`.toLowerCase();

  const signals: Record<string, boolean> = {
    hasAprob: includesAny(resultado, ['aprob']),
    hasRechaz: includesAny(resultado, ['rechaz']),
    hasRetir: includesAny(resultado, ['retirad']),
    // Deprecated heuristic (kept for reason logging only)
    hasBOEText: includesAny(text, ['boe', 'publicación', 'publicacion', 'entrada en vigor']),
    hasVerifiedBOE: Boolean((initiative as any).boe_url || (initiative as any).boe_id),
    hasVotacion: includesAny(text, ['votación', 'votacion', 'voto', 'aprobación', 'aprobacion', 'senado']),
    hasComision: includesAny(text, ['comisión', 'comision', 'ponencia', 'dictamen', 'enmiendas parciales']),
    hasDebate: includesAny(text, ['totalidad', 'debate en el pleno', 'toma en consideración', 'toma en consideracion', 'pleno']),
    isClosed: includesAny(situacion, ['cerrado']),
  };

  // Precedence: Result > Publication (verified) > Voting > Committee > Debating > Closed > Default
  if (signals.hasAprob) {
    return { stage: 'passed', step: 4, reason: { signals } };
  }
  if (signals.hasRechaz) {
    return { stage: 'rejected', step: 2, reason: { signals } };
  }
  if (signals.hasRetir) {
    return { stage: 'withdrawn', step: 1, reason: { signals } };
  }
  if (signals.hasVerifiedBOE) {
    return { stage: 'published', step: 5, reason: { signals } };
  }
  if (signals.hasVotacion) {
    return { stage: 'voting', step: 4, reason: { signals } };
  }
  if (signals.hasComision) {
    return { stage: 'committee', step: 3, reason: { signals } };
  }
  if (signals.hasDebate) {
    return { stage: 'debating', step: 2, reason: { signals } };
  }
  if (signals.isClosed) {
    return { stage: 'closed', step: 1, reason: { signals } };
  }
  return { stage: 'proposed', step: 1, reason: { signals } };
}

export function pickLatestStage(
  classifications: Array<{ date?: string | Date | null; result: ClassificationResult }>
): ClassificationResult {
  if (classifications.length === 0) {
    return { stage: 'proposed', step: 1, reason: { empty: true } };
  }
  // Sort by date if provided, otherwise keep insertion order
  const sorted = [...classifications].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });
  const last = sorted[sorted.length - 1];
  return last && last.result ? last.result : { stage: 'proposed', step: 1, reason: { safeFallback: true } };
}


