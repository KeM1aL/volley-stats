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

export const getUser = async (session?: Session | null): Promise<User | null> => {
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

  try {
    // Add timeout to all queries
    const [profile, teamMembers, clubMembers] = await withTimeout(
      Promise.all([
        getProfile(session.user.id),
        getTeamMembers(session.user.id),
        getClubMembers(session.user.id),
      ]),
      10000,
      'Loading user profile timed out. Please check your connection and try again.'
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
  if(userId)
    return [];

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
  if(userId)
    return {
      clubs: [],
      teams: []
      };
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
