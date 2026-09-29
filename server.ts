import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client (uses process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI();

// AI Spam Classifier helper function
async function classifyIncidentText(data: {
  title: string;
  description?: string;
  category?: string;
  address?: string;
}): Promise<{ isSpam: boolean; reason: string; confidence: number }> {
  const { title = '', description = '', category = 'other', address = '' } = data;
  const combinedText = `Title: "${title}"\nDescription: "${description}"\nCategory: "${category}"\nAddress: "${address}"`;

  const prompt = `You are an automated civic infrastructure report AI spam and fraud filtration system for a city municipality.
Your job is to detect whether an incident report is SPAM, NONSENSICAL TEXT, GIBBERISH, or INCOHERENT KEYBOARD MASHING.

Analyze the following civic incident report carefully:
${combinedText}

Rules:
1. Mark "isSpam: true" if:
   - The text does NOT make any sense (e.g. keyboard smashing like "asdfghjk", "qwerpoiu", random characters, repetitive nonsense like "blah blah blah test 12345678", incoherent word salads with no grammatical or logical meaning).
   - The text is commercial advertisement, marketing, crypto/scam promotion, SEO links, or unsolicited spam.
   - The text is abusive gibberish, trolling, or completely irrelevant nonsensical garbage that has nothing to do with any civic or municipal concern.
2. Mark "isSpam: false" if:
   - The report is a legitimate or plausible civic/infrastructure complaint (e.g. pothole, broken streetlight, garbage heap, water leakage, damaged road, traffic problem, flooding), even if brief, informal, has minor typos, or is in colloquial language.

Respond ONLY with a JSON object in this format:
{
  "isSpam": boolean,
  "reason": "Clear explanation of why it was flagged as spam (e.g. 'Text does not make sense: incoherent keyboard mash / gibberish') or why it was determined legitimate",
  "confidence": number between 0.0 and 1.0
}`;

  // Try gemini-3.8-flash first, then gemini-3.1-flash-lite
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSpam: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['isSpam', 'reason', 'confidence'],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return {
          isSpam: Boolean(parsed.isSpam),
          reason: String(parsed.reason || (parsed.isSpam ? 'Flagged by automated AI spam filter' : 'Legitimate civic report')),
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.9)),
        };
      }
    } catch (err: any) {
      console.warn(`[AI Spam Filter] Model ${model} returned error:`, err?.message || err);
      // continue to next model
    }
  }

  // Heuristic semantic and entropy fallback if AI endpoint experiences transient spike
  return heuristicSpamCheck(title, description);
}

// Fallback heuristic check if AI model encounters transient network issues
function heuristicSpamCheck(title: string, description: string = ''): { isSpam: boolean; reason: string; confidence: number } {
  const combined = `${title} ${description}`.trim();
  const lower = combined.toLowerCase();

  // 1. Extreme keyboard smash / repeated characters (e.g. "asdfasdf", "aaaaaaa", "zxcvbnm")
  if (/([a-zA-Z0-9])\1{4,}/.test(combined)) {
    return {
      isSpam: true,
      reason: 'Automated filter detected repetitive character mashing with no sensible meaning',
      confidence: 0.95,
    };
  }

  // 2. Typical keyboard smash regex patterns
  const keyboardPatterns = [
    /asdf/i, /hjkl/i, /qwerty/i, /zxcv/i, /123456/i, /qwer/i, /lkjh/i, /poiuy/i, /mnbvc/i
  ];
  const smashMatches = keyboardPatterns.filter((p) => p.test(lower));
  if (smashMatches.length >= 2 || (smashMatches.length >= 1 && combined.length < 25 && !/(road|street|light|water|pipe|pothole|waste|garbage|drain)/i.test(lower))) {
    return {
      isSpam: true,
      reason: 'Automated filter detected keyboard mash patterns that do not make sense',
      confidence: 0.92,
    };
  }

  // 3. Vowel-to-consonant ratio check for words > 6 chars (gibberish detector)
  const words = combined.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  let gibberishWords = 0;
  for (const w of words) {
    if (w.length >= 6) {
      const vowels = (w.match(/[aeiouyAEIOUY]/g) || []).length;
      const ratio = vowels / w.length;
      if (ratio < 0.12 || ratio > 0.85) {
        gibberishWords++;
      }
    }
  }
  if (words.length > 0 && gibberishWords / words.length >= 0.5) {
    return {
      isSpam: true,
      reason: 'Automated filter detected incoherent non-word gibberish clusters',
      confidence: 0.88,
    };
  }

  // 4. Commercial spam phrases
  const spamKeywords = [
    'buy cheap', 'casino', 'viagra', 'crypto', 'bitcoin', 'telegram @', 'whatsapp +', 'free bonus', 'porn', 'seo rank'
  ];
  for (const kw of spamKeywords) {
    if (lower.includes(kw)) {
      return {
        isSpam: true,
        reason: `Automated filter flagged commercial promotional spam ("${kw}")`,
        confidence: 0.98,
      };
    }
  }

  // Default: legitimate civic report
  return {
    isSpam: false,
    reason: 'Verified coherent civic report',
    confidence: 0.85,
  };
}

// API Routes
app.post('/api/filter-spam', async (req, res) => {
  try {
    const { title, description, category, address } = req.body;
    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description required for spam evaluation' });
    }

    const result = await classifyIncidentText({ title, description, category, address });
    return res.json(result);
  } catch (error: any) {
    console.error('Spam filter API error:', error);
    const fallback = heuristicSpamCheck(req.body.title || '', req.body.description || '');
    return res.json(fallback);
  }
});

app.post('/api/batch-filter-spam', async (req, res) => {
  try {
    const { issues } = req.body;
    if (!Array.isArray(issues)) {
      return res.status(400).json({ error: 'Expected issues array' });
    }

    // Process batch (up to 20 at a time)
    const results = await Promise.all(
      issues.slice(0, 30).map(async (iss) => {
        try {
          const evalResult = await classifyIncidentText({
            title: iss.title || '',
            description: iss.description || '',
            category: iss.category || 'other',
            address: iss.address || '',
          });
          return {
            id: iss.id,
            ...evalResult,
          };
        } catch {
          const fallback = heuristicSpamCheck(iss.title || '', iss.description || '');
          return {
            id: iss.id,
            ...fallback,
          };
        }
      })
    );

    return res.json({ results });
  } catch (error: any) {
    console.error('Batch spam filter API error:', error);
    return res.status(500).json({ error: 'Batch processing failed' });
  }
});

// Mount Vite or static build
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
