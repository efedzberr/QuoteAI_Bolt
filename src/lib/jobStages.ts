export type JobStage =
  | 'nueva_solicitud'
  | 'extraccion'
  | 'extraccion_completada'
  | 'revision_datos'
  | 'matching'
  | 'matching_completado'
  | 'validacion'
  | 'completada'
  | 'generacion'
  | 'completado'
  | 'pdf_generado'
  | 'error';

export interface StageInfo {
  order: number;
  label: string;
  color: string;
  bgColor: string;
  type: 'reposo' | 'procesando' | 'validado' | 'final' | 'error';
}

const STAGES: Record<string, StageInfo> = {
  nueva_solicitud: { order: 1, label: 'Nueva solicitud', color: '#444444', bgColor: '#F0F0F0', type: 'reposo' },
  extraccion: { order: 2, label: 'Extraccion completada', color: '#2E844A', bgColor: '#DEF5E5', type: 'reposo' },
  extraccion_completada: { order: 2, label: 'Extraccion completada', color: '#2E844A', bgColor: '#DEF5E5', type: 'reposo' },
  revision_datos: { order: 3, label: 'Revision de datos', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  matching: { order: 4, label: 'Procesando', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  procesando: { order: 4, label: 'Procesando', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  matching_completado: { order: 5, label: 'Por validar', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  validacion: { order: 5, label: 'Por validar', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  en_revision: { order: 5, label: 'Por validar', color: '#B86C00', bgColor: '#FEF1DC', type: 'reposo' },
  enviado_validacion: { order: 4, label: 'Procesando', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  generacion: { order: 6, label: 'Generando propuesta', color: '#0176D3', bgColor: '#EAF5FE', type: 'procesando' },
  completada: { order: 7, label: 'Validada', color: '#2E844A', bgColor: '#DEF5E5', type: 'validado' },
  completado: { order: 7, label: 'Validada', color: '#2E844A', bgColor: '#DEF5E5', type: 'validado' },
  pdf_generado: { order: 8, label: 'Completada', color: '#2E844A', bgColor: '#DEF5E5', type: 'final' },
  error: { order: 0, label: 'Error', color: '#BA0517', bgColor: '#FEDED7', type: 'error' },
};

const FALLBACK: StageInfo = { order: 0, label: 'Desconocido', color: '#747474', bgColor: '#F0F0F0', type: 'reposo' };

export function getStageInfo(status: string): StageInfo {
  return STAGES[status] || FALLBACK;
}

export function isResumableStage(status: string): boolean {
  const info = getStageInfo(status);
  return (info.type === 'reposo' && status !== 'nueva_solicitud') || info.type === 'validado';
}

export function isProcessingStage(status: string): boolean {
  const info = getStageInfo(status);
  return info.type === 'procesando';
}

export function isFinalStage(status: string): boolean {
  return status === 'pdf_generado';
}

export function isValidatedStage(status: string): boolean {
  return status === 'completada' || status === 'completado';
}
