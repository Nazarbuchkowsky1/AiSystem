import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    let promptsToday = 0;
    let promptsYesterday = 0;
    let spendToday = 0;
    let spendYesterday = 0;

    try {
      const messages = await base44.asServiceRole.entities.Message.list('-created_date', 5000);
      const list = Array.isArray(messages) ? messages : [];
      for (const m of list) {
        const created = m.created_date || m.created_at;
        if (!created) continue;
        const dateStr = typeof created === 'string' ? created.slice(0, 10) : new Date(created).toISOString().slice(0, 10);

        if (dateStr === todayKey) {
          if (m.role === 'user') promptsToday += 1;
          if (m.role === 'assistant' && m.cost) spendToday += Number(m.cost) || 0;
        } else if (dateStr === yesterdayKey) {
          if (m.role === 'user') promptsYesterday += 1;
          if (m.role === 'assistant' && m.cost) spendYesterday += Number(m.cost) || 0;
        } else if (dateStr < yesterdayKey) {
          break;
        }
      }
    } catch (e) {
      console.error('Message count error:', e);
    }

    return Response.json({
      promptsToday,
      promptsYesterday,
      spendToday,
      spendYesterday,
    });
  } catch (error: unknown) {
    console.error('getAnalytics error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
