"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChartBar,
  CalendarClock,
  Grid3x3,
  Target,
} from "lucide-react";

type PanelType = "stats" | "events" | "court" | "points" | null;

interface LiveMatchSidebarProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  showPanel: boolean;
  onTogglePanel: () => void;
  navExpanded?: boolean;
  onToggleNav?: () => void;
  isMobile?: boolean;
  isLandscape?: boolean;
}

export function LiveMatchSidebar({
  activePanel,
  onPanelChange,
  showPanel,
  onTogglePanel,
  navExpanded = false,
  onToggleNav,
  isMobile = false,
  isLandscape = false,
}: LiveMatchSidebarProps) {
  const t = useTranslations("stats.sidebar");

  const menuItems = [
    {
      id: "stats",
      title: t("stats"),
      icon: ChartBar,
      onClick: () => {
        if (activePanel === "stats") {
          onTogglePanel();
        } else {
          onPanelChange("stats");
          if (!showPanel) {
            onTogglePanel();
          }
        }
      },
      isActive: activePanel === "stats" && showPanel,
    },
    {
      id: "events",
      title: t("events"),
      icon: CalendarClock,
      onClick: () => {
        if (activePanel === "events") {
          onTogglePanel();
        } else {
          onPanelChange("events");
          if (!showPanel) {
            onTogglePanel();
          }
        }
      },
      isActive: activePanel === "events" && showPanel,
    },
    {
      id: "points",
      title: t("points"),
      icon: Target,
      onClick: () => {
        if (activePanel === "points") {
          onTogglePanel();
        } else {
          onPanelChange("points");
          if (!showPanel) {
            onTogglePanel();
          }
        }
      },
      isActive: activePanel === "points" && showPanel,
    },
    {
      id: "court",
      title: t("court"),
      icon: Grid3x3,
      onClick: () => {
        if (activePanel === "court") {
          onTogglePanel();
        } else {
          onPanelChange("court");
          if (!showPanel) {
            onTogglePanel();
          }
        }
      },
      isActive: activePanel === "court" && showPanel,
    },
  ];

  // Landscape mobile: Compact vertical icon bar
  if (isLandscape) {
    return (
      <div className="flex flex-col items-center gap-1 p-1 bg-muted/30 h-full">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            data-testid={`sidebar-btn-${item.id}`}
            variant={item.isActive ? "default" : "ghost"}
            size="icon"
            onClick={item.onClick}
            className={cn(
              "h-8 w-8",
              item.isActive && "bg-primary text-primary-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="sr-only">{item.title}</span>
          </Button>
        ))}
      </div>
    );
  }

  // Mobile: Horizontal icon bar
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 p-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            data-testid={`sidebar-btn-${item.id}`}
            variant={item.isActive ? "default" : "ghost"}
            size="icon"
            onClick={item.onClick}
            className={cn(
              "h-10 w-10",
              item.isActive && "bg-primary text-primary-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="sr-only">{item.title}</span>
          </Button>
        ))}
      </div>
    );
  }

  // Desktop/Tablet: Vertical collapsible nav
  return (
    <div className="flex flex-col h-full bg-muted/30 border-r transition-all duration-300 ease-in-out overflow-hidden">
      {/* Collapse/Expand Toggle */}
      {onToggleNav && (
        <div className="shrink-0 p-1 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleNav}
            className="w-full h-8"
          >
            {navExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="sr-only">
              {navExpanded ? t("collapse") : t("expand")} {t("navigation")}
            </span>
          </Button>
        </div>
      )}

      {/* Nav Items */}
      <div className="flex-1 py-1 px-1 min-h-0 flex flex-col">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            data-testid={`sidebar-btn-${item.id}`}
            variant={item.isActive ? "secondary" : "ghost"}
            onClick={item.onClick}
            className={cn(
              "w-full justify-start gap-3 h-14 mb-0.5",
              navExpanded ? "px-3" : "px-2",
              item.isActive && "bg-secondary"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {navExpanded && <span className="text-sm">{item.title}</span>}
          </Button>
        ))}
      </div>
    </div>
  );
}
