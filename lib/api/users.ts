  import { Club, ClubMember, Profile, Team, TeamMember, User } from '@/lib/types';
import { supabase } from '../supabase/client';
import { Session } from '@supabase/supabase-js';

// Helper: Promise with timeout
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
};

// Helper: Retry with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on validation errors (user profile not found, etc.)
      if (!lastError.message.includes('timed out')) {
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Retry failed');
};

type LoadingStage = 'profile' | 'memberships';

export const getUser = async (
  session?: Session | null,
  onStageChange?: (stage: LoadingStage) => void
): Promise<User | null> => {
  console.log('Loading user profile ...');
  if (!session) {
    const {
      data: { session: sessionData },
    } = await supabase.auth.getSession();
    session = sessionData;
  }
  if (!session) {
    console.warn('No session found');
    return null;
  }
  console.log('Session found', session);

  // Wrap in retry logic for timeout errors
  return await withRetry(async () => {
    try {
      if (!session || !session.user) {
        throw new Error('No user found in session');
      }
      // Load profile first
      onStageChange?.('profile');
      const profile = await withTimeout(
        getProfile(session!.user.id),
        30000,
        'Loading profile timed out after 30 seconds. Please check your connection and try again.'
      );

      // Load memberships
      onStageChange?.('memberships');
      const [teamMembers, clubMembers] = await withTimeout(
        Promise.all([
          getTeamMembers(session.user.id),
          getClubMembers(session.user.id),
        ]),
        30000,
        'Loading team memberships timed out after 30 seconds. Please check your connection and try again.'
      );

      const user = {
        id: session.user.id,
        email: session.user.email,
        profile,
        teamMembers: [...teamMembers, ...clubMembers.teams],
        clubMembers: clubMembers.clubs,
      };

      console.log('User Profile', user);
      return user;
    } catch (error) {
      console.error('getUser failed:', error);
      // Re-throw with context
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to load user profile'
      );
    }
  });
};

export const getProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getProfile error:', error);
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) {
    console.warn('No profile found for user:', userId);
    throw new Error('User profile not found. Please complete your profile setup.');
  }

  return data;
};

export const getTeamMembers = async (userId: string): Promise<TeamMember[]> => {

  const { data, error } = await supabase
    .from('team_members')
    .select('*, teams(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('getTeamMembers error:', error);
    throw new Error(`Failed to load team memberships: ${error.message}`);
  }

  // Empty array is OK - user might not be in any teams
  return data || [];
};

export const updateProfile = async (userId: string, profile: Partial<Profile>): Promise<Profile> => {
  const { data, error } = await supabase.from('profiles').update(profile).eq('id', userId).select();
  if (error) {
    throw new Error(error.message);
  }
  return data[0] || null;
};

export const getClubMembers = async (userId: string): Promise<{clubs: ClubMember[], teams: TeamMember[]}> => {
  // Start from club_members where user_id exists
  const { data, error } = await supabase
    .from('club_members')
    .select(`
      *,
      clubs!inner (
        id,
        name,
        teams (*)
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('getClubMembers error:', error);
    throw new Error(`Failed to load club memberships: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // No clubs is OK - return empty (not an error)
    return { clubs: [], teams: [] };
  }

  const clubMembers: ClubMember[] = [];
  const teamMembers: TeamMember[] = [];

  data.forEach((member) => {
    // Add club membership
    clubMembers.push({
      id: member.id,
      club_id: member.club_id,
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      updated_at: member.updated_at,
    });

    // Create TeamMember entries for each team in the club
    const club = member.clubs as unknown as Club & { teams?: Team[] };
    club.teams?.forEach((team) => {
      teamMembers.push({
        id: team.id,
        team_id: team.id,
        name: team.name,
        number: 0,
        position: '',
        user_id: userId,
        role: member.role,
        avatar_url: '',
        comments: '',
        created_at: team.created_at || '',
        updated_at: team.updated_at || '',
      });
    });
  });
  return { clubs: clubMembers, teams: teamMembers };
};
