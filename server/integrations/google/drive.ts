import { google } from "googleapis";
import fs from "fs";
import path from "path";

function getDriveClient() {
  const credentialsB64 = process.env.GOOGLE_CREDENTIALS_JSON_BASE64;
  if (!credentialsB64) {
    console.log(
      "GOOGLE_CREDENTIALS_JSON_BASE64 not set, Google Drive integration disabled",
    );
    return null;
  }
  const json = JSON.parse(
    Buffer.from(credentialsB64, "base64").toString("utf-8"),
  );
  const scopes = ["https://www.googleapis.com/auth/drive"];
  const auth = new google.auth.GoogleAuth({ credentials: json, scopes });
  return google.drive({ version: "v3", auth });
}

export async function uploadFile(
  fileName: string,
  filePath: string,
  folderId?: string,
  mimeType?: string,
  makePublic?: boolean,
  metadata?: {
    description?: string;
    properties?: Record<string, string>;
  }
): Promise<string | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name: fileName,
    };
    
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    // Add metadata if provided
    if (metadata?.description) {
      fileMetadata.description = metadata.description;
    }
    if (metadata?.properties) {
      fileMetadata.properties = metadata.properties;
    }

    const media = {
      mimeType: mimeType || "application/pdf",
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) return null;

    // Only make file publicly accessible if explicitly requested
    if (makePublic) {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
      return `https://drive.google.com/file/d/${fileId}/view`;
    }

    // For private files, return a restricted access URL
    return `https://drive.google.com/file/d/${fileId}/view`;
  } catch (error) {
    console.error("Error uploading to Google Drive:", error);
    return null;
  }
}

export async function createFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    return response.data.id || null;
  } catch (error) {
    console.error("Error creating Google Drive folder:", error);
    return null;
  }
}