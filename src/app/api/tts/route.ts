import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const googleKey = process.env.GOOGLE_TTS_API_KEY;

    if (googleKey) {
      try {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text },
              voice: {
                languageCode: 'hi-IN',
                name: 'hi-IN-Neural2-A',
                ssmlGender: 'FEMALE'
              },
              audioConfig: { audioEncoding: 'MP3' }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            audioContent: data.audioContent,
            source: 'google-neural2-hindi'
          });
        }
      } catch (e) {
        console.warn('Google TTS call failed, using client-side synthesis', e);
      }
    }

    // Default: client side SpeechSynthesis indicator
    return NextResponse.json({
      success: true,
      text,
      source: 'client-speech-synthesis',
      voiceCode: 'hi-IN'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
