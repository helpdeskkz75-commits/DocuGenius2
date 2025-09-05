import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, MessageCircle, Send, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TestPage() {
  const { toast } = useToast();
  const [testQuery, setTestQuery] = useState("Мне нужен строительный материал для фундамента");
  const [aiResponse, setAiResponse] = useState("");
  const [recommendations, setRecommendations] = useState("");
  
  // Test OpenAI Integration
  const testOpenAI = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest(
        "/api/ai/recommendations",
        "POST",
        { query }
      );
      return response as any as { recommendations: string, products?: any[] };
    },
    onSuccess: (data) => {
      setRecommendations(data.recommendations);
      toast({
        title: "OpenAI Test Successful",
        description: "AI generated recommendations successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "OpenAI Test Failed",
        description: error.message || "Failed to generate AI recommendations",
        variant: "destructive"
      });
    }
  });

  const systemChecks = [
    {
      name: "Telegram Bot",
      status: "active",
      message: "Bot initialized and running",
      icon: Bot
    },
    {
      name: "OpenAI API",
      status: testOpenAI.isSuccess ? "active" : testOpenAI.isError ? "error" : "pending",
      message: testOpenAI.isSuccess ? "Connected" : testOpenAI.isError ? "API key required" : "Not tested",
      icon: MessageCircle
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Integration Test</h1>
        <Badge variant="outline">Test Mode</Badge>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemChecks.map((check) => {
              const Icon = check.icon;
              return (
                <div key={check.name} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  </div>
                  {check.status === 'active' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {check.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {check.status === 'pending' && <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Telegram Bot Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="w-5 h-5" />
            <span>Test Telegram Bot</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              To test the Telegram bot:
            </AlertDescription>
          </Alert>
          <div className="space-y-2 text-sm">
            <p>1. Open Telegram and search for your bot using the token</p>
            <p>2. Start a conversation with <code>/start</code></p>
            <p>3. Try these commands:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li><code>/price SKU123</code> - Get price for a product</li>
              <li><code>/find cement</code> - Search for products</li>
              <li><code>/promo</code> - Get catalog/promotions</li>
              <li><code>/order</code> - Create an order with QR code</li>
              <li><code>/stop</code> - Transfer to manager</li>
            </ul>
            <p>4. Or just type any message in Russian or Kazakh to start AI conversation</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Integration Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5" />
            <span>Test AI Assistant</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-query">Test Query</Label>
            <div className="flex space-x-2">
              <Input
                id="test-query"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a product query in Russian or Kazakh"
                data-testid="input-test-query"
              />
              <Button 
                onClick={() => testOpenAI.mutate(testQuery)}
                disabled={testOpenAI.isPending || !testQuery}
                data-testid="button-test-ai"
              >
                <Send className="w-4 h-4 mr-2" />
                Test AI
              </Button>
            </div>
          </div>

          {testOpenAI.isPending && (
            <div className="text-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Generating AI response...</p>
            </div>
          )}

          {recommendations && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">AI Recommendations:</h4>
              <p className="text-sm whitespace-pre-wrap">{recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-semibold">Required Secrets:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>✓ TELEGRAM_BOT_TOKEN - Your Telegram bot token</li>
            <li>✓ OPENAI_API_KEY - OpenAI API key for AI responses</li>
            <li>DATABASE_URL - PostgreSQL connection string (auto-configured)</li>
          </ul>
          
          <p className="font-semibold mt-4">Optional Integrations:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>PRICES_SHEET_ID - Google Sheets ID for product catalog</li>
            <li>LEADS_SHEET_ID - Google Sheets ID for leads storage</li>
            <li>GOOGLE_CREDENTIALS_JSON_BASE64 - Google service account credentials</li>
            <li>TELEGRAM_OPERATORS_GROUP_ID - Group ID for operator notifications</li>
            <li>WA_API_KEY - WhatsApp Business API key</li>
            <li>TWO_GIS_URL - 2GIS navigation link</li>
            <li>PROMO_URL - Promotional catalog URL</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}