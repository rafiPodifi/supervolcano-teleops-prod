import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

// GET - Fetch all locations
export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    // Query Firestore (source of truth)
    const locationsSnap = await adminDb.collection("locations").get();

    const locations = locationsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        locationId: doc.id,
        name: data.name || "Unnamed",
        address: data.address || "",
        assignedOrganizationId: data.assignedOrganizationId || null,
        assignedOrganizationName: data.assignedOrganizationName || null,
        partnerOrgId: data.partnerOrgId || null,
        contactName: data.contactName || data.primaryContact?.name || null,
        contactPhone: data.contactPhone || data.primaryContact?.phone || null,
        contactEmail: data.contactEmail || data.primaryContact?.email || null,
        accessInstructions: data.accessInstructions || null,
        status: data.status || "active",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        ...data,
      };
    });

    return NextResponse.json({
      success: true,
      locations,
    });
  } catch (error: any) {
    console.error("GET /api/admin/locations error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch locations" },
      { status: 500 },
    );
  }
}

// POST - Create new location
export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/admin/locations - Starting location creation");

    // Auth check
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      console.error("POST /api/admin/locations - No token provided");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      console.error("POST /api/admin/locations - Invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    // Get user email and partner ID from token
    let userEmail = "system";
    let userPartnerId: string | undefined = undefined;
    try {
      // Decode token again to get email and partnerId
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userRecord = await adminAuth.getUser(decodedToken.uid);
      userEmail = userRecord.email || "system";
      // Get partnerId from decoded token (custom claim)
      userPartnerId = (decodedToken as any).partnerId as string | undefined;
      console.log(
        "POST /api/admin/locations - User partnerId from token:",
        userPartnerId,
      );
    } catch (emailError) {
      console.warn(
        "POST /api/admin/locations - Could not fetch user info:",
        emailError,
      );
      // Use fallback
      userEmail = "system";
    }

    // Also get partnerId from claims (already decoded)
    const partnerIdFromClaims = claims.partnerId;
    const finalPartnerId = partnerIdFromClaims || userPartnerId;
    console.log(
      "POST /api/admin/locations - Partner ID from claims:",
      partnerIdFromClaims,
    );
    console.log(
      "POST /api/admin/locations - Final partner ID to use:",
      finalPartnerId,
    );

    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log(
        "POST /api/admin/locations - Request body:",
        JSON.stringify(body, null, 2),
      );
    } catch (parseError) {
      console.error(
        "POST /api/admin/locations - JSON parse error:",
        parseError,
      );
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!body.name) {
      console.error("POST /api/admin/locations - Missing name field");
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 },
      );
    }

    // Auto-assign partnerOrgId from user context if not provided
    // Handle empty strings by checking for truthy values
    const providedPartnerOrgId =
      body.partnerOrgId && body.partnerOrgId.trim() !== ""
        ? body.partnerOrgId
        : null;
    const providedOrgId =
      body.organizationId && body.organizationId.trim() !== ""
        ? body.organizationId
        : null;

    const partnerOrgId =
      providedPartnerOrgId || finalPartnerId || providedOrgId;

    // For superadmins, allow creating locations without partnerOrgId (they can assign later)
    // For other roles, require partnerOrgId
    const isSuperAdmin = claims.role === "superadmin";

    if (!partnerOrgId && !isSuperAdmin) {
      console.error(
        "POST /api/admin/locations - No partnerOrgId available from request or user context",
      );
      console.error("POST /api/admin/locations - User role:", claims.role);
      console.error(
        "POST /api/admin/locations - Provided partnerOrgId:",
        providedPartnerOrgId,
      );
      console.error(
        "POST /api/admin/locations - Final partnerId:",
        finalPartnerId,
      );
      console.error(
        "POST /api/admin/locations - Provided orgId:",
        providedOrgId,
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Partner organization ID is required. Please ensure your account is associated with an organization.",
        },
        { status: 400 },
      );
    }

    // For superadmins without partnerOrgId, use a placeholder that can be updated later
    const finalPartnerOrgId = partnerOrgId || "unassigned";
    if (!partnerOrgId && isSuperAdmin) {
      console.warn(
        "POST /api/admin/locations - Superadmin creating location without partnerOrgId, using placeholder",
      );
    }

    console.log(
      "POST /api/admin/locations - Using partnerOrgId:",
      finalPartnerOrgId,
    );
    console.log("POST /api/admin/locations - Is superadmin:", isSuperAdmin);

    // Prepare location data
    const locationData = {
      name: body.name,
      address: body.address || "",
      addressData: body.addressData || null,
      partnerOrgId: finalPartnerOrgId,
      assignedOrganizationId: providedOrgId || finalPartnerOrgId, // Use provided orgId or fallback to partnerOrgId
      status: "active",
      createdAt: new Date(),
      createdBy: userEmail,
      updatedAt: new Date(),
    };

    console.log(
      "POST /api/admin/locations - Creating location in Firestore:",
      locationData,
    );

    // Create location in Firestore
    const locationRef = await adminDb.collection("locations").add(locationData);
    const locationId = locationRef.id;

    console.log(
      "POST /api/admin/locations - Location created with ID:",
      locationId,
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        locationId: locationId,
        location: {
          id: locationId,
          ...locationData,
          createdAt: locationData.createdAt.toISOString(),
          updatedAt: locationData.updatedAt.toISOString(),
        },
        message: "Location created successfully",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("POST /api/admin/locations - Error:", error);
    console.error("POST /api/admin/locations - Error stack:", error.stack);

    // Return proper JSON error
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create location",
      },
      { status: 500 },
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  );
}
