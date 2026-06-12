import { X } from 'lucide-react';
import InlineProductSearch, { type SearchProduct } from './InlineProductSearch';

interface InlineProductLineRowProps {
  onProductSelect: (product: SearchProduct) => void;
  onCancel: () => void;
}

export default function InlineProductLineRow({
  onProductSelect,
  onCancel,
}: InlineProductLineRowProps) {
  const handleSelect = (product: SearchProduct) => {
    onProductSelect(product);
  };

  return (
    <tr className="border-b border-gray-100 bg-blue-50">
      <td className="py-4 px-3"></td>
      <td className="py-4 px-3"></td>
      <td className="py-4 px-3" colSpan={6}>
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <InlineProductSearch
              placeholder="Buscar por nombre, código o marca..."
              onSelect={handleSelect}
              onCancel={onCancel}
              autoFocus={true}
            />
          </div>
          <div className="w-[70px]">
            <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
            <input
              type="number"
              defaultValue="1"
              min="0.01"
              step="1"
              className="w-full text-center border border-gray-300 rounded-md py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A99D] focus:border-transparent"
              disabled
            />
          </div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 text-xs font-medium rounded-md hover:bg-red-50 hover:border-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="py-4 px-3"></td>
    </tr>
  );
}
