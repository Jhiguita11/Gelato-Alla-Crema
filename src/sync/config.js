/**
 * Conexión con Supabase para compartir pedidos entre celulares.
 *
 * La URL y la clave pública (anon / publishable) están hechas para ir dentro de
 * la app: son públicas. Lo que protege los datos son las reglas de la base
 * (ver supabase/migrations): solo el usuario del local, que entra con el PIN,
 * puede leer o escribir. NUNCA poner aquí la clave service_role.
 *
 * Si están vacías, la app funciona en modo local (cada celular por su lado),
 * como antes.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * El "usuario" del local. El PIN es su contraseña. Tiene que coincidir con el
 * que revisa la base de datos en `es_local()`.
 */
export const EMAIL_LOCAL = 'local@gelatoallacrema.app'

export const MODO_COMPARTIDO = Boolean(SUPABASE_URL && SUPABASE_KEY)
