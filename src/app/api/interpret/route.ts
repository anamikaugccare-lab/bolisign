import { NextResponse } from 'next/server';

interface InterpretBody {
  tokens: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InterpretBody;
    const tokens = body.tokens || [];

    if (tokens.length === 0) {
      return NextResponse.json({
        fluentHindi: 'कोई इशारा नहीं मिला।',
        englishMeaning: 'No sign detected',
        originalTokens: []
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. If Gemini API Key is available, use Gemini 2.0 Flash to synthesize fluent Hindi grammar
    if (apiKey) {
      try {
        const prompt = `You are an expert Indian Sign Language (ISL) to Hindi linguistic translator.
Convert these detected sign language glosses/tokens into a single polite, fluent, natural spoken Hindi sentence in Devanagari script.
Detected Sign Tokens: ${JSON.stringify(tokens)}

Respond ONLY with a JSON object in this exact format:
{
  "fluentHindi": "प्राकृतिक हिंदी वाक्य",
  "englishMeaning": "Natural English translation"
}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (res.ok) {
          const geminiData = await res.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json({
              originalTokens: tokens,
              fluentHindi: parsed.fluentHindi,
              englishMeaning: parsed.englishMeaning
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to rule-based smoothing:', geminiError);
      }
    }

    // 2. Intelligent Linguistic Fallback (Guaranteed to work 100% offline & out-of-the-box)
    const normalized = tokens.map(t => t.trim().toLowerCase()).join(' ');

    let fluentHindi = '';
    let englishMeaning = '';

    if (normalized.includes('नमस्ते') || normalized.includes('namaste')) {
      fluentHindi = 'नमस्ते! आप कैसे हैं?';
      englishMeaning = 'Hello! How are you?';
    } else if (normalized.includes('पानी') || normalized.includes('water')) {
      fluentHindi = 'मुझे पीने के लिए पानी चाहिए।';
      englishMeaning = 'I need water to drink.';
    } else if (normalized.includes('मदद') || normalized.includes('help') || normalized.includes('sos')) {
      fluentHindi = 'कृपया मेरी मदद करें, मुझे तुरंत सहायता चाहिए!';
      englishMeaning = 'Please help me, I need urgent assistance!';
    } else if (normalized.includes('लाइब्रेरी') || normalized.includes('library')) {
      fluentHindi = 'मुझे कॉलेज की लाइब्रेरी जाना है।';
      englishMeaning = 'I want to go to the college library.';
    } else if (normalized.includes('प्रिंसिपल') || normalized.includes('principal')) {
      fluentHindi = 'मुझे प्रिंसिपल सर के ऑफिस जाना है।';
      englishMeaning = 'I need to visit the Principal office.';
    } else if (normalized.includes('अटेंडेंस') || normalized.includes('attendance')) {
      fluentHindi = 'कृपया मेरी आज की अटेंडेंस लगा दीजिए।';
      englishMeaning = 'Please mark my attendance for today.';
    } else if (normalized.includes('डॉक्टर') || normalized.includes('doctor')) {
      fluentHindi = 'मेरी तबियत ठीक नहीं है, मुझे डॉक्टर के पास जाना है।';
      englishMeaning = 'I am not feeling well, please take me to a doctor.';
    } else if (normalized.includes('खाना') || normalized.includes('food')) {
      fluentHindi = 'मुझे भूख लगी है, मुझे खाना चाहिए।';
      englishMeaning = 'I am hungry, I need food.';
    } else if (normalized.includes('धन्यवाद') || normalized.includes('thank')) {
      fluentHindi = 'आपका बहुत-बहुत धन्यवाद!';
      englishMeaning = 'Thank you very much!';
    } else if (normalized.includes('हाँ') || normalized.includes('yes')) {
      fluentHindi = 'हाँ, मैं सहमत हूँ।';
      englishMeaning = 'Yes, I agree.';
    } else if (normalized.includes('नहीं') || normalized.includes('no')) {
      fluentHindi = 'नहीं, मुझे यह नहीं चाहिए।';
      englishMeaning = 'No, I do not want this.';
    } else {
      // General custom word combination
      fluentHindi = tokens.join(' ') + '।';
      englishMeaning = `Signs: ${tokens.join(', ')}`;
    }

    return NextResponse.json({
      originalTokens: tokens,
      fluentHindi,
      englishMeaning
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to interpret sign tokens', details: err.message },
      { status: 500 }
    );
  }
}
