'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  user?: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export function TeamMembers({ tierAllowed }: { tierAllowed: boolean }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      setTeam(data.team || null);
      setRole(data.role || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeamName('');
      fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteEmail('');
      setInviteUrl(data.inviteUrl);
      fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    try {
      await fetch(`/api/team/members?id=${memberId}`, { method: 'DELETE' });
      fetchTeam();
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  }

  if (!tierAllowed) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Team Members
            <Badge variant="outline">Team</Badge>
          </CardTitle>
          <CardDescription>Invite up to 10 team members to share analyses and collaborate on triage.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Upgrade to the Team plan to use this feature.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Team Members
          {team && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {team.members.length}/10
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {team ? `Team: ${team.name}` : 'Create a team to invite members.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!team ? (
          <form onSubmit={handleCreateTeam} className="flex gap-2">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              disabled={creating}
            />
            <Button type="submit" disabled={creating || !teamName.trim()}>
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
          </form>
        ) : (
          <>
            {/* Member list */}
            <div className="space-y-2">
              {team.members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {member.user?.name || member.email}
                        </span>
                        <Badge variant={member.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {member.status === 'ACTIVE' ? member.role : 'Pending'}
                        </Badge>
                      </div>
                      {member.user?.name && (
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </div>
                  </div>
                  {role === 'OWNER' && member.role !== 'OWNER' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                      disabled={removing === member.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {removing === member.id ? 'Removing...' : 'Remove'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite form */}
            {role === 'OWNER' && (
              <form onSubmit={handleInvite} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="team@member.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={inviting}
                />
                <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Inviting...' : 'Invite'}
                </Button>
              </form>
            )}

            {inviteUrl && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
                <p className="text-blue-400 mb-1">Invite sent! Share this link if the email doesn&apos;t arrive:</p>
                <code className="text-xs text-muted-foreground break-all">{inviteUrl}</code>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
