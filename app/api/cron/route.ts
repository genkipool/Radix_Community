import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const secretFromUrl = url.searchParams.get('secret');
  
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no esta configurado en el servidor' }, { status: 500 });
  }

  // Permite dos métodos de autenticación:
  // 1. Vercel nativo envía "Bearer <CRON_SECRET>"
  // 2. UptimeRobot y cron-job.org usan el parámetro seguro en la URL "?secret=<CRON_SECRET>"
  const isValidCron = authHeader === `Bearer ${expectedSecret}` || secretFromUrl === expectedSecret;

  if (!isValidCron) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Purga la caché en todo Vercel globalmente
    // @ts-ignore - Next.js 15 type definitions experimental
    revalidateTag('validators');
    // @ts-ignore
    revalidateTag('transactions');
    // @ts-ignore
    revalidateTag('entities');
    // @ts-ignore
    revalidateTag('stake-history');

    return NextResponse.json({ 
      success: true, 
      message: 'Caché de Radix revalidada con éxito',
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Hubo un error al revalidar la caché' }, { status: 500 });
  }
}
