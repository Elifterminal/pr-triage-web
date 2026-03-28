import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not configured');
    resendClient = new Resend(key);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'PR Triage <noreply@updates.pr-triage.com>';

export async function sendTeamInvite(params: {
  to: string;
  teamName: string;
  inviterName: string;
  inviteUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: `You're invited to join ${params.teamName} on PR Triage`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #f5f5f5;">Team Invite</h2>
        <p>${params.inviterName} invited you to join <strong>${params.teamName}</strong> on PR Triage.</p>
        <p>PR Triage helps open source maintainers triage pull requests with structured, evidence-based assessments.</p>
        <a href="${params.inviteUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Accept Invite
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">If you didn't expect this, you can ignore it.</p>
      </div>
    `,
  });
}

export async function sendDigestEmail(params: {
  to: string;
  userName: string;
  analyses: Array<{
    prTitle: string;
    prUrl: string;
    score: number;
    recommendation: string;
    createdAt: string;
  }>;
  period: string;
}) {
  const resend = getResend();

  const rows = params.analyses.map(a => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333;">
        <a href="${a.prUrl}" style="color: #3b82f6; text-decoration: none;">${a.prTitle || a.prUrl}</a>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333; text-align: center;">
        <strong>${a.score}</strong>/100
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333; text-align: center;">
        ${a.recommendation}
      </td>
    </tr>
  `).join('');

  const summaryStats = {
    total: params.analyses.length,
    avgScore: Math.round(params.analyses.reduce((s, a) => s + a.score, 0) / params.analyses.length),
    prioritize: params.analyses.filter(a => a.recommendation === 'PRIORITIZE').length,
    review: params.analyses.filter(a => a.recommendation === 'REVIEW').length,
    close: params.analyses.filter(a => a.recommendation === 'CLOSE').length,
  };

  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: `PR Triage ${params.period} Digest — ${summaryStats.total} analyses`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #e5e5e5; background: #1a1a1a; padding: 24px; border-radius: 12px;">
        <h2 style="margin: 0 0 4px;">PR Triage ${params.period} Digest</h2>
        <p style="color: #888; margin: 0 0 20px;">Hi ${params.userName}, here's your triage summary.</p>

        <div style="display: flex; gap: 16px; margin-bottom: 20px;">
          <div style="background: #262626; padding: 12px 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${summaryStats.total}</div>
            <div style="color: #888; font-size: 13px;">Analyzed</div>
          </div>
          <div style="background: #262626; padding: 12px 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${summaryStats.avgScore}</div>
            <div style="color: #888; font-size: 13px;">Avg Score</div>
          </div>
          <div style="background: #262626; padding: 12px 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${summaryStats.prioritize}</div>
            <div style="color: #888; font-size: 13px;">Prioritize</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="padding: 8px 12px; text-align: left; color: #888;">PR</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Score</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="margin-top: 20px;">
          <a href="https://pr-triage-web.vercel.app/dashboard" style="color: #3b82f6; text-decoration: none;">
            View full dashboard →
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 24px;">
          Manage digest settings in <a href="https://pr-triage-web.vercel.app/settings" style="color: #666;">Settings</a>.
        </p>
      </div>
    `,
  });
}
