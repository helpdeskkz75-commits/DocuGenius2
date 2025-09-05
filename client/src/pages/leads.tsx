import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, Phone, User, Package, DollarSign } from "lucide-react";
import { api, type Lead } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case 'new':
      return 'default';
    case 'paid':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getChannelBadgeVariant(channel: string): "default" | "secondary" | "destructive" | "outline" {
  switch (channel.toLowerCase()) {
    case 'telegram':
      return 'default';
    case 'whatsapp':
      return 'secondary';
    case 'web':
      return 'outline';
    default:
      return 'outline';
  }
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return 'unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Leads() {
  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-muted-foreground">Customer leads and orders</p>
        </div>
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                  <div className="w-20 h-6 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  const totalLeads = leads?.length || 0;
  const newLeads = leads?.filter(l => l.status === 'NEW').length || 0;
  const paidLeads = leads?.filter(l => l.status === 'PAID').length || 0;
  const totalRevenue = leads?.filter(l => l.status === 'PAID').reduce((sum, l) => sum + (l.sum || 0), 0) || 0;

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {totalLeads} total leads
            </span>
          </div>
        </div>
        <p className="text-muted-foreground">Customer leads and orders from all channels</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-xl font-bold text-foreground">{totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-xl font-bold text-foreground">{newLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-foreground">{paidLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold text-foreground">{totalRevenue} KZT</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads List */}
      <div className="grid gap-4">
        {leads?.length ? leads.map((lead) => (
          <Card key={lead.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      Lead #{lead.leadId}
                    </h3>
                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                      {lead.status}
                    </Badge>
                    <Badge variant={getChannelBadgeVariant(lead.channel)} className="capitalize">
                      {lead.channel}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="text-sm font-medium text-foreground">
                          {lead.name || 'No name provided'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium text-foreground">
                          {lead.phone || 'No phone provided'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="text-sm font-medium text-foreground">
                          {lead.sum || 0} KZT
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {lead.items && Array.isArray(lead.items) && lead.items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Items:</p>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <pre className="text-sm text-foreground whitespace-pre-wrap">
                          {JSON.stringify(lead.items, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-2">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(lead.createdAt)}</span>
                  </div>
                  
                  <div className={`w-3 h-3 rounded-full ${
                    lead.status === 'NEW' ? 'bg-blue-500' : 
                    lead.status === 'PAID' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No leads yet</h3>
              <p className="text-muted-foreground">
                When customers create orders through your bots, leads will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
