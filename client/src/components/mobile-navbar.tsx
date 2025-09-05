import { useState } from "react";
import { Menu, X, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Package,
  QrCode,
  BarChart3,
  Settings,
  TestTube,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Conversations", href: "/conversations", icon: MessageCircle },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Catalog", href: "/catalog", icon: Package },
  { name: "Payments", href: "/payments", icon: QrCode },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "ИИ Конфигурация", href: "/ai-config", icon: Bot },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Test", href: "/test", icon: TestTube },
];

export function MobileNavbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden bg-card border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">DocuGenius</h1>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-border">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <Bot className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">
                      DocuGenius
                    </h1>
                    <p className="text-sm text-muted-foreground">AI Bot Management</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}