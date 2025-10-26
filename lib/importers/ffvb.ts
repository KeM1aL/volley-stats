import { getApi } from "@/lib/api";
import { Match } from "@/lib/types";
import { parse as dateParse } from 'date-fns';
import { parse } from "papaparse";

export async function importFfvbMatches(seasonId: number, championshipId: number, api: ReturnType<typeof getApi>) {
  const championships = await api.championships.getChampionships([
    { field: "id", operator: "eq", value: championshipId },
  ]);
  let championship = championships?.[0];
  if (!championship) {
    throw new Error("Championship not found");
  }
  if(!championship.ext_code) {
    throw new Error("Championship reference not found");
  }

  const seasons = await api.seasons.getSeasons([
    { field: "id", operator: "eq", value: seasonId },
  ]);
  const season = seasons?.[0];

  if (!season) {
    throw new Error("Season not found");
  }


  const formData = new URLSearchParams();
  formData.append("cal_saison", season.name.replace('-', '/'));
  formData.append("cal_codent", "PTCA06");
  formData.append("cal_codpoule", championship.ext_code);
  formData.append("cal_coddiv", "");
  formData.append("cal_codtour", "");
  formData.append("typ_edition", "E");
  formData.append("type", "RES");
  formData.append("rech_equipe", "");

  const response = await fetch(
    "https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier_export.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }
  const csvData = await response.text();
  console.log(csvData);
  const { data: parsedData, errors } = parse<Record<string, string>>(csvData, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (header) => header.toLowerCase().trim(),
  });

  if (errors.length > 0) {
    throw new Error(`Failed to parse CSV data: ${errors.map(e => e.message).join(", ")}`);
  }

  const teamCache = new Map<string, any>();

  const getTeam = async (name: string, code: string) => {
    if (teamCache.has(code)) {
      return teamCache.get(code);
    }
    const teams = await api.teams.getTeams([
      { field: "ext_code", operator: "eq", value: code },
      { field: "ext_source", operator: "eq", value: "ffvb" },
    ]);
    let team = teams?.[0];
    if (!team) {
      team = await api.teams.createTeam({ name, ext_code: code, ext_source: "ffvb", championship_id: championship.id });
      console.log(`team ${name} created`);
    }
    teamCache.set(code, team);
    return team;
  };

  const matchesToCreate: Partial<Match>[] = [];
  const matchesToUpdate: Partial<Match>[] = [];

  for (const row of parsedData) {
    const { "eqa_nom": homeTeamName, "eqb_nom": awayTeamName, date, heure, salle: location, "match": matchCode, "eqa_no": homeTeamCode, "eqb_no": awayTeamCode } = row;
    if (!homeTeamName || !awayTeamName || !date || !heure || !matchCode || !homeTeamCode || !awayTeamCode) {
      continue;
    }

    const { set, score, total } = row;

    const existingMatches = await api.matches.getMatchs([
      { field: "ext_code", operator: "eq", value: matchCode },
      { field: "ext_source", operator: "eq", value: "ffvb" },
      { field: "championship_id", operator: "eq", value: championship.id },
    ]);

    const [homeTeam, awayTeam] = await Promise.all([
      getTeam(homeTeamName, homeTeamCode),
      getTeam(awayTeamName, awayTeamCode),
    ]);
    
    const matchDate = dateParse(`${date} ${heure}`, 'yyyy-MM-dd HH:mm', new Date());

    const matchData: Partial<Match> = {
      date: matchDate.toISOString(),
      location,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      championship_id: championship.id,
      season_id: season.id,
      status: "upcoming",
      ext_code: matchCode,
      ext_source: "ffvb",
      match_format_id: championship.default_match_format,
    };

    if (set) {
      const [home_score, away_score] = set.split("/").map(s => parseInt(s, 10));
      matchData.home_score = home_score;
      matchData.away_score = away_score;
    }

    if (total) {
      const [home_total, away_total] = total.split("-").map(s => parseInt(s, 10));
      matchData.home_total = home_total;
      matchData.away_total = away_total;
      matchData.status = 'completed';
    }

    if (score) {
      matchData.detailed_scores = score.split(",");
    }

    if (existingMatches && existingMatches.length > 0) {
      const match = existingMatches[0];
      if (match.status === 'completed') {
        continue;
      }
      matchesToUpdate.push({ ...matchData, id: match.id });
      continue;
    }

    if (homeTeam && awayTeam) {
      matchesToCreate.push(matchData);
    }
  }

  if (matchesToCreate.length > 0) {
    console.log(`creating ${matchesToCreate.length} matches`);
    await Promise.all(matchesToCreate.map(match => api.matches.createMatch(match)));
  }
  if (matchesToUpdate.length > 0) {
    console.log(`updating ${matchesToUpdate.length} matches`);
    await Promise.all(matchesToUpdate.map(match => api.matches.updateMatch(match.id!, match)));
  }
}
