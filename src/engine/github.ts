import { PRInputData, PRFile, LinkedIssue } from './types';

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

export async function fetchPRData(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken?: string
): Promise<PRInputData> {
  const headers = buildHeaders(githubToken);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // Fetch PR metadata, files, and repo info in parallel
  const [prRes, filesRes, repoRes] = await Promise.all([
    fetch(`${baseUrl}/pulls/${prNumber}`, { headers }),
    fetch(`${baseUrl}/pulls/${prNumber}/files?per_page=100`, { headers }),
    fetch(`${baseUrl}`, { headers }),
  ]);

  if (!prRes.ok) {
    if (prRes.status === 404) throw new Error('Pull request not found. Check the URL and ensure the repo is public.');
    if (prRes.status === 403) throw new Error('GitHub API rate limit exceeded. Add a GitHub token in settings for higher limits.');
    throw new Error(`GitHub API error: ${prRes.status} ${prRes.statusText}`);
  }

  const pr = await prRes.json();
  const filesData = filesRes.ok ? await filesRes.json() : [];
  const repoData = repoRes.ok ? await repoRes.json() : {};

  // Parse files
  const files: PRFile[] = (filesData as Array<Record<string, unknown>>).map((f) => ({
    filename: String(f.filename),
    status: String(f.status || 'modified'),
    patch: String(f.patch || ''),
    additions: Number(f.additions || 0),
    deletions: Number(f.deletions || 0),
  }));

  // Build diff from patches
  const diff = files
    .filter((f) => f.patch)
    .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
    .join('\n\n');

  // Extract linked issues from PR body
  const linkedIssues = await fetchLinkedIssues(
    owner, repo, pr.body || '', headers
  );

  // Try to fetch CONTRIBUTING.md
  let contributing: string | null = null;
  try {
    const contribRes = await fetch(
      `${baseUrl}/contents/CONTRIBUTING.md`,
      { headers }
    );
    if (contribRes.ok) {
      const contribData = await contribRes.json();
      if (contribData.content) {
        contributing = Buffer.from(contribData.content, 'base64')
          .toString('utf-8')
          .substring(0, 1500);
      }
    }
  } catch {
    // No CONTRIBUTING.md
  }

  return {
    url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
    owner,
    repo,
    number: prNumber,
    title: pr.title || '',
    body: pr.body || '',
    author: pr.user?.login || 'unknown',
    baseBranch: pr.base?.ref || 'main',
    headBranch: pr.head?.ref || '',
    isDraft: pr.draft || false,
    labels: (pr.labels || []).map((l: { name: string }) => l.name),
    files,
    diff,
    linkedIssues,
    repoDescription: repoData.description || '',
    repoLanguage: repoData.language || '',
    contributing,
  };
}

async function fetchLinkedIssues(
  owner: string,
  repo: string,
  prBody: string,
  headers: Record<string, string>
): Promise<LinkedIssue[]> {
  const pattern = /(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  const numbers: number[] = [];
  let match;
  while ((match = pattern.exec(prBody)) !== null) {
    numbers.push(parseInt(match[1], 10));
  }

  // Also check for plain #N references
  const refPattern = /#(\d+)/g;
  while ((match = refPattern.exec(prBody)) !== null) {
    const num = parseInt(match[1], 10);
    if (!numbers.includes(num)) numbers.push(num);
  }

  const unique = [...new Set(numbers)].slice(0, 5);
  const issues: LinkedIssue[] = [];

  for (const num of unique) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${num}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        // Only include actual issues, not PRs
        if (!data.pull_request) {
          issues.push({
            number: data.number,
            title: data.title || '',
            body: data.body || '',
            labels: (data.labels || []).map(
              (l: string | { name: string }) => typeof l === 'string' ? l : l.name
            ),
          });
        }
      }
    } catch {
      // Issue not accessible
    }
  }

  return issues;
}
