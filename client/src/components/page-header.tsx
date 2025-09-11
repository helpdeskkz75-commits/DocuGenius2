import { TenantSelector } from "./tenant-selector";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  showTenantSelector?: boolean;
  selectedTenant?: string;
  onTenantChange?: (tenantId: string) => void;
}

export function PageHeader({
  title,
  description,
  children,
  showTenantSelector = true,
  selectedTenant,
  onTenantChange,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground truncate">
                {description}
              </p>
            )}
          </div>
          
          {showTenantSelector && (
            <div className="flex items-center space-x-4 ml-4">
              <TenantSelector
                value={selectedTenant}
                onValueChange={onTenantChange}
                className="hidden sm:flex"
              />
              {children}
            </div>
          )}
          
          {!showTenantSelector && children && (
            <div className="flex items-center space-x-4 ml-4">
              {children}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile tenant selector */}
      {showTenantSelector && (
        <div className="px-6 pb-4 sm:hidden">
          <TenantSelector
            value={selectedTenant}
            onValueChange={onTenantChange}
          />
        </div>
      )}
    </div>
  );
}