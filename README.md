# Cotizador — Dashboard Frontend

## Arquitectura

Stack:

- **React 18** + **TypeScript**
- **Vite** como bundler / dev server
- **TailwindCSS** para estilos utilitarios y sistema de diseño
- **lucide-react** para iconografía
- **react-router-dom v6** para enrutamiento cliente
- **@supabase/supabase-js** para persistencia y autenticación

## Estructura

```
src/
├── components/dashboard/   → componentes del tablero (Hero, KPIs, paneles, tabla)
│   └── skeletons/          → siluetas de carga reutilizables
├── hooks/                  → custom hooks de datos (useDashboard, useQuotes…)
├── services/               → capa de llamadas a backend (dashboardService)
├── types/                  → interfaces TypeScript (Quote, Dashboard, User)
├── data/                   → mocks (eliminar al conectar backend)
├── lib/                    → utilidades y cliente de Supabase
└── components/             → resto de pantallas del flujo (upload, review, etc.)
```

## Endpoints a implementar en el backend

| Mock                | Método | Endpoint                                   |
| ------------------- | ------ | ------------------------------------------ |
| `getCurrentUser`    | GET    | `/api/v1/users/me`                         |
| `getDashboardData`  | GET    | `/api/v1/dashboard?range={7d\|30d\|90d}`   |
| `getRecentQuotes`   | GET    | `/api/v1/quotes?status={status}&limit={n}` |
| (subir archivo)     | POST   | `/api/v1/quotes/upload` (multipart)        |

## Sustituir mocks por API real

1. Crear un `.env` con `VITE_API_URL=https://api.example.com`.
2. En `src/services/dashboardService.ts`, reemplazar el cuerpo de cada función por un `fetch` a `${import.meta.env.VITE_API_URL}` + el endpoint correspondiente.
3. Manejar errores HTTP (401/403/500) y propagarlos como `Error` para que los hooks los expongan.
4. Eliminar `src/data/mockQuotes.ts` cuando el backend esté listo.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```
