"use client";

import { useState } from "react";
import { ChampionshipFilters } from "@/components/championships/championship-filters";
import { ChampionshipList } from "@/components/championships/championship-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterIcon, Plus } from "lucide-react";
import { NewChampionshipDialog } from "@/components/championships/new-championship-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent } from "@radix-ui/react-collapsible";
import { useTranslations } from "next-intl";

export default function ChampionshipsPage() {
  const t = useTranslations('championships');
  const [newChampionship, setNewChampionship] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleChampionshipCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
<div className="space-y-8">
      <div className="space-y-4">
        <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <FilterIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('filters.title')}</span>
          </Button>
          <Button onClick={() => setNewChampionship(true)} className="flex-1 sm:flex-none text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('newChampionship')}</span>
          </Button>
        </div>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <ChampionshipFilters />
        </CollapsibleContent>
      </Collapsible>
      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <ChampionshipList refreshKey={refreshKey} />
      )}

      <NewChampionshipDialog
        open={newChampionship}
        onClose={() => setNewChampionship(false)}
        onSuccess={handleChampionshipCreated}
      />
    </div>
  );
}
