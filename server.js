const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// âââ Prompt builder âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function buildPrompt(profile, brief, channels) {
  const channelList = [];
  if (channels.social)  channelList.push('social media (Instagram, Facebook, Twitter/X)');
  if (channels.email)   channelList.push('email/newsletter');
  if (channels.sms)     channelList.push('SMS and WhatsApp');
  if (channels.print)   channelList.push('physical print (flyer/poster/bulletin)');

  const jsonShape = [];
  if (channels.social)  jsonShape.push(`"social": { "instagram": { "caption": "...", "hashtags": ["tag1","tag2"] }, "facebook": { "post": "..." }, "twitter": { "post": "..." } }`);
  if (channels.email)   jsonShape.push(`"email": { "subject": "...", "preview": "...", "body": "..." }`);
  if (channels.sms)     jsonShape.push(`"sms": { "sms": "...", "whatsapp": "..." }`);
  if (channels.print)   jsonShape.push(`"print": { "headline": "...", "subheadline": "...", "body": "...", "cta": "..." }`);

  return `Generate multi-channel content for a ${profile.type} called "${profile.name}".

ORGANISATION PROFILE:
- Name: ${profile.name}
- Type: ${profile.type}
- Voice/Tone: ${profile.tone}
- Target Audience: ${profile.audience || 'General congregation and community'}

CONTENT BRIEF:
- Topic/Event: ${brief.topic}
- Key Message: ${brief.keyMessage}
${brief.scripture ? `- Scripture Reference: ${brief.scripture}` : ''}
${brief.date ? `- Event Date: ${brief.date}` : ''}
${brief.context ? `- Additional Context: ${brief.context}` : ''}

Generate content for: ${channelList.join(', ')}

Return ONLY a valid JSON object with this exact structure:
{
  ${jsonShape.join(',\n  ')}
}

CONTENT GUIDELINES (follow precisely):
- Instagram caption: 150â200 words, authentic and engaging, conclude with 8â10 relevant hashtags as an array (no # in the array values, just the word)
- Facebook post: 200â300 words, community-focused, warm, invite engagement with a question
- Twitter/X post: STRICT maximum 270 characters including spaces â punchy and direct
- Email subject: under 50 characters â compelling, no clickbait
- Email preview text: under 90 characters â teases the content
- Email body: 350â500 words, warm greeting ("Dear [Name]," style), paragraphs, include a clear call-to-action, sign off as "The ${profile.name} Team"
- SMS: STRICT maximum 155 characters including spaces
- WhatsApp: 100â200 words, conversational, use 1â2 relevant emoji, include a reply prompt
- Print headline: 4â8 powerful words, all caps
- Print subheadline: one compelling sentence, max 15 words
- Print body: 80â120 words, scannable, no jargon, speaks directly to the reader
- Print CTA: 3â6 words, action-oriented (e.g. "Join Us This Sunday")

Return ONLY valid JSON. No markdown code fences, no explanation text â just the raw JSON object starting with {`;
}

// âââ Claude API âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
async function callClaude(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// âââ OpenAI API âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
async function callOpenAI(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      temperature: 0.75,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// âââ Health check âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/health', (req, res) => res.json({ ok: true }));

// âââ Generate endpoint ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.post('/api/generate', async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /api/generate â provider: ${req.body?.provider}, channels:`, req.body?.channels);

  const { provider, apiKey, model, profile, brief, channels } = req.body || {};

  if (!apiKey)             return res.status(400).json({ error: 'API key is required.' });
  if (!profile?.name)      return res.status(400).json({ error: 'Organisation name is required.' });
  if (!brief?.topic)       return res.status(400).json({ error: 'Content topic is required.' });
  if (!channels || !Object.values(channels).some(Boolean)) {
    return res.status(400).json({ error: 'Select at least one channel.' });
  }

  const systemPrompt = `You are an expert content strategist and copywriter specialising in faith-based organisations, churches, and ministries. You write compelling, authentic content that resonates deeply with congregations and communities while driving real engagement. You always return well-formed JSON exactly as instructed.`;

  const userPrompt = buildPrompt(profile, brief, channels);

  try {
    let rawText;
    if (provider === 'openai') {
      rawText = await callOpenAI(apiKey, model, systemPrompt, userPrompt);
    } else {
      rawText = await callClaude(apiKey, model, systemPrompt, userPrompt);
    }

    console.log(`[${new Date().toISOString()}] AI response received (${rawText.length} chars)`);

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain valid JSON. Please try again.');
    const content = JSON.parse(match[0]);
    res.json({ success: true, content });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    const msg = err instanceof SyntaxError
      ? 'Could not parse AI response. Please try again.'
      : err.message;
    res.status(500).json({ error: msg });
  }
});

// âââ Catch unhandled errors so the server never crashes silently ââââââââââââââ
process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

// âââ Serve app ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nâ  VOM Content Studio running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
