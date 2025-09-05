import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, MessageSquare, Clock, User } from "lucide-react";
import { api, type Conversation } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function getChannelBadgeVariant(channel: string): "default" | "secondary" | "destructive" | "outline" {
  switch (channel.toLowerCase()) {
    case 'telegram':
      return 'default';
    case 'whatsapp':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'closed':
      return 'outline';
    default:
      return 'outline';
  }
}

function formatTimeAgo(date: Date | string | undefined): string {
  if (!date) return 'unknown';
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Conversations() {
  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Conversations</h2>
          <p className="text-muted-foreground">Bot interactions across all channels</p>
        </div>
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                  <div className="w-16 h-6 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Conversations</h2>
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {conversations?.length || 0} total conversations
            </span>
          </div>
        </div>
        <p className="text-muted-foreground">Bot interactions across all channels</p>
      </div>

      <div className="grid gap-4">
        {conversations?.length ? conversations.map((conversation) => (
          <Card key={conversation.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  {conversation.channel === 'whatsapp' ? (
                    <MessageSquare className="w-6 h-6 text-primary-foreground" />
                  ) : (
                    <Send className="w-6 h-6 text-primary-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {conversation.userName || conversation.userId || 'Anonymous'}
                      </h3>
                    </div>
                    <Badge variant={getChannelBadgeVariant(conversation.channel)} className="capitalize">
                      {conversation.channel}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(conversation.status)} className="capitalize">
                      {conversation.status}
                    </Badge>
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Chat ID:</strong> {conversation.chatId}
                    </p>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-foreground">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(conversation.updatedAt)}</span>
                  </div>
                  
                  <div className={`w-3 h-3 rounded-full ${
                    conversation.status === 'active' ? 'bg-green-500' : 
                    conversation.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}></div>
                  
                  <div className="text-xs text-muted-foreground">
                    Created: {formatTimeAgo(conversation.createdAt)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No conversations yet</h3>
              <p className="text-muted-foreground">
                When users start interacting with your bots, conversations will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
