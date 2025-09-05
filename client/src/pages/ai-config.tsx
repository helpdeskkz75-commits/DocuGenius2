import { useEffect, useState } from "react";
import { aiApi, type IndustryConfig, type IndustryStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AiConfigPage() {
  const [items, setItems] = useState<IndustryConfig[]>([]);
  const [stats, setStats] = useState<IndustryStats>({
    configured: 0,
    active: 0,
    totalUsers: 0,
  });
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<IndustryConfig | null>(null);
  const [prompt, setPrompt] = useState("");

  const load = async () => {
    const res = await aiApi.getIndustries();
    setItems(res.items);
    setStats(res.stats);
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (it: IndustryConfig) => {
    setCurrent(it);
    setPrompt(it.systemPrompt || "");
    setOpen(true);
  };

  const savePrompt = async () => {
    if (!current) return;
    await aiApi.updateIndustry(current.id, { systemPrompt: prompt });
    setOpen(false);
    setCurrent(null);
    await load();
  };

  const toggleActive = async (it: IndustryConfig) => {
    await aiApi.updateIndustry(it.id, { active: !it.active });
    await load();
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 w-full">
      <h1 className="text-2xl font-semibold">
        Настройка ИИ-помощника по отраслям
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">
            Настроенные отрасли
          </div>
          <div className="text-3xl font-bold mt-1">{stats.configured}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Активные отрасли</div>
          <div className="text-3xl font-bold mt-1">{stats.active}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">
            Общее количество пользователей
          </div>
          <div className="text-3xl font-bold mt-1">{stats.totalUsers}</div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border">
        <div className="p-4 border-b text-lg font-semibold">
          Конфигурация по отраслям
        </div>
        <div className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {it.usersCount} пользователей
                </div>
                {!it.systemPrompt?.trim() && (
                  <Badge variant="secondary" className="mt-2">
                    Требует настройки
                  </Badge>
                )}
              </div>

              <div className="sm:mr-6 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Активна</span>
                <Switch
                  checked={it.active}
                  onCheckedChange={() => toggleActive(it)}
                />
              </div>

              <Button onClick={() => openEditor(it)}>Настроить ИИ</Button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Настройка ИИ для отрасли: {current?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Системный промпт
            </div>
            <Textarea
              className="min-h-[280px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опиши правила общения, обязательные вопросы, юридические формулировки и т.д."
            />
            <div className="text-xs text-muted-foreground">
              Подсказка: фиксируй обязательные поля (стоимость, сроки,
              гарантии), профильную терминологию, национальные особенности (РК),
              проверку лицензий и т.п.
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={savePrompt}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
