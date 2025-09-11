import { uploadFile, createFolder } from "../integrations/google/drive";
import { storage } from "../storage";
import fs from "fs";
import path from "path";

interface MediaUploadResult {
  driveUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
  error?: string;
}

interface MediaMetadata {
  description?: string;
  tenantKey: string;
  chatId: string;
  lang: "ru" | "kk";
  timestamp: string;
  mediaType: "voice" | "audio" | "image" | "document";
  analysis?: string; // For images
  transcription?: string; // For voice/audio
}

/**
 * Enhanced media storage service that saves processed files to tenant-specific Google Drive folders
 */
export class MediaStorageService {
  /**
   * Check if Google Drive integration is available
   */
  static isGoogleDriveAvailable(): boolean {
    return !!process.env.GOOGLE_CREDENTIALS_JSON_BASE64;
  }

  /**
   * Get a descriptive error message for Google Drive unavailability
   */
  static getGoogleDriveUnavailableMessage(): string {
    return "Google Drive integration not configured - GOOGLE_CREDENTIALS_JSON_BASE64 environment variable is missing";
  }
  /**
   * Get subfolder ID for a specific media type
   */
  static async getSubfolderId(tenantKey: string, mediaType: "voice" | "audio" | "image" | "document"): Promise<string | null> {
    try {
      const tenant = await storage.getTenantByKey(tenantKey);
      if (!tenant || !tenant.gdriveFolderId) {
        return null;
      }

      const folderNameMap = {
        voice: "voice",
        audio: "audio", 
        image: "images",
        document: "documents"
      };

      // For now, we'll create the subfolder if it doesn't exist
      // In a production system, you'd want to cache these folder IDs
      const subfolderName = folderNameMap[mediaType];
      const subfolderId = await createFolder(subfolderName, tenant.gdriveFolderId);
      
      return subfolderId;
    } catch (error) {
      console.error(`[MediaStorage] Error getting subfolder for ${mediaType}:`, error);
      return null;
    }
  }

  /**
   * Upload media file to tenant's Google Drive folder with metadata and subfolder support
   */
  static async uploadToTenantFolder(
    tenantKey: string,
    fileName: string,
    filePath: string,
    mimeType: string,
    makePublic: boolean = false,
    mediaMetadata?: MediaMetadata
  ): Promise<MediaUploadResult> {
    try {
      // Check if Google Drive is available
      if (!this.isGoogleDriveAvailable()) {
        console.debug(`[MediaStorage] ${this.getGoogleDriveUnavailableMessage()}`);
        return {
          fileName,
          mimeType,
          size: 0,
          error: this.getGoogleDriveUnavailableMessage()
        };
      }

      // Get tenant configuration
      const tenant = await storage.getTenantByKey(tenantKey);
      if (!tenant) {
        return {
          fileName,
          mimeType,
          size: 0,
          error: "Tenant not found"
        };
      }

      // Get file size
      const stats = await fs.promises.stat(filePath);
      const size = stats.size;

      // Ensure tenant has Google Drive folder
      let folderId = tenant.gdriveFolderId;
      if (!folderId) {
        console.log(`[MediaStorage] Creating Google Drive folder for tenant: ${tenantKey}`);
        folderId = await this.createTenantFolder(tenantKey, tenant.title) || undefined;
        if (!folderId) {
          return {
            fileName,
            mimeType,
            size,
            error: "Failed to create tenant folder"
          };
        }
      }

      // Get subfolder ID if media type is specified
      let targetFolderId = folderId;
      if (mediaMetadata?.mediaType) {
        const subfolderId = await this.getSubfolderId(tenantKey, mediaMetadata.mediaType);
        if (subfolderId) {
          targetFolderId = subfolderId;
        }
      }

      // Prepare Google Drive metadata
      const driveMetadata: any = {};
      if (mediaMetadata) {
        // Set description
        driveMetadata.description = mediaMetadata.description || 
          (mediaMetadata.analysis ? `Analysis: ${mediaMetadata.analysis}` : 
           mediaMetadata.transcription ? `Transcription: ${mediaMetadata.transcription}` : 
           `Media file from ${mediaMetadata.tenantKey}`);

        // Set properties
        driveMetadata.properties = {
          tenantKey: mediaMetadata.tenantKey,
          chatId: mediaMetadata.chatId,
          lang: mediaMetadata.lang,
          timestamp: mediaMetadata.timestamp,
          mediaType: mediaMetadata.mediaType
        };

        if (mediaMetadata.analysis) {
          driveMetadata.properties.hasAnalysis = "true";
        }
        if (mediaMetadata.transcription) {
          driveMetadata.properties.hasTranscription = "true";
        }
      }

      // Upload file to Google Drive
      const driveUrl = await uploadFile(fileName, filePath, targetFolderId, mimeType, makePublic, driveMetadata);
      if (!driveUrl) {
        return {
          fileName,
          mimeType,
          size,
          error: "Failed to upload to Google Drive"
        };
      }

      console.log(`[MediaStorage] Successfully uploaded ${fileName} to ${mediaMetadata?.mediaType || 'main'} folder for tenant ${tenantKey}`);
      return {
        driveUrl,
        fileName,
        mimeType,
        size
      };

    } catch (error) {
      console.error(`[MediaStorage] Upload error for tenant ${tenantKey}:`, error);
      return {
        fileName,
        mimeType,
        size: 0,
        error: String(error)
      };
    }
  }

  /**
   * Create media subfolder structure for a tenant
   */
  static async createTenantFolder(tenantKey: string, tenantTitle: string): Promise<string | null> {
    try {
      // Create main tenant folder
      const folderName = `${tenantTitle} (${tenantKey})`;
      const mainFolderId = await createFolder(folderName);
      if (!mainFolderId) {
        console.error(`[MediaStorage] Failed to create main folder for tenant ${tenantKey}`);
        return null;
      }

      // Create subfolders for different media types
      const subfolders = ['images', 'voice', 'audio', 'documents'];
      for (const subfolder of subfolders) {
        await createFolder(subfolder, mainFolderId);
      }

      // Update tenant with folder ID
      await storage.updateTenant(tenantKey, { gdriveFolderId: mainFolderId || undefined });
      
      console.log(`[MediaStorage] Created folder structure for tenant ${tenantKey}: ${mainFolderId}`);
      return mainFolderId;

    } catch (error) {
      console.error(`[MediaStorage] Error creating tenant folder for ${tenantKey}:`, error);
      return null;
    }
  }

  /**
   * Upload voice/audio file after transcription
   */
  static async uploadVoiceFile(
    tenantKey: string,
    chatId: string,
    filePath: string,
    transcription: string,
    lang: "ru" | "kk"
  ): Promise<MediaUploadResult> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `voice_${chatId}_${timestamp}_${lang}.ogg`;
    
    const metadata: MediaMetadata = {
      description: `Voice message: ${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`,
      tenantKey,
      chatId,
      lang,
      timestamp,
      mediaType: "voice",
      transcription
    };
    
    return this.uploadToTenantFolder(
      tenantKey,
      fileName,
      filePath,
      "audio/ogg",
      false, // Keep voice messages private
      metadata
    );
  }

  /**
   * Upload image file after analysis
   */
  static async uploadImageFile(
    tenantKey: string,
    chatId: string,
    filePath: string,
    analysis: string,
    lang: "ru" | "kk"
  ): Promise<MediaUploadResult> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const ext = path.extname(filePath) || '.jpg';
    const fileName = `image_${chatId}_${timestamp}_${lang}${ext}`;
    
    const metadata: MediaMetadata = {
      description: `Image analysis: ${analysis.substring(0, 100)}${analysis.length > 100 ? '...' : ''}`,
      tenantKey,
      chatId,
      lang,
      timestamp,
      mediaType: "image",
      analysis
    };
    
    return this.uploadToTenantFolder(
      tenantKey,
      fileName,
      filePath,
      "image/jpeg",
      false, // Keep images private by default
      metadata
    );
  }

  /**
   * Clean up temporary file after upload
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
      console.log(`[MediaStorage] Cleaned up temp file: ${filePath}`);
    } catch (error) {
      console.warn(`[MediaStorage] Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  /**
   * Download and store media from URL (for WhatsApp)
   */
  static async downloadAndStore(
    tenantKey: string,
    chatId: string,
    mediaUrl: string,
    mediaType: "voice" | "audio" | "image",
    lang: "ru" | "kk" = "ru"
  ): Promise<{ localPath: string; fileName: string } | null> {
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        console.error(`[MediaStorage] Failed to download media: ${response.status}`);
        return null;
      }

      // Create temp directory
      const tempDir = path.join(process.cwd(), "temp");
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const ext = mediaType === "image" ? ".jpg" : ".ogg";
      const fileName = `${mediaType}_${chatId}_${timestamp}${ext}`;
      const localPath = path.join(tempDir, fileName);

      // Download file
      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(localPath, Buffer.from(buffer));

      console.log(`[MediaStorage] Downloaded media for tenant ${tenantKey}: ${fileName}`);
      return { localPath, fileName };

    } catch (error) {
      console.error(`[MediaStorage] Download error for tenant ${tenantKey}:`, error);
      return null;
    }
  }
}