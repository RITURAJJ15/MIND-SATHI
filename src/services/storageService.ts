import { supabase } from '../lib/supabase';

export type StorageBucket = 'profile-photos' | 'family-photos' | 'game-assets' | 'cultural-content';

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: string | null;
}

class StorageService {
  /**
   * Upload an image file (e.g. from file input or canvas) to Supabase Storage.
   * File path pattern: `${userId}/${Date.now()}_${sanitizedFilename}`
   */
  public async uploadImage(
    bucket: StorageBucket,
    userId: string,
    file: File | Blob,
    fileName = 'image.jpg'
  ): Promise<UploadResult> {
    try {
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${userId}/${Date.now()}_${cleanFileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error(`[StorageService] Upload failed for ${bucket}:`, error.message);
        return { url: null, path: null, error: error.message };
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return {
        url: publicData.publicUrl,
        path: data.path,
        error: null,
      };
    } catch (err: any) {
      console.error('[StorageService] Unexpected error during upload:', err);
      return { url: null, path: null, error: err?.message || 'Upload failed' };
    }
  }

  /**
   * Delete an image from Supabase Storage by its bucket and path.
   */
  public async deleteImage(bucket: StorageBucket, path: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        console.warn(`[StorageService] Delete failed for ${path}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[StorageService] Delete error:', err);
      return false;
    }
  }

  /**
   * Compresses an image client-side to reasonable dimensions (max 600x600)
   * and returns an optimized Data URL for instant rendering and database persistence.
   */
  public async compressImage(file: File | Blob, maxWidth = 600, maxHeight = 600, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Handles photo upload with automatic compression and database compatibility:
   * 1. Compresses image client-side to lightweight JPEG data.
   * 2. Tries to upload to Supabase Storage if available.
   * 3. Gracefully falls back to the compressed Data URL which persists reliably in Supabase table.
   */
  public async processAndStorePhoto(
    bucket: StorageBucket,
    userId: string,
    file: File | Blob,
    fileName = 'photo.jpg'
  ): Promise<string> {
    try {
      const compressedDataUrl = await this.compressImage(file);

      // Attempt Supabase storage if userId is a valid UUID
      if (userId && userId.includes('-') && userId.length > 20) {
        try {
          const res = await this.uploadImage(bucket, userId, file, fileName);
          if (res.url) {
            return res.url;
          }
        } catch {
          // Fallback to compressedDataUrl
        }
      }

      return compressedDataUrl;
    } catch (err) {
      console.warn('[StorageService] Error processing photo:', err);
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string) || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80');
        r.onerror = () => resolve('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80');
        r.readAsDataURL(file);
      });
    }
  }
}

export const storageService = new StorageService();
