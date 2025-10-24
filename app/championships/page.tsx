import { ChampionshipFilters } from "@/components/championships/championship-filters";
import { ChampionshipList } from "@/components/championships/championship-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChampionshipsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Championships</h1>
      <div className="mb-8">
        <ChampionshipFilters />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Championships</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampionshipList />
        </CardContent>
      </Card>
    </div>
  );
}
