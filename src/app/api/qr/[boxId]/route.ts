import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

// GET /api/qr/[boxId] - Generovat QR kód pro krabici
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { boxId } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${appUrl}/box/${boxId}`;

  // Velikost QR kódu - omezená na 100-1000px (ochrana proti DoS)
  const size = request.nextUrl.searchParams.get('size');
  const parsedSize = size ? parseInt(size) : 330;
  const width = Math.max(100, Math.min(isNaN(parsedSize) ? 330 : parsedSize, 1000));

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      type: 'image/png',
      width,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    // Převést data URL na binární data
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Sanitize boxId pro filename (jen alfanumerické znaky a pomlčky)
    const safeBoxId = String(boxId).replace(/[^a-zA-Z0-9-]/g, '');

    return new Response(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-box-${safeBoxId}.png"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Chyba při generování QR kódu' }, { status: 500 });
  }
}
