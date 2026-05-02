import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper to upload a base64 dataUrl as a file in the storage bucket
export async function uploadPhotoFromDataUrl(dataUrl, prefix = 'foto') {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('fotos').upload(filename, blob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: blob.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('fotos').getPublicUrl(filename);
  return data.publicUrl;
}

export async function deletePhotoByUrl(url) {
  if (!url) return;
  try {
    const path = url.split('/fotos/')[1];
    if (path) await supabase.storage.from('fotos').remove([path]);
  } catch (e) {
    console.warn('Failed to delete photo from storage', e);
  }
}
