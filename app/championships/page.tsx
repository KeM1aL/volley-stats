"use client";

import { useState } from "react";
import { ChampionshipFilters } from "@/components/championships/championship-filters";
import { ChampionshipList } from "@/components/championships/championship-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NewChampionshipDialog } from "@/components/championships/new-championship-dialog";

export default function ChampionshipsPage() {
  const [newChampionship, setNewChampionship] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleChampionshipCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Championships</h1>
        <Button onClick={() => setNewChampionship(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Championship
        </Button>
      </div>
      <div className="mb-8">
        <ChampionshipFilters />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Championships</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampionshipList refreshKey={refreshKey} />
        </CardContent>
      </Card>

      <NewChampionshipDialog
        open={newChampionship}
        onClose={() => setNewChampionship(false)}
        onSuccess={handleChampionshipCreated}
      />
    </div>
  );
}
