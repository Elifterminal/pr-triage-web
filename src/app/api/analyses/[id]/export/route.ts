import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (!user || !getTierLimits(user.plan).exportResults) {
    return NextResponse.json({ error: 'Export requires Pro or Team plan' }, { status: 403 });
  }

  const analysis = await db.analysis.findUnique({
    where: { id: params.id },
  });

  if (!analysis || analysis.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (analysis.status !== 'COMPLETE' || !analysis.resultData) {
    return NextResponse.json({ error: 'Analysis not complete' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';
  const result = JSON.parse(analysis.resultData as string);
  const filename = `pr-triage-${analysis.prOwner}-${analysis.prRepo}-${analysis.prNumber}`;

  if (format === 'csv') {
    const csv = toCSV(analysis, result);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // Default: JSON
  const exportData = {
    prUrl: analysis.prUrl,
    prOwner: analysis.prOwner,
    prRepo: analysis.prRepo,
    prNumber: analysis.prNumber,
    prTitle: analysis.prTitle,
    mode: analysis.mode,
    analyzedAt: analysis.completedAt,
    compositeScore: analysis.compositeScore,
    confidenceLevel: analysis.confidenceLevel,
    recommendation: analysis.recommendation,
    ...result,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCSV(analysis: any, result: any): string {
  const rows: string[][] = [];

  // Header row
  rows.push(['Field', 'Value']);

  // Basic info
  rows.push(['PR URL', analysis.prUrl]);
  rows.push(['Repository', `${analysis.prOwner}/${analysis.prRepo}`]);
  rows.push(['PR Number', String(analysis.prNumber)]);
  rows.push(['PR Title', analysis.prTitle || '']);
  rows.push(['Mode', analysis.mode]);
  rows.push(['Analyzed At', analysis.completedAt?.toISOString() || '']);
  rows.push(['Composite Score', String(analysis.compositeScore || 0)]);
  rows.push(['Confidence', analysis.confidenceLevel || '']);
  rows.push(['Recommendation', analysis.recommendation || '']);
  rows.push(['Action', result.action || '']);
  rows.push(['Priority', result.priority || '']);
  rows.push(['Category', result.prCategory || '']);
  rows.push(['Summary', result.executiveSummary || '']);

  // Dimensions
  if (result.dimensions) {
    rows.push(['', '']);
    rows.push(['Dimension', 'Band', 'Weight', 'Reasoning']);
    for (const dim of result.dimensions) {
      rows.push([dim.name || dim.key, dim.band, String(dim.weight), dim.reasoning || '']);
    }
  }

  // Risk flags
  if (result.riskFlags?.length) {
    rows.push(['', '']);
    rows.push(['Risk Flag', 'Severity', 'Evidence', 'Penalty']);
    for (const flag of result.riskFlags) {
      rows.push([flag.flag, flag.severity, flag.evidence || '', String(flag.penalty || 0)]);
    }
  }

  // Strengths & Concerns
  if (result.strengths?.length) {
    rows.push(['', '']);
    rows.push(['Strengths']);
    for (const s of result.strengths) rows.push([s]);
  }
  if (result.concerns?.length) {
    rows.push(['', '']);
    rows.push(['Concerns']);
    for (const c of result.concerns) rows.push([c]);
  }

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
