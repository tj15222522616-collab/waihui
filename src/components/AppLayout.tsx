import { BarChart3, Database, FileDown, Globe2, Info, Moon, Search, Settings, ShieldCheck } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../utils/cn";

export type AppRoute = "research" | "dashboard" | "brokers" | "edit" | "detail" | "importExport" | "settings" | "about";

interface AppLayoutProps {
  route: AppRoute;
  search: string;
  onSearchChange: (value: string) => void;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}

const navItems: Array<{ route: AppRoute; label: string; icon: ComponentType<{ className?: string }> }> = [
  { route: "research", label: "Research Broker", icon: Globe2 },
  { route: "dashboard", label: "Dashboard", icon: BarChart3 },
  { route: "brokers", label: "Brokers", icon: Database },
  { route: "importExport", label: "Import / Export", icon: FileDown },
  { route: "settings", label: "Settings", icon: Settings },
  { route: "about", label: "About / Disclaimer", icon: Info }
];

export const AppLayout = ({ route, search, onSearchChange, onNavigate, children }: AppLayoutProps) => (
  <div className="flex min-h-screen bg-background">
    <aside className="w-64 shrink-0 border-r border-border bg-muted/35 px-4 py-5">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-base font-semibold">Forex Platform Finder</h1>
          <p className="text-xs text-muted-foreground">Research database</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.route === route || (item.route === "brokers" && route === "detail") || (item.route === "brokers" && route === "edit");
          return (
            <Button
              key={item.route}
              variant="ghost"
              className={cn("w-full justify-start", active && "bg-background shadow-sm")}
              onClick={() => onNavigate(item.route)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="mt-8 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Moon className="h-4 w-4" aria-hidden="true" />
          Compliance note
        </div>
        示例数据非实时排名，所有平台结论都需要用户自行核实。
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9" placeholder="筛选已保存平台、国家、监管机构、交易软件..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
        </div>
        <Button onClick={() => onNavigate("research")}>
          <Globe2 className="h-4 w-4" aria-hidden="true" />
          联网研究平台
        </Button>
      </header>
      <main className="min-w-0 flex-1 overflow-auto px-6 py-5">{children}</main>
    </div>
  </div>
);
