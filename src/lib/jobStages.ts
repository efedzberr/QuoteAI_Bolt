export type JobStage =
  | 'nueva_solicitud'
  | 'extraccion'
  | 'revision_datos'
  | 'matching'
  | 'validacion'
  | 'generacion'
  | 'completado'
  | 'error';

export interface StageInfo {
  order: number;
  label: string;
  color: string;
  bgColor: string;
  type: 'reposo' | 'procesando' | 'final' | 'error';
}

const STAGES: Record<string, StageInfo> = {
  nueva_solicitud: { order: 1, label: 'Nueva solicitud', color: '#444444', bgColor: '#F0F0F0', type: 'reposo' },
  extraccion: { order: 2, label: 'Extraccion inteligente', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  revision_datos: { order: 3, label: 'Revision de datos', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  matching: { order: 4, label: 'Matching de productos', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  validacion: { order: 5, label: 'Validacion comercial', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  generacion: { order: 6, label: 'Generando propuesta', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  completado: { order: 7, label: 'Completada', color: '#2E844A', bgColor: '#DEF5E5', type: 'final' },
  error: { order: 0, label: 'Error', color: '#BA0517', bgColor: '#FEDED7', type: 'error' },
  // Legacy values mapping
  procesando: { order: 2, label: 'Procesando', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  en_revision: { order: 5, label: 'Validacion comercial', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  enviado_validacion: { order: 4, label: 'Matching', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
};

const FALLBACK: StageInfo = { order: 0, label: 'Desconocido', color: '#747474', bgColor: '#F0F0F0', type: 'reposo' };

export function getStageInfo(status: string): StageInfo {
  return STAGES[status] || FALLBACK;
}

export function isResumableStage(status: string): boolean {
  const info = getStageInfo(status);
  return info.type === 'reposo' && status !== 'nueva_solicitud';
}

export function isProcessingStage(status: string): boolean {
  const info = getStageInfo(status);
  return info.type === 'procesando';
}

export function isFinalStage(status: string): boolean {
  return status === 'completado';
}
