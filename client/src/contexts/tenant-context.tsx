import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface TenantContextType {
  selectedTenant: string;
  setSelectedTenant: (tenantId: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [selectedTenant, setSelectedTenantState] = useState<string>(() => {
    // Load from localStorage on initialization
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTenant') || '';
    }
    return '';
  });

  const setSelectedTenant = (tenantId: string) => {
    setSelectedTenantState(tenantId);
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedTenant', tenantId);
    }
  };

  return (
    <TenantContext.Provider value={{ selectedTenant, setSelectedTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}