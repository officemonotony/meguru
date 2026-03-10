export const projectId = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || ''
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
