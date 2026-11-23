import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'receipt';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const prompt =
      mode === 'receipt'
        ? `Extract the yacht charter expense from this invoice/receipt. Return ONLY valid JSON (no markdown) with keys:
           "vendor" (string, supplier/marina name),
           "category" (one of: "Marina_Berthing", "Provisioning", "Customs_Taxes", "Water_Toys", "Other"),
           "amount_eur" (number, grand total amount paid including VAT).`
        : `Extract voyage data from this captain noon report. Return ONLY valid JSON (no markdown) with keys:
           "departure_port" (string),
           "arrival_port" (string),
           "distance_nm" (number),
           "cruising_speed" (number).`;

    const parseCleanJson = (raw: string) => {
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    };

    const groqKey = process.env.GROQ_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Primary: Groq (console.groq.com - Free, no card)
    if (groqKey && mimeType.startsWith('image/')) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                ],
              },
            ],
          }),
        });
        if (groqRes.ok) {
          const groqJson = await groqRes.json();
          const rawText = groqJson?.choices?.[0]?.message?.content || '{}';
          return NextResponse.json({ demo: false, provider: 'groq', mode, extracted: parseCleanJson(rawText) });
        }
      } catch {}
    }

    // 2. Secondary: OpenRouter Free Vision Router (openrouter.ai - Free, no card)
    if (openRouterKey && mimeType.startsWith('image/')) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                ],
              },
            ],
          }),
        });
        if (orRes.ok) {
          const orJson = await orRes.json();
          const rawText = orJson?.choices?.[0]?.message?.content || '{}';
          return NextResponse.json({ demo: false, provider: 'openrouter', mode, extracted: parseCleanJson(rawText) });
        }
      } catch {}
    }

    // 3. Tertiary: Google Gemini Vision
    if (geminiKey) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      const geminiJson = await geminiRes.json();
      if (geminiRes.ok) {
        const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return NextResponse.json({ demo: false, provider: 'gemini', mode, extracted: parseCleanJson(rawText) });
      }
      return NextResponse.json(
        { error: geminiJson?.error?.message || 'All AI providers temporarily busy, try again' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Please add GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY in .env.local' },
      { status: 500 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error while scanning' },
      { status: 500 }
    );
  }
}
