# Prompt para Bolt — Arreglar "Define tu contraseña" (no aparece en invitación/recuperación)

## Causa raíz (para contexto)

El cliente de Supabase tiene `detectSessionInUrl` activo: al cargar la página procesa el token de recuperación del hash de la URL y **borra el hash de inmediato**. La detección actual en `App.tsx` lee `window.location.hash` dentro de un `useEffect` (corre **después**, cuando el hash ya fue borrado) y el listener de `PASSWORD_RECOVERY` se registra **después** de que ese evento ya se disparó. Por eso `needsPasswordSet` nunca se vuelve `true` y la pantalla "Define tu contraseña" no aparece.

La solución es **capturar la intención de recuperación/invitación ANTES de crear el cliente**, leyendo la URL en `src/lib/supabase.ts` justo antes de `createClient` (ahí el hash todavía existe), y usar ese valor para inicializar el estado.

Son tres cambios exactos. No cambies nada más.

---

## Cambio 1 — `src/lib/supabase.ts` (reemplazar TODO el archivo por esto)

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Capturamos la intencion de invitacion/recuperacion ANTES de crear el cliente.
// createClient (detectSessionInUrl) procesa y LIMPIA el hash de la URL de
// inmediato; si lo leyeramos despues (en un useEffect) ya estaria borrado, y por
// eso la pantalla "Define tu contrasena" no aparecia.
export const isPasswordSetupRedirect =
  /type=(recovery|invite)/.test(window.location.hash) ||
  /type=(recovery|invite)/.test(window.location.search);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Cambio 2 — `src/App.tsx`, línea del import del cliente

Busca:
```ts
import { supabase } from './lib/supabase';
```
Reemplaza por:
```ts
import { supabase, isPasswordSetupRedirect } from './lib/supabase';
```

---

## Cambio 3 — `src/App.tsx`, inicializar el estado con ese valor

Busca:
```ts
  const [needsPasswordSet, setNeedsPasswordSet] = useState(false);
```
Reemplaza por:
```ts
  const [needsPasswordSet, setNeedsPasswordSet] = useState(isPasswordSetupRedirect);
```

> Deja intactos los dos `useEffect` que ya existen (el del hash y el de `PASSWORD_RECOVERY`): sirven como respaldo y no estorban.

---

## Cambio 4 — `src/App.tsx`, reordenar los early returns de auth

El orden actual rebota a `AuthScreen` antes de mostrar `SetPasswordScreen`, y cuando hay recuperación la sesión tarda un instante en llegar. Hay que checar `needsPasswordSet` **antes** que `!session`, y esperar a que la sesión esté lista.

Busca este bloque:
```tsx
  if (!auth.session) {
    return <AuthScreen />;
  }

  if (needsPasswordSet) {
    return (
      <SetPasswordScreen
        onDone={() => {
          setNeedsPasswordSet(false);
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }
```

Reemplázalo por (se invierte el orden y se agrega la espera de sesión):
```tsx
  // Flujo de invitacion/recuperacion: mostrar SetPasswordScreen en cuanto la
  // sesion del enlace este lista (sin rebotar a AuthScreen mientras llega).
  if (needsPasswordSet) {
    if (!auth.session) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3]">
          <div className="text-gray-500 font-medium">Cargando...</div>
        </div>
      );
    }
    return (
      <SetPasswordScreen
        onDone={() => {
          setNeedsPasswordSet(false);
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }

  if (!auth.session) {
    return <AuthScreen />;
  }
```

---

## PROHIBIDO (no tocar)

- NO cambiar `SetPasswordScreen.tsx` (ya está bien: valida y llama `supabase.auth.updateUser`).
- NO quitar los dos `useEffect` de detección existentes (quedan como respaldo).
- NO introducir react-router, no cambiar `flowType`, no agregar librerías.
- NO tocar el state machine, las pantallas del flujo, ni nada fuera de `supabase.ts` y la sección de auth de `App.tsx`.
