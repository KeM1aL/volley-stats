'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { TeamSelect } from '@/components/teams/team-select';
import { ClubSelect } from '@/components/clubs/club-select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Team, Club, User } from '@/lib/types';
import { updateProfile } from '@/lib/api/users';
import { toast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

type FavoritesSectionProps = {
  user: User;
  onUpdate: () => Promise<void>;
};

type FavoriteType = 'team' | 'club' | 'none';

export function FavoritesSection({ user, onUpdate }: FavoritesSectionProps) {
  // Determine initial favorite type
  const getInitialFavoriteType = (): FavoriteType => {
    if (user.profile.favorite_team_id) return 'team';
    if (user.profile.favorite_club_id) return 'club';
    return 'none';
  };

  const [favoriteType, setFavoriteType] = useState<FavoriteType>(getInitialFavoriteType());
  const [favoriteTeam, setFavoriteTeam] = useState<Team | null>(
    user.profile.favorite_team || null
  );
  const [favoriteClub, setFavoriteClub] = useState<Club | null>(
    user.profile.favorite_club || null
  );
  const [isSaving, setIsSaving] = useState(false);

  // Get user's accessible teams and clubs
  const userTeamIds = new Set(user.teamMembers?.map(tm => tm.team_id) || []);
  const userClubIds = new Set(user.clubMembers?.map(cm => cm.club_id) || []);

  // Check if user has access to currently selected favorites
  const hasTeamAccess = favoriteTeam ? userTeamIds.has(favoriteTeam.id) : true;
  const hasClubAccess = favoriteClub ? userClubIds.has(favoriteClub.id) : true;

  const hasNoMemberships = !user.teamMembers?.length && !user.clubMembers?.length;

  const handleFavoriteTypeChange = (newType: string) => {
    setFavoriteType(newType as FavoriteType);
    // Clear the other favorite when switching types
    if (newType === 'team') {
      setFavoriteClub(null);
    } else if (newType === 'club') {
      setFavoriteTeam(null);
    } else {
      // 'none' - clear both
      setFavoriteTeam(null);
      setFavoriteClub(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate access before saving
      if (favoriteType === 'team') {
        if (favoriteTeam && !userTeamIds.has(favoriteTeam.id)) {
          throw new Error('You do not have access to the selected team');
        }
        if (!favoriteTeam) {
          throw new Error('Please select a team');
        }
      } else if (favoriteType === 'club') {
        if (favoriteClub && !userClubIds.has(favoriteClub.id)) {
          throw new Error('You do not have access to the selected club');
        }
        if (!favoriteClub) {
          throw new Error('Please select a club');
        }
      }

      await updateProfile(user.id, {
        favorite_team_id: favoriteType === 'team' && favoriteTeam ? favoriteTeam.id : null,
        favorite_club_id: favoriteType === 'club' && favoriteClub ? favoriteClub.id : null,
      });

      await onUpdate(); // Reload user to get updated profile

      toast({
        title: 'Favorites updated',
        description: 'Your favorite has been saved.',
      });
    } catch (error) {
      console.error('Failed to save favorites:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save favorites',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Favorites</h3>
            <p className="text-sm text-muted-foreground">
              Set your default team or club for quick filtering on matches and teams pages
            </p>
          </div>

          {hasNoMemberships && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You need to be a member of at least one team or club to set a favorite.
                Join a team or club first.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Favorite Type</Label>
              <RadioGroup value={favoriteType} onValueChange={handleFavoriteTypeChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="font-normal cursor-pointer">
                    None (no default filter)
                  </Label>
                </div>
                {user.clubMembers && user.clubMembers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="club" id="club" />
                    <Label htmlFor="club" className="font-normal cursor-pointer">
                      Favorite Club
                    </Label>
                  </div>
                )}
                {user.teamMembers && user.teamMembers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="team" id="team" />
                    <Label htmlFor="team" className="font-normal cursor-pointer">
                      Favorite Team
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {favoriteType === 'club' && (
              <div className="space-y-2">
                <Label>Select Club</Label>
                <ClubSelect
                  value={favoriteClub}
                  onChange={setFavoriteClub}
                  isClearable
                />
                {favoriteClub && !hasClubAccess && (
                  <p className="text-sm text-destructive">
                    Warning: You no longer have access to this club
                  </p>
                )}
              </div>
            )}

            {favoriteType === 'team' && (
              <div className="space-y-2">
                <Label>Select Team</Label>
                <TeamSelect
                  value={favoriteTeam}
                  onChange={setFavoriteTeam}
                  isClearable
                />
                {favoriteTeam && !hasTeamAccess && (
                  <p className="text-sm text-destructive">
                    Warning: You no longer have access to this team
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving || hasNoMemberships}
            >
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Favorite'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
