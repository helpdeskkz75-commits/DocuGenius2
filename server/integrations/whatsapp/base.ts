export interface WAClient {
  sendText(to: string, text: string): Promise<void>;
  getMediaUrl(mediaId: string): Promise<string | undefined>;
}
