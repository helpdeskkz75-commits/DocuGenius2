import {
  Bot,
  LayoutDashboard,
  MessageCircle,
  Users,
  Package,
  QrCode,
  BarChart3,
  Settings,
  User,
  TestTube,
  Building2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/contexts/i18n-context";

const navigation = [
  { nameKey: "nav.dashboard", name: "Dashboard", href: "/", icon: LayoutDashboard },
  { nameKey: "nav.tenants", name: "Tenants", href: "/tenants", icon: Building2 },
  { nameKey: "nav.conversations", name: "Conversations", href: "/conversations", icon: MessageCircle },
  { nameKey: "nav.leads", name: "Leads", href: "/leads", icon: Users },
  { nameKey: "nav.catalog", name: "Catalog", href: "/catalog", icon: Package },
  { nameKey: "nav.payments", name: "Payments", href: "/payments", icon: QrCode },
  { nameKey: "nav.analytics", name: "Analytics", href: "/analytics", icon: BarChart3 },
  { nameKey: "nav.test", name: "Test", href: "/test", icon: TestTube },
];

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-sm z-30 hidden lg:flex">
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
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.nameKey ? t(item.nameKey) : item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  Admin User
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  admin@example.com
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </aside>
  );
}
