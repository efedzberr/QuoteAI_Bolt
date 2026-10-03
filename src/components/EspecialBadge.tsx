import { motivoEspecial, type DisponibilidadArticulo } from '../lib/disponibilidad';

interface EspecialBadgeProps {
  info: DisponibilidadArticulo;
  /** La línea ya fue aprobada o el producto lo eligió el ejecutivo: solo cambia el texto emergente. */
  revisado?: boolean;
}

/**
 * Badge «ESP» (especial): el precio del artículo está inactivo en Precio grupo.
 * Siempre rojo, esté o no revisada la línea. Solo lleva el texto ESP; la explicación va en
 * el texto emergente.
 */
export default function EspecialBadge({ info, revisado = false }: EspecialBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 whitespace-nowrap align-middle"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        backgroundColor: '#FEDED7',
        color: '#BA0517',
      }}
      title={`${motivoEspecial(info)}${revisado ? ' Línea ya revisada.' : ''}`}
    >
      ESP
    </span>
  );
}
