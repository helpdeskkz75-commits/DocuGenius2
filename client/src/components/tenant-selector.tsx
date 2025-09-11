import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  key: string;
  title: string;
  active: boolean;
}

interface TenantSelectorProps {
  value?: string;
  onValueChange?: (tenantId: string) => void;
  className?: string;
}

export function TenantSelector({ value, onValueChange, className }: TenantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants'],
    refetchInterval: 60000, // Refresh every minute
  });

  const activeTenants = tenants?.filter(t => t.active) || [];
  const currentTenant = activeTenants.find(t => t.id === (value || selectedTenant));

  useEffect(() => {
    // Auto-select first active tenant if none selected
    if (!value && !selectedTenant && activeTenants.length > 0) {
      const firstTenant = activeTenants[0];
      setSelectedTenant(firstTenant.id);
      onValueChange?.(firstTenant.id);
    }
  }, [activeTenants, value, selectedTenant, onValueChange]);

  const handleSelect = (tenantId: string) => {
    setSelectedTenant(tenantId);
    onValueChange?.(tenantId);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (activeTenants.length === 0) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Нет активных тенантов</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
            data-testid="tenant-selector"
          >
            {currentTenant ? (
              <div className="flex items-center space-x-2">
                <span>{currentTenant.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {currentTenant.key}
                </Badge>
              </div>
            ) : (
              "Выберите тенанта..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Поиск тенанта..." />
            <CommandEmpty>Тенант не найден.</CommandEmpty>
            <CommandGroup>
              {activeTenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.id}
                  onSelect={handleSelect}
                  data-testid={`tenant-option-${tenant.key}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      (value || selectedTenant) === tenant.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{tenant.title}</span>
                    <span className="text-xs text-muted-foreground">{tenant.key}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}