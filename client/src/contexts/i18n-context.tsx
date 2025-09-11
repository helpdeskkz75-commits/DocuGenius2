import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ru' | 'kk';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Translation strings
const translations = {
  ru: {
    // Navigation
    'nav.dashboard': 'Панель управления',
    'nav.tenants': 'Тенанты',
    'nav.conversations': 'Диалоги',
    'nav.leads': 'Лиды',
    'nav.analytics': 'Аналитика',
    'nav.catalog': 'Каталог',
    'nav.payments': 'Платежи',
    'nav.test': 'Тест',
    
    // Tenants page
    'tenants.title': 'Управление системой',
    'tenants.subtitle': 'Управление тенантами, настройками и конфигурацией ИИ',
    'tenants.createTenant': 'Создать тенанта',
    'tenants.tabs.tenants': 'Тенанты',
    'tenants.tabs.settings': 'Настройки',
    'tenants.tabs.aiConfig': 'Конфигурация ИИ',
    
    // Stats
    'stats.totalTenants': 'Всего тенантов',
    'stats.activeTenants': 'Активные',
    'stats.telegramBots': 'Telegram боты',
    'stats.whatsappBots': 'WhatsApp боты',
    
    // Status
    'status.active': 'Активен',
    'status.inactive': 'Неактивен',
    
    // Actions
    'actions.edit': 'Редактировать',
    'actions.delete': 'Удалить',
    'actions.save': 'Сохранить',
    'actions.cancel': 'Отмена',
    'actions.create': 'Создать',
    
    // Settings
    'settings.title': 'Системные настройки',
    'settings.subtitle': 'Настройка глобальных параметров системы',
    'settings.webhookTimeout': 'Таймаут webhook (мс)',
    'settings.maxRetries': 'Максимум повторов',
    'settings.logLevel': 'Уровень логирования',
    'settings.debugMode': 'Режим отладки',
    
    // AI Config
    'ai.title': 'Конфигурация отраслей',
    'ai.subtitle': 'Управление ИИ промптами и настройками для разных отраслей',
    'ai.editPrompt': 'Редактировать промпт',
    'ai.industries.retail': 'Розничная торговля',
    'ai.industries.construction': 'Строительство',
    'ai.industries.automotive': 'Автомобильная',
    'ai.industries.realEstate': 'Недвижимость',
    'ai.industries.foodService': 'Общественное питание',
    'ai.industries.healthcare': 'Здравоохранение',
    'ai.industries.beauty': 'Красота',
    'ai.industries.tech': 'Технологии',
    'ai.industries.finance': 'Финансы',
    'ai.industries.education': 'Образование',
    'ai.industries.travel': 'Туризм',
    'ai.industries.fitness': 'Фитнес',
    
    // Toast messages
    'toast.success': 'Успешно',
    'toast.error': 'Ошибка',
    'toast.tenantCreated': 'Тенант создан',
    'toast.tenantCreateFailed': 'Не удалось создать тенанта',
    'toast.tenantUpdated': 'Тенант обновлен',
    'toast.tenantUpdateFailed': 'Не удалось обновить тенанта',
    'toast.tenantDeleted': 'Тенант удален',
    'toast.tenantDeleteFailed': 'Не удалось удалить тенанта',
    'toast.configUpdated': 'Конфигурация обновлена',
    'toast.configUpdateFailed': 'Не удалось обновить конфигурацию',
    'toast.promptUpdated': 'Промпт обновлен',
    'toast.promptUpdateFailed': 'Не удалось обновить промпт',
    'toast.settingsUpdated': 'Настройки обновлены',
    'toast.settingsUpdateFailed': 'Не удалось обновить настройки',
    
    // Language switcher
    'language.russian': 'Русский',
    'language.kazakh': 'Қазақша',
  },
  kk: {
    // Navigation
    'nav.dashboard': 'Басқару панелі',
    'nav.tenants': 'Жалдаушылар',
    'nav.conversations': 'Сөйлесулер',
    'nav.leads': 'Клиенттер',
    'nav.analytics': 'Талдау',
    'nav.catalog': 'Каталог',
    'nav.payments': 'Төлемдер',
    'nav.test': 'Сынақ',
    
    // Tenants page
    'tenants.title': 'Жүйені басқару',
    'tenants.subtitle': 'Жалдаушыларды, баптауларды және ИИ конфигурациясын басқару',
    'tenants.createTenant': 'Жалдаушы жасау',
    'tenants.tabs.tenants': 'Жалдаушылар',
    'tenants.tabs.settings': 'Баптаулар',
    'tenants.tabs.aiConfig': 'ИИ конфигурациясы',
    
    // Stats
    'stats.totalTenants': 'Барлық жалдаушылар',
    'stats.activeTenants': 'Белсенді',
    'stats.telegramBots': 'Telegram боттар',
    'stats.whatsappBots': 'WhatsApp боттар',
    
    // Status
    'status.active': 'Белсенді',
    'status.inactive': 'Белсенді емес',
    
    // Actions
    'actions.edit': 'Өңдеу',
    'actions.delete': 'Жою',
    'actions.save': 'Сақтау',
    'actions.cancel': 'Болдырмау',
    'actions.create': 'Жасау',
    
    // Settings
    'settings.title': 'Жүйе баптаулары',
    'settings.subtitle': 'Жүйенің жаһандық параметрлерін баптау',
    'settings.webhookTimeout': 'Webhook күту уақыты (мс)',
    'settings.maxRetries': 'Максималды қайталау',
    'settings.logLevel': 'Логтау деңгейі',
    'settings.debugMode': 'Жөндеу режимі',
    
    // AI Config
    'ai.title': 'Салалар конфигурациясы',
    'ai.subtitle': 'Әртүрлі салалар үшін ИИ промпттарын және баптауларын басқару',
    'ai.editPrompt': 'Промптты өңдеу',
    'ai.industries.retail': 'Бөлшек сауда',
    'ai.industries.construction': 'Құрылыс',
    'ai.industries.automotive': 'Автомобиль',
    'ai.industries.realEstate': 'Жылжымайтын мүлік',
    'ai.industries.foodService': 'Қоғамдық тамақтану',
    'ai.industries.healthcare': 'Денсаулық сақтау',
    'ai.industries.beauty': 'Сұлулық',
    'ai.industries.tech': 'Технологиялар',
    'ai.industries.finance': 'Қаржы',
    'ai.industries.education': 'Білім беру',
    'ai.industries.travel': 'Туризм',
    'ai.industries.fitness': 'Фитнес',
    
    // Toast messages
    'toast.success': 'Сәтті орындалды',
    'toast.error': 'Қате',
    'toast.tenantCreated': 'Жалдаушы жасалды',
    'toast.tenantCreateFailed': 'Жалдаушыны жасау мүмкін болмады',
    'toast.tenantUpdated': 'Жалдаушы жаңартылды',
    'toast.tenantUpdateFailed': 'Жалдаушыны жаңарту мүмкін болмады',
    'toast.tenantDeleted': 'Жалдаушы жойылды',
    'toast.tenantDeleteFailed': 'Жалдаушыны жою мүмкін болмады',
    'toast.configUpdated': 'Конфигурация жаңартылды',
    'toast.configUpdateFailed': 'Конфигурацияны жаңарту мүмкін болмады',
    'toast.promptUpdated': 'Промпт жаңартылды',
    'toast.promptUpdateFailed': 'Промптты жаңарту мүмкін болмады',
    'toast.settingsUpdated': 'Баптаулар жаңартылды',
    'toast.settingsUpdateFailed': 'Баптауларды жаңарту мүмкін болмады',
    
    // Language switcher
    'language.russian': 'Орысша',
    'language.kazakh': 'Қазақша',
  }
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    // Load from localStorage or default to Russian
    const saved = localStorage.getItem('language');
    return (saved === 'kk' || saved === 'ru') ? saved : 'ru';
  });

  // Save to localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}