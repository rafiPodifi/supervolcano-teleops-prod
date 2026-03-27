import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { getUserClaims, requireRole } from '@/lib/utils/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await getAdminAuth().verifyIdToken(token);
    
    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    requireRole(claims, ['superadmin', 'admin', 'partner_admin']);

    const mediaId = params.id;
    const body = await request.json();
    const { reviewStatus } = body;

    if (!reviewStatus || !['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid reviewStatus' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const mediaRef = adminDb.collection('media').doc(mediaId);
    const mediaDoc = await mediaRef.get();

    if (!mediaDoc.exists) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const updateData: any = {
      reviewStatus,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (reviewStatus === 'rejected' && body.rejectionReason) {
      updateData.rejectionReason = body.rejectionReason;
    }

    await mediaRef.update(updateData);

    return NextResponse.json({ success: true, reviewStatus });
  } catch (error: any) {
    console.error('[API] Review update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update review status' },
      { status: 500 }
    );
  }
}

