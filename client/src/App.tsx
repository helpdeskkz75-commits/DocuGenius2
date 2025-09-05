import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import Conversations from "@/pages/conversations";
import Leads from "@/pages/leads";
import Catalog from "@/pages/catalog";
import Payments from "@/pages/payments";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import TestPage from "@/pages/test";
import NotFound from "@/pages/not-found";
import AiConfigPage from "@/pages/ai-config";

function Router() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/leads" component={Leads} />
        <Route path="/catalog" component={Catalog} />
        <Route path="/payments" component={Payments} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
        <Route path="/test" component={TestPage} />
        <Route path="/ai-config" component={AiConfigPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
