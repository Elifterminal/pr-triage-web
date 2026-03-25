import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      label: true,
      isValid: true,
      lastTestedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { provider, apiKey, label } = body;

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: 'provider and apiKey are required' },
      { status: 400 }
    );
  }

  if (!['ANTHROPIC', 'OPENAI', 'OPENROUTER', 'GEMINI'].includes(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider. Supported: ANTHROPIC, OPENAI, OPENROUTER, GEMINI' },
      { status: 400 }
    );
  }

  // Test the API key
  const isValid = await testApiKey(provider, apiKey);

  const encryptedKey = encrypt(apiKey);

  const key = await db.apiKey.upsert({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider,
      },
    },
    update: {
      encryptedKey,
      label: label || null,
      isValid,
      lastTestedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      provider,
      encryptedKey,
      label: label || null,
      isValid,
      lastTestedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: key.id,
    provider: key.provider,
    isValid: key.isValid,
    lastTestedAt: key.lastTestedAt,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
  }

  await db.apiKey.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

async function testApiKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    if (provider === 'ANTHROPIC') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return res.ok;
    }

    if (provider === 'OPENAI') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    }

    if (provider === 'OPENROUTER') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    }

    return false;
  } catch {
    return false;
  }
}
