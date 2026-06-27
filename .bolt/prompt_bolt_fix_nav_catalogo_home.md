# Prompt para Bolt — Arreglar navegación al Catálogo desde el Home

## Problema

Al hacer clic en "Catálogo" en el menú lateral **estando en la pantalla de inicio (Home)**, no pasa nada (se ilumina pero no navega, sin error en consola).

Causa: el componente `HomeDashboard` usa su **propio** `AppLayout` con un `handleNavigate` interno que solo maneja `'cotizar'` y `'ajustes'`. No tiene caso para `'catalogo'`, así que el clic se ignora. (El `CatalogScreen` y el resto del cableado en `App.tsx` ya están correctos; el único hueco es este.)

## Cambios (exactos, mínimos)

### 1. `src/components/HomeDashboard.tsx` — agregar la prop a la interfaz

En la interfaz `HomeDashboardProps`, junto a `onOpenAdmin?: () => void;`, agrega:

```ts
  onOpenCatalog?: () => void;
```

### 2. `src/components/HomeDashboard.tsx` — agregar la prop a la desestructuración

Busca:
```ts
function HomeDashboard({ onNewQuote, onOpenAdmin, onResumeJob, onReexecuteJob, onJobClick }: HomeDashboardProps) {
```
Reemplaza por:
```ts
function HomeDashboard({ onNewQuote, onOpenAdmin, onOpenCatalog, onResumeJob, onReexecuteJob, onJobClick }: HomeDashboardProps) {
```

### 3. `src/components/HomeDashboard.tsx` — agregar el caso en `handleNavigate`

Busca:
```ts
  const handleNavigate = (section: string) => {
    if (section === 'cotizar') onNewQuote();
    else if (section === 'ajustes') onOpenAdmin?.();
  };
```
Reemplaza por:
```ts
  const handleNavigate = (section: string) => {
    if (section === 'cotizar') onNewQuote();
    else if (section === 'catalogo') onOpenCatalog?.();
    else if (section === 'ajustes') onOpenAdmin?.();
  };
```

### 4. `src/App.tsx` — pasar la nueva prop al `<HomeDashboard>`

En el render de la pantalla Home (`if (currentScreen === 'home')`), dentro de `<HomeDashboard ... />`, junto a `onOpenAdmin={() => setCurrentScreen('admin')}`, agrega:

```tsx
        onOpenCatalog={() => setCurrentScreen('catalogo')}
```

## PROHIBIDO

- NO modificar `CatalogScreen.tsx` (ya funciona).
- NO cambiar el resto de la navegación, el tipo `Screen`, ni `handleLayoutNavigate` de `App.tsx`.
- NO tocar Docling / n8n / extracción / dropzone / Salesforce / `job_lines` / catálogo.
- Solo las 4 ediciones de arriba, en `HomeDashboard.tsx` y `App.tsx`.
