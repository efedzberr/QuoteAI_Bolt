import { useEffect, useState } from 'react';
import ObjectPage from './objects/ObjectPage';

/** Sección «Clientes»: cuentas de Salesforce guardadas en la tabla clientes. Cada usuario ve las que Salesforce le ha regresado. */
export default function ClientesScreen() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <div className="bg-white rounded-card shadow-sm border border-rule p-6">
        <ObjectPage objectId="clientes" onToast={(message, type) => setToast({ type, message })} />
      </div>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg font-medium text-sm text-white ${toast.type === 'success' ? 'bg-good' : 'bg-bad'}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
