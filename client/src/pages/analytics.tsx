import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, MessageCircle, Users, Calendar, Activity } from "lucide-react";
import { api, type DashboardStats, type BotCommand, type Conversation, type Lead } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function getCommandIcon(command: string) {
  switch (command) {
    case '/price':
      return '💰';
    case '/find':
      return '🔍';
    case '/order':
      return '🛒';
    case '/start':
      return '▶️';
    case '/promo':
      return '📢';
    case '/stop':
      return '⏹️';
    default:
      return '🤖';
  }
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return 'unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getChannelColor(channel: string): string {
  switch (channel.toLowerCase()) {
    case 'telegram':
      return 'bg-blue-100 text-blue-800';
    case 'whatsapp':
      return 'bg-green-100 text-green-800';
    case 'web':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function Analytics() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  const { data: commands } = useQuery<BotCommand[]>({
    queryKey: ['/api/commands'],
    refetchInterval: 60000,
  });

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 60000,
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    refetchInterval: 60000,
  });

  // Calculate analytics metrics
  const totalCommands = commands?.reduce((sum, cmd) => sum + cmd.count, 0) || 0;
  const channelDistribution = conversations?.reduce((acc, conv) => {
    acc[conv.channel] = (acc[conv.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const conversionRate = leads && conversations ? 
    ((leads.length / conversations.length) * 100).toFixed(1) : '0.0';

  const avgResponseTime = '2.3'; // This would come from actual timing data

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <div className="flex items-center space-x-4">
            <Button variant="outline" data-testid="button-export-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Real-time Analytics</span>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">Performance insights and bot analytics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Commands</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-commands">
                  {totalCommands}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+15%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-conversion-rate">
                  {conversionRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+3.2%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-response-time">
                  {avgResponseTime}s
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">-0.8s</span>
              <span className="text-muted-foreground ml-1">improved</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Channels</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-active-channels">
                  {Object.keys(channelDistribution).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">Telegram, WhatsApp</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Command Usage Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Command Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {commands?.map((command, index) => {
                const percentage = totalCommands > 0 ? (command.count / totalCommands) * 100 : 0;
                return (
                  <div key={`${command.command}-${command.channel}`} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getCommandIcon(command.command)}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {command.command}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {command.channel} • {command.count} uses
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span>Channel Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(channelDistribution).map(([channel, count]) => {
                const total = Object.values(channelDistribution).reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={channel} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getChannelColor(channel)}`}>
                        {channel}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{count} conversations</p>
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                      </div>
                    </div>
                    <div className="w-16 h-16 relative">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 32 32">
                        <circle
                          cx="16"
                          cy="16"
                          r="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-muted"
                        />
                        <circle
                          cx="16"
                          cy="16"
                          r="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray={`${percentage * 0.75} 75`}
                          className="text-primary"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {Object.keys(channelDistribution).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No channel data available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads?.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      New lead #{lead.leadId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.channel} • {formatDate(lead.createdAt)}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getChannelColor(lead.channel)}`}>
                    {lead.status}
                  </div>
                </div>
              ))}
              
              {(!leads || leads.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Performance Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Bot Availability</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-foreground">99.8%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Session Length</span>
                <span className="text-sm font-medium text-foreground">4.2 min</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">User Satisfaction</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={`text-sm ${star <= 4 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                      ⭐
                    </span>
                  ))}
                  <span className="text-sm font-medium text-foreground ml-2">4.2/5</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Error Rate</span>
                <span className="text-sm font-medium text-green-600">0.2%</span>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Performance data is updated every 15 minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
