import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');

  if (!text) {
    return new NextResponse('Missing text parameter', { status: 400 });
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=vi&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return new NextResponse(`Google TTS returned status: ${response.status}`, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error: unknown) {
    console.error('[TTS API Route Error]:', error);
    return new NextResponse(error instanceof Error ? error.message : 'Internal Server Error', { status: 500 });
  }
}
