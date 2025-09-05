import { useQuery } from "@tanstack/react-query";
import { RefreshCw, MessageCircle, UserPlus, ShoppingCart, Zap, Terminal, Search, Play, Send, MessageSquare, Database, QrCode, Radio, FilePlus, Download } from "lucide-react";
import { api, type DashboardStats, type Conversation, type BotCommand, type SystemStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
    case 'online':
    case 'connected':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
    case 'offline':
      return 'bg-gray-100 text-gray-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getChannelBadgeClass(channel: string) {
  switch (channel.toLowerCase()) {
    case 'telegram':
      return 'bg-blue-100 text-blue-800';
    case 'whatsapp':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
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

export default function Dashboard() {
  const { data: stats, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 30000,
  });

  const { data: commands } = useQuery<BotCommand[]>({
    queryKey: ['/api/commands'],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: systemStatus } = useQuery<SystemStatus[]>({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000,
  });

  const handleRefresh = () => {
    refetchStats();
  };

  return (
    <main className="flex-1 ml-64 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Bot Dashboard</h2>
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">System Online</span>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">Monitor and manage your AI-powered Telegram and WhatsApp bots</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Conversations</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-conversations">
                  {stats?.activeConversations ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+12%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Leads</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-leads">
                  {stats?.newLeads ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+24%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Orders Today</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-orders">
                  {stats?.ordersToday ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+8%</span>
              <span className="text-muted-foreground ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-response-rate">
                  {stats?.responseRate ?? 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+2.1%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Conversations */}
        <Card>
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Recent Conversations</h3>
            <p className="text-sm text-muted-foreground">Latest bot interactions across channels</p>
          </div>
          <CardContent className="p-6">
            <div className="space-y-4">
              {conversations?.length ? conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center space-x-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  data-testid={`conversation-${conversation.id}`}
                >
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    {conversation.channel === 'whatsapp' ? (
                      <MessageSquare className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <Send className="w-5 h-5 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-foreground">
                        {conversation.userName || conversation.userId || 'Anonymous'}
                      </p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getChannelBadgeClass(conversation.channel)}`}>
                        {conversation.channel}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(conversation.updatedAt)}
                    </p>
                    <div className={`w-2 h-2 rounded-full ml-auto mt-1 ${
                      conversation.status === 'active' ? 'bg-green-500' : 
                      conversation.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}></div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No conversations yet
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-border">
              <Button variant="ghost" className="w-full" data-testid="button-view-all-conversations">
                View All Conversations
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bot Commands & Analytics */}
        <div className="space-y-6">
          {/* Command Usage */}
          <Card>
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Popular Commands</h3>
              <p className="text-sm text-muted-foreground">Most used bot commands today</p>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                {commands?.length ? commands.map((command) => {
                  const maxCount = Math.max(...(commands?.map(c => c.count) || [1]));
                  const percentage = (command.count / maxCount) * 100;
                  
                  const getCommandIcon = (cmd: string) => {
                    switch (cmd) {
                      case '/price': return Terminal;
                      case '/find': return Search;
                      case '/order': return ShoppingCart;
                      case '/start': return Play;
                      default: return Terminal;
                    }
                  };
                  
                  const getCommandColor = (cmd: string) => {
                    switch (cmd) {
                      case '/price': return 'text-primary';
                      case '/find': return 'text-green-600';
                      case '/order': return 'text-orange-600';
                      case '/start': return 'text-purple-600';
                      default: return 'text-primary';
                    }
                  };
                  
                  const Icon = getCommandIcon(command.command);
                  
                  return (
                    <div key={`${command.command}-${command.channel}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Icon className={`w-4 h-4 ${getCommandColor(command.command)}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{command.command}</p>
                          <p className="text-xs text-muted-foreground capitalize">{command.channel}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{command.count}</p>
                        <div className="w-16 h-2 bg-muted rounded-full mt-1">
                          <div 
                            className={`h-2 rounded-full ${getCommandColor(command.command).replace('text-', 'bg-')}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No command usage data yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">System Status</h3>
              <p className="text-sm text-muted-foreground">Current bot service health</p>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                {systemStatus?.map((service) => {
                  const getServiceIcon = (name: string) => {
                    if (name.includes('Telegram')) return Send;
                    if (name.includes('WhatsApp')) return MessageSquare;
                    if (name.includes('Google')) return Database;
                    if (name.includes('Payment')) return QrCode;
                    return Database;
                  };
                  
                  const Icon = getServiceIcon(service.serviceName);
                  
                  return (
                    <div key={service.serviceName} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Icon className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{service.serviceName}</p>
                          <p className="text-xs text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeClass(service.status)}`}>
                        {service.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">Common administrative tasks</p>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="flex items-center space-x-3 p-4 h-auto justify-start" data-testid="button-broadcast">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Send Radio</p>
                <p className="text-xs text-muted-foreground">Mass message to users</p>
              </div>
            </Button>

            <Button variant="outline" className="flex items-center space-x-3 p-4 h-auto justify-start" data-testid="button-add-product">
              <div className="w-10 h-10 bg-green-600/10 rounded-lg flex items-center justify-center">
                <FilePlus className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Add Product</p>
                <p className="text-xs text-muted-foreground">Update catalog</p>
              </div>
            </Button>

            <Button variant="outline" className="flex items-center space-x-3 p-4 h-auto justify-start" data-testid="button-export-data">
              <div className="w-10 h-10 bg-orange-600/10 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Export Data</p>
                <p className="text-xs text-muted-foreground">Download reports</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
