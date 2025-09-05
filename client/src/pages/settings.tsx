import { useState } from "react";
import { Bot, MessageSquare, Database, Bell, Shield, Key, Globe, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Bot Configuration
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [autoResponses, setAutoResponses] = useState(true);
  const [languageDetection, setLanguageDetection] = useState(true);

  // API Settings
  const [telegramToken, setTelegramToken] = useState("****");
  const [whatsappApiKey, setWhatsappApiKey] = useState("****");
  const [googleCredentials, setGoogleCredentials] = useState("****");
  const [sheetsId, setSheetsId] = useState("");
  const [leadsSheetId, setLeadsSheetId] = useState("");

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webhookNotifications, setWebhookNotifications] = useState(false);
  const [leadNotifications, setLeadNotifications] = useState(true);
  const [errorNotifications, setErrorNotifications] = useState(true);

  // Business Settings
  const [companyName, setCompanyName] = useState("DocuGenius");
  const [supportEmail, setSupportEmail] = useState("support@docugenius.com");
  const [twoGisUrl, setTwoGisUrl] = useState("https://2gis.kz");
  const [promoUrl, setPromoUrl] = useState("https://example.com");
  const [currency, setCurrency] = useState("KZT");

  // Welcome Messages
  const [welcomeMessageRu, setWelcomeMessageRu] = useState(
    "Добро пожаловать! Я помогу вам найти нужные товары и оформить заказ."
  );
  const [welcomeMessageKz, setWelcomeMessageKz] = useState(
    "Қош келдіңіз! Мен сізге қажетті тауарларды табуға және тапсырысты ресімдеуге көмектесемін."
  );

  const handleSaveSettings = () => {
    // Here you would typically save to the backend
    toast({
      title: "Settings saved",
      description: "Your configuration has been updated successfully.",
    });
    setUnsavedChanges(false);
  };

  const handleInputChange = (setter: (value: any) => void) => (value: any) => {
    setter(value);
    setUnsavedChanges(true);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + "****" + key.substring(key.length - 4);
  };

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={handleSaveSettings} 
              disabled={!unsavedChanges}
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            {unsavedChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">Configure your bot settings and integrations</p>
      </div>

      <div className="grid gap-8">
        {/* Bot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <span>Bot Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Telegram Bot</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Telegram bot functionality
                  </p>
                </div>
                <Switch
                  checked={telegramEnabled}
                  onCheckedChange={handleInputChange(setTelegramEnabled)}
                  data-testid="switch-telegram-enabled"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">WhatsApp Bot</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable WhatsApp bot functionality
                  </p>
                </div>
                <Switch
                  checked={whatsappEnabled}
                  onCheckedChange={handleInputChange(setWhatsappEnabled)}
                  data-testid="switch-whatsapp-enabled"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto Responses</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatic responses for common queries
                  </p>
                </div>
                <Switch
                  checked={autoResponses}
                  onCheckedChange={handleInputChange(setAutoResponses)}
                  data-testid="switch-auto-responses"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Language Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatic Russian/Kazakh detection
                  </p>
                </div>
                <Switch
                  checked={languageDetection}
                  onCheckedChange={handleInputChange(setLanguageDetection)}
                  data-testid="switch-language-detection"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>API Credentials</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="telegram-token">Telegram Bot Token</Label>
                <Input
                  id="telegram-token"
                  type="password"
                  value={telegramToken}
                  onChange={(e) => handleInputChange(setTelegramToken)(e.target.value)}
                  placeholder="Enter Telegram bot token"
                  data-testid="input-telegram-token"
                />
                <p className="text-xs text-muted-foreground">
                  Get this from @BotFather on Telegram
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp-key">WhatsApp API Key</Label>
                <Input
                  id="whatsapp-key"
                  type="password"
                  value={whatsappApiKey}
                  onChange={(e) => handleInputChange(setWhatsappApiKey)(e.target.value)}
                  placeholder="Enter WhatsApp API key"
                  data-testid="input-whatsapp-key"
                />
                <p className="text-xs text-muted-foreground">
                  360Dialog API key
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google-credentials">Google Service Account</Label>
                <Textarea
                  id="google-credentials"
                  value={googleCredentials}
                  onChange={(e) => handleInputChange(setGoogleCredentials)(e.target.value)}
                  placeholder="Paste Google service account JSON"
                  rows={3}
                  data-testid="input-google-credentials"
                />
                <p className="text-xs text-muted-foreground">
                  Base64 encoded service account JSON
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sheets-id">Products Sheet ID</Label>
                  <Input
                    id="sheets-id"
                    value={sheetsId}
                    onChange={(e) => handleInputChange(setSheetsId)(e.target.value)}
                    placeholder="Google Sheets ID for products"
                    data-testid="input-sheets-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leads-sheet-id">Leads Sheet ID</Label>
                  <Input
                    id="leads-sheet-id"
                    value={leadsSheetId}
                    onChange={(e) => handleInputChange(setLeadsSheetId)(e.target.value)}
                    placeholder="Google Sheets ID for leads"
                    data-testid="input-leads-sheet-id"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="w-5 h-5" />
              <span>Business Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => handleInputChange(setCompanyName)(e.target.value)}
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-email">Support Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => handleInputChange(setSupportEmail)(e.target.value)}
                  data-testid="input-support-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twogis-url">2GIS Navigation URL</Label>
                <Input
                  id="twogis-url"
                  type="url"
                  value={twoGisUrl}
                  onChange={(e) => handleInputChange(setTwoGisUrl)(e.target.value)}
                  data-testid="input-twogis-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-url">Catalog/Promo URL</Label>
                <Input
                  id="promo-url"
                  type="url"
                  value={promoUrl}
                  onChange={(e) => handleInputChange(setPromoUrl)(e.target.value)}
                  data-testid="input-promo-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => handleInputChange(setCurrency)(e.target.value)}
                  placeholder="KZT"
                  data-testid="input-currency"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Welcome Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Welcome Messages</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="welcome-ru">Welcome Message (Russian)</Label>
              <Textarea
                id="welcome-ru"
                value={welcomeMessageRu}
                onChange={(e) => handleInputChange(setWelcomeMessageRu)(e.target.value)}
                rows={3}
                data-testid="textarea-welcome-ru"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcome-kz">Welcome Message (Kazakh)</Label>
              <Textarea
                id="welcome-kz"
                value={welcomeMessageKz}
                onChange={(e) => handleInputChange(setWelcomeMessageKz)(e.target.value)}
                rows={3}
                data-testid="textarea-welcome-kz"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive important updates via email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={handleInputChange(setEmailNotifications)}
                  data-testid="switch-email-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Webhook Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications to external webhooks
                  </p>
                </div>
                <Switch
                  checked={webhookNotifications}
                  onCheckedChange={handleInputChange(setWebhookNotifications)}
                  data-testid="switch-webhook-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">New Lead Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about new leads
                  </p>
                </div>
                <Switch
                  checked={leadNotifications}
                  onCheckedChange={handleInputChange(setLeadNotifications)}
                  data-testid="switch-lead-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Error Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about system errors
                  </p>
                </div>
                <Switch
                  checked={errorNotifications}
                  onCheckedChange={handleInputChange(setErrorNotifications)}
                  data-testid="switch-error-notifications"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>System Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="text-sm text-muted-foreground">Application Version</Label>
                <p className="text-lg font-medium text-foreground">v2.1.0</p>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Last Backup</Label>
                <p className="text-lg font-medium text-foreground">2 hours ago</p>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Uptime</Label>
                <p className="text-lg font-medium text-foreground">7 days, 14 hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
