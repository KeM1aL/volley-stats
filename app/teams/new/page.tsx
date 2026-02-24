"use client";

import { useRouter } from "next/navigation";
import { TeamForm } from "@/components/teams/team-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function NewTeamPage() {
  const t = useTranslations('teams');
  const router = useRouter();

  const onTeamCreated = () => {
    router.push("/teams");
  };

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          {t('createNewTeam')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TeamForm onSuccess={onTeamCreated} />
      </CardContent>
    </Card>
  );
}