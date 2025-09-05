export interface WAClient {
  sendText(to: string, text: string): Promise<void>;
}
