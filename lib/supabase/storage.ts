import { supabase } from './client';

export async function uploadAvatar(file: File, playerId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${playerId}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('player-avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('player-avatars')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

export async function deleteAvatar(playerId: string) {
  try {
    const { error } = await supabase.storage
      .from('player-avatars')
      .remove([`${playerId}.jpg`, `${playerId}.png`, `${playerId}.jpeg`]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting avatar:', error);
    throw error;
  }
}