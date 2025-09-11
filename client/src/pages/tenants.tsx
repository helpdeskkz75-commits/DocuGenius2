import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Settings, Users, Globe, Key, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Tenant {
  id: string;
  key: string;
  title: string;
  tgToken?: string;
  waApiKey?: string;
  waPhoneId?: string;
  pricesSheetId?: string;
  pricesRange?: string;
  leadsSheetId?: string;
  leadsRange?: string;
  callbacksSheetId?: string;
  callbacksRange?: string;
  gdriveFolderId?: string;
  texts?: Record<string, string>;
  active: boolean;
}

export default function TenantsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants'],
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Tenant>) => {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create tenant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Успешно",
        description: "Тенант создан",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать тенанта",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tenant> }) => {
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update tenant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      setIsEditDialogOpen(false);
      setSelectedTenant(null);
      toast({
        title: "Успешно",
        description: "Тенант обновлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить тенанта",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete tenant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "Успешно",
        description: "Тенант удален",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить тенанта",
        variant: "destructive",
      });
    },
  });

  const handleCreateTenant = (formData: FormData) => {
    const data = {
      key: formData.get('key') as string,
      title: formData.get('title') as string,
      tgToken: formData.get('tgToken') as string,
      waApiKey: formData.get('waApiKey') as string,
      waPhoneId: formData.get('waPhoneId') as string,
      pricesSheetId: formData.get('pricesSheetId') as string,
      pricesRange: formData.get('pricesRange') as string,
      gdriveFolderId: formData.get('gdriveFolderId') as string,
      active: true,
    };
    createMutation.mutate(data);
  };

  const handleUpdateTenant = (formData: FormData) => {
    if (!selectedTenant) return;
    
    const data = {
      title: formData.get('title') as string,
      tgToken: formData.get('tgToken') as string,
      waApiKey: formData.get('waApiKey') as string,
      waPhoneId: formData.get('waPhoneId') as string,
      pricesSheetId: formData.get('pricesSheetId') as string,
      pricesRange: formData.get('pricesRange') as string,
      gdriveFolderId: formData.get('gdriveFolderId') as string,
      active: formData.get('active') === 'on',
    };
    
    updateMutation.mutate({ id: selectedTenant.id, data });
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-6 w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Управление тенантами</h1>
          <p className="text-muted-foreground">
            Настройка и управление мульти-тенантными конфигурациями
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-tenant"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить тенанта
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего тенантов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants?.filter(t => t.active).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Telegram боты</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants?.filter(t => t.tgToken).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp боты</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants?.filter(t => t.waApiKey).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants?.map((tenant) => (
          <Card key={tenant.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{tenant.title}</CardTitle>
                {tenant.active ? (
                  <Badge variant="default">Активен</Badge>
                ) : (
                  <Badge variant="secondary">Неактивен</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Ключ: {tenant.key}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {tenant.tgToken && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Telegram настроен</span>
                  </div>
                )}
                {tenant.waApiKey && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">WhatsApp настроен</span>
                  </div>
                )}
                {tenant.pricesSheetId && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Каталог подключен</span>
                  </div>
                )}
                {tenant.gdriveFolderId && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Google Drive настроен</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(tenant)}
                  className="flex-1"
                  data-testid={`button-edit-${tenant.key}`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Настроить
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Удалить тенанта "${tenant.title}"?`)) {
                      deleteMutation.mutate(tenant.id);
                    }
                  }}
                  data-testid={`button-delete-${tenant.key}`}
                >
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Tenant Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleCreateTenant(new FormData(e.currentTarget)); }}>
            <DialogHeader>
              <DialogTitle>Создать нового тенанта</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Ключ тенанта *</Label>
                  <Input id="key" name="key" placeholder="company-name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Название *</Label>
                  <Input id="title" name="title" placeholder="Название компании" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tgToken">Telegram Bot Token</Label>
                <Input id="tgToken" name="tgToken" placeholder="1234567890:AAE..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="waApiKey">WhatsApp API Key</Label>
                  <Input id="waApiKey" name="waApiKey" placeholder="your-api-key" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waPhoneId">WhatsApp Phone ID</Label>
                  <Input id="waPhoneId" name="waPhoneId" placeholder="phone-number-id" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricesSheetId">Google Sheets ID (каталог)</Label>
                  <Input id="pricesSheetId" name="pricesSheetId" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricesRange">Диапазон каталога</Label>
                  <Input id="pricesRange" name="pricesRange" placeholder="Catalog!A:Z" defaultValue="Catalog!A:Z" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gdriveFolderId">Google Drive Folder ID</Label>
                <Input id="gdriveFolderId" name="gdriveFolderId" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTenant && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTenant(new FormData(e.currentTarget)); }}>
              <DialogHeader>
                <DialogTitle>Редактировать тенанта: {selectedTenant.title}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Название</Label>
                  <Input id="edit-title" name="title" defaultValue={selectedTenant.title} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tgToken">Telegram Bot Token</Label>
                  <Input id="edit-tgToken" name="tgToken" defaultValue={selectedTenant.tgToken || ""} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-waApiKey">WhatsApp API Key</Label>
                    <Input id="edit-waApiKey" name="waApiKey" defaultValue={selectedTenant.waApiKey || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-waPhoneId">WhatsApp Phone ID</Label>
                    <Input id="edit-waPhoneId" name="waPhoneId" defaultValue={selectedTenant.waPhoneId || ""} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-pricesSheetId">Google Sheets ID</Label>
                    <Input id="edit-pricesSheetId" name="pricesSheetId" defaultValue={selectedTenant.pricesSheetId || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pricesRange">Диапазон каталога</Label>
                    <Input id="edit-pricesRange" name="pricesRange" defaultValue={selectedTenant.pricesRange || "Catalog!A:Z"} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-gdriveFolderId">Google Drive Folder ID</Label>
                  <Input id="edit-gdriveFolderId" name="gdriveFolderId" defaultValue={selectedTenant.gdriveFolderId || ""} />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="edit-active" name="active" defaultChecked={selectedTenant.active} />
                  <Label htmlFor="edit-active">Активен</Label>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}