"use client";

import { useChampionshipApi } from "@/hooks/use-championship-api";
import { useChampionshipFilters } from "@/hooks/use-championship-filters";
import { useSeasonApi } from "@/hooks/use-season-api";
import { Championship, Season } from "@/lib/types";
import { Filter, FilterOperator } from "@/lib/api/types";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ChampionshipList() {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const championshipApi = useChampionshipApi();
  const seasonApi = useSeasonApi();
  const { filters } = useChampionshipFilters();
  const router = useRouter();

  useEffect(() => {
    const fetchChampionshipsAndSeasons = async () => {
      const apiFilters: Filter[] = [];
      if (filters.seasonId) {
        apiFilters.push({ field: "season_id", operator: "eq" as FilterOperator, value: filters.seasonId });
      }
      if (filters.match_formats?.format) {
        apiFilters.push({ field: "match_formats.format", operator: "eq" as FilterOperator, value: filters.match_formats.format });
      }
      if (filters.gender) {
        apiFilters.push({ field: "gender", operator: "eq" as FilterOperator, value: filters.gender });
      }
      if (filters.ageCategory) {
        apiFilters.push({ field: "age_category", operator: "eq" as FilterOperator, value: filters.ageCategory });
      }

      const [championshipsData, seasonsData] = await Promise.all([
        championshipApi.getChampionships(apiFilters),
        seasonApi.getSeasons(),
      ]);

      setChampionships(championshipsData || []);
      setSeasons(seasonsData || []);
    };

    fetchChampionshipsAndSeasons();
  }, [championshipApi, seasonApi, filters, router]);

  const groupedChampionships = championships.reduce((acc, championship) => {
    const season = seasons.find((s) => s.id === championship.season_id);
    const seasonName = season ? `Season ${season.name}` : "Unknown Season";
    const format = championship.match_formats?.format || "Unknown Format";

    if (!acc[seasonName]) {
      acc[seasonName] = {};
    }
    if (!acc[seasonName][format]) {
      acc[seasonName][format] = [];
    }
    acc[seasonName][format].push(championship);
    return acc;
  }, {} as Record<string, Record<string, Championship[]>>);

  const getGenderCardClass = (gender: Championship['gender']) => {
    switch (gender) {
      case 'female':
        return 'border-rose-500';
      case 'male':
        return 'border-blue-500';
      case 'mixte':
        return 'border-purple-500';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-8">
      {Object.keys(groupedChampionships).length === 0 ? (
        <p className="text-center text-muted-foreground">No championships found matching the current filters.</p>
      ) : (
        Object.entries(groupedChampionships).map(([seasonName, formats]) => (
          <div key={seasonName}>
            <h2 className="text-2xl font-bold mb-4">{seasonName}</h2>
            {Object.entries(formats).map(([format, championshipList]) => (
              <div key={format} className="ml-4 space-y-4">
                <h3 className="text-xl font-semibold mb-2">{format}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {championshipList.map((championship) => (
                    <Card
                      key={championship.id}
                      className={cn(
                        "flex flex-col justify-between",
                        getGenderCardClass(championship.gender)
                      )}
                    >
                      <CardHeader>
                        <CardTitle>{championship.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>Format: {championship.match_formats?.format}</p>
                        <p>Gender: {championship.gender}</p>
                        <p>Age Category: {championship.age_category}</p>
                        {/* Add more useful information here */}
                      </CardContent>
                      <CardFooter>
                        <Button asChild variant="outline" className="w-full">
                          <Link href={`/championships/${championship.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
