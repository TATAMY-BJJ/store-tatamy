import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import QRCode from 'qrcode';
import JSZip from 'jszip';

// GET /api/qr/all - Stáhnout všechny QR kódy jako ZIP (admin)
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  const { data: boxes, error } = await supabase
    .from('boxes')
    .select('id, name, has_qr')
    .eq('has_qr', true)
    .order('name');

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const zip = new JSZip();

  for (const box of boxes || []) {
    const url = `${appUrl}/box/${box.id}`;
    const safeName = box.name.replace(/[^a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ _-]/g, '');

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        type: 'image/png',
        width: 330,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      const base64 = dataUrl.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      zip.file(`${safeName} (ID ${box.id}).png`, bytes);
    } catch {
      // Přeskočit pokud se QR nepodaří vygenerovat
    }
  }

  const zipData = await zip.generateAsync({ type: 'arraybuffer' });

  return new Response(zipData, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="qr-kody-sklad.zip"',
    },
  });
}
