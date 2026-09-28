import { NextResponse } from 'next/server';
import { getAllSigns, saveNewSign, deleteSign, updateSign } from '@/lib/signs-db';

export async function GET() {
  try {
    const signs = getAllSigns();
    return NextResponse.json({
      success: true,
      count: signs.length,
      signs
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nameHindi, nameEnglish, category, landmarksSample, fingerSignature, recordedBy } = body;

    if (!nameHindi) {
      return NextResponse.json({ error: 'nameHindi is required' }, { status: 400 });
    }

    const saved = saveNewSign({
      nameHindi,
      nameEnglish: nameEnglish || nameHindi,
      category: category || 'custom',
      landmarksSample: landmarksSample || [],
      fingerSignature: fingerSignature || undefined,
      recordedBy: recordedBy || 'College Employee'
    });

    return NextResponse.json({
      success: true,
      message: 'नया साइन सफलतापूर्वक सेव हो गया!',
      sign: saved
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, landmarksSample, fingerSignature, nameHindi, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updated = updateSign(id, {
      ...(landmarksSample ? { landmarksSample } : {}),
      ...(fingerSignature ? { fingerSignature } : {}),
      ...(nameHindi ? { nameHindi } : {}),
      ...(category ? { category } : {})
    });

    if (!updated) {
      return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'साइन सफलतापूर्वक अपडेट हो गया!',
      sign: updated
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id param required' }, { status: 400 });
    }

    const deleted = deleteSign(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
