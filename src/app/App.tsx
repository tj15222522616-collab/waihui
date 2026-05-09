import { useEffect, useMemo, useState } from "react";
import { forexApi } from "../services/forexApi";
import { defaultSettings } from "../data/defaultSettings";
import type { AppSettings, Broker } from "../types/broker";
import { AppLayout, type AppRoute } from "../components/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { BrokersPage } from "../pages/BrokersPage";
import { BrokerFormPage } from "../pages/BrokerFormPage";
import { BrokerDetailPage } from "../pages/BrokerDetailPage";
import { ImportExportPage } from "../pages/ImportExportPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AboutPage } from "../pages/AboutPage";
import { ResearchPage } from "../pages/ResearchPage";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("research");
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setError(null);
    try {
      const [brokerRows, appSettings] = await Promise.all([forexApi.listBrokers(), forexApi.getSettings()]);
      setBrokers(brokerRows);
      setSettings(appSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

  const selectedBroker = useMemo(() => brokers.find((broker) => broker.id === selectedBrokerId) ?? null, [brokers, selectedBrokerId]);

  const navigate = (nextRoute: AppRoute, brokerId?: string) => {
    if (brokerId) setSelectedBrokerId(brokerId);
    setRoute(nextRoute);
  };

  const renderPage = () => {
    if (loading) return <div className="p-6 text-muted-foreground">正在加载本地数据库...</div>;
    if (error) return <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-danger">{error}</div>;

    switch (route) {
      case "research":
        return <ResearchPage settings={settings} onSaved={loadData} onOpenBroker={(id) => navigate("detail", id)} />;
      case "dashboard":
        return <DashboardPage brokers={brokers} settings={settings} onOpenBroker={(id) => navigate("detail", id)} />;
      case "brokers":
        return (
          <BrokersPage
            brokers={brokers}
            settings={settings}
            globalSearch={globalSearch}
            onOpenBroker={(id) => navigate("detail", id)}
            onEditBroker={(id) => navigate("edit", id)}
            onRefresh={loadData}
          />
        );
      case "edit":
        return <BrokerFormPage mode="edit" broker={selectedBroker} onSaved={loadData} onDone={() => navigate("detail", selectedBroker?.id)} />;
      case "detail":
        return <BrokerDetailPage broker={selectedBroker} onEdit={(id) => navigate("edit", id)} onBack={() => navigate("brokers")} />;
      case "importExport":
        return <ImportExportPage brokers={brokers} settings={settings} onImported={loadData} />;
      case "settings":
        return (
          <SettingsPage
            settings={settings}
            onSave={async (nextSettings) => {
              const saved = await forexApi.updateSettings(nextSettings);
              setSettings(saved);
              await loadData();
            }}
          />
        );
      case "about":
        return <AboutPage />;
      default:
        return null;
    }
  };

  return (
    <AppLayout route={route} onNavigate={navigate} search={globalSearch} onSearchChange={setGlobalSearch}>
      {renderPage()}
    </AppLayout>
  );
}
