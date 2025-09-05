import { useQuery } from "@tanstack/react-query";
import { QrCode, CreditCard, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { api, type Lead } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getPaymentStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'paid':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'cancelled':
      return <XCircle className="w-5 h-5 text-red-600" />;
    default:
      return <Clock className="w-5 h-5 text-yellow-600" />;
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
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

export default function Payments() {
  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter leads that have payment amounts (orders)
  const paymentLeads = leads?.filter(lead => lead.sum && lead.sum > 0) || [];
  
  if (isLoading) {
    return (
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Payments</h2>
          <p className="text-muted-foreground">QR code payments and order tracking</p>
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

  const totalPayments = paymentLeads.length;
  const paidPayments = paymentLeads.filter(l => l.status === 'PAID').length;
  const pendingPayments = paymentLeads.filter(l => l.status === 'NEW').length;
  const totalRevenue = paymentLeads.filter(l => l.status === 'PAID').reduce((sum, l) => sum + (l.sum || 0), 0);

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Payments</h2>
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {totalPayments} payment orders
            </span>
          </div>
        </div>
        <p className="text-muted-foreground">QR code payments and order tracking</p>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold text-foreground">{totalPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-foreground">{paidPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-foreground">{pendingPayments}</p>
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

      {/* Payment List */}
      <div className="grid gap-4">
        {paymentLeads.length ? paymentLeads.map((payment) => (
          <Card key={payment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  {getPaymentStatusIcon(payment.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      Payment #{payment.leadId}
                    </h3>
                    <Badge variant={getStatusBadgeVariant(payment.status)}>
                      {payment.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {payment.channel}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="text-sm font-medium text-foreground">
                        {payment.name || 'No name provided'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-lg font-bold text-foreground">
                        {payment.sum} KZT
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(payment.createdAt)}
                      </p>
                    </div>
                  </div>

                  {payment.phone && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">Phone: {payment.phone}</p>
                    </div>
                  )}

                  {payment.items && Array.isArray(payment.items) && payment.items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Order Items:</p>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <pre className="text-sm text-foreground whitespace-pre-wrap">
                          {JSON.stringify(payment.items, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2">
                  {payment.status === 'NEW' && (
                    <Button size="sm" variant="outline" data-testid={`button-generate-qr-${payment.id}`}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Generate QR
                    </Button>
                  )}
                  
                  <Button size="sm" variant="outline" data-testid={`button-view-payment-${payment.id}`}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-12 text-center">
              <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No payment orders yet</h3>
              <p className="text-muted-foreground">
                When customers create orders with payment amounts, they will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
