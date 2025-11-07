  import { Club, ClubMember, Profile, Team, TeamMember, User } from '@/lib/types';
import { supabase } from '../supabase/client';
import { Session } from '@supabase/supabase-js';

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

  const [profile, teamMembers, clubMembers] = await Promise.all([
    getProfile(session.user.id),
    getTeamMembers(session.user.id),
    getClubMembers(session.user.id),
  ]);

  const user = {
    id: session.user.id,
    email: session.user.email,
    profile,
    teamMembers: [...teamMembers, ...clubMembers.teams],
    clubMembers: clubMembers.clubs,
  };
  console.log('User Profile', user);
  return user;
};

export const getProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
  return data[0] || null;
};

export const getTeamMembers = async (userId: string): Promise<TeamMember[]> => {
  const { data, error } = await supabase.from('team_members').select('*, teams(*)').eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
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
  const { data, error } = await supabase.from('clubs').select('*, club_members(*), teams(*)').eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
  if(!data) {
    return {clubs: [], teams: []};
  }
  const clubs = data as (Club & {club_members?: ClubMember[], teams?: Team[]})[];
  //extract ClubMembers and create TeamMembers with same role as in ClubMembers
  const clubMembers: ClubMember[] = [];
  const teamMembers: TeamMember[] =  [];
  clubs.forEach((club) => {
    club.club_members?.forEach((member) => {
      if(member.user_id === userId) {
        clubMembers.push(member);
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
            created_at: '',
            updated_at: '',
          });
        });
      }
    });
    
  });
  return {clubs: clubMembers, teams: teamMembers};;
};
