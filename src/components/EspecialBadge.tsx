import { motivoEspecial, type DisponibilidadArticulo } from '../lib/disponibilidad';

interface EspecialBadgeProps {
  info: DisponibilidadArticulo;
  /** La línea ya fue aprobada o el producto lo eligió el ejecutivo: se muestra en gris. */
  revisado?: boolean;
}

/**
 * Badge «ESP» (especial): el precio del artículo está inactivo en Precio grupo.
 * Rojo mientras la línea pide revisión, gris cuando ya se revisó. Solo lleva el texto ESP;
 * la explicación va en el texto emergente.
 */
export default function EspecialBadge({ info, revisado = false }: EspecialBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 whitespace-nowrap align-middle"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        backgroundColor: revisado ? '#F3F3F3' : '#FEDED7',
        color: revisado ? '#747474' : '#BA0517',
      }}
      title={`${motivoEspecial(info)}${revisado ? ' Línea ya revisada.' : ''}`}
    >
      ESP
    </span>
  );
}
