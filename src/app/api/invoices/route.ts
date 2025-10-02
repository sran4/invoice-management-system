import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import connectDB from "@/lib/db/connection";
import Invoice from "@/lib/db/models/Invoice";
import Customer from "@/lib/db/models/Customer";

// GET /api/invoices - Get paginated invoices for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    await connectDB();

    // Build query
    const query: Record<string, unknown> = { userId: session.user.email };

    // Add search functionality if search term is provided
    if (search) {
      // Optimized search with text index support
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      // First try to find customers matching the search term
      const customerIds = await Customer.find({
        userId: session.user.email,
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { companyName: searchRegex },
        ],
      })
        .select("_id")
        .lean(); // Use lean() for better performance

      const customerIdList = customerIds.map((c) => c._id);

      query.$or = [
        { invoiceNumber: searchRegex },
        { customerId: { $in: customerIdList } },
      ];
    }

    // Add status filter if provided
    if (status && status !== "all") {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const totalCount = await Invoice.countDocuments(query);

    // Get paginated invoices with optimized query
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = NextResponse.json({
      success: true,
      invoices,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
      },
    });

    // Add caching headers for better performance
    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=300"
    );
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error: unknown) {
    console.error("Error fetching invoices:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      items,
      template,
      subtotal,
      tax,
      discount,
      total,
      companyName,
    } = body;

    // Validate required fields
    if (
      !customerId ||
      !invoiceNumber ||
      !issueDate ||
      !items ||
      items.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if invoice number already exists for this user
    const existingInvoice = await Invoice.findOne({
      userId: session.user.email,
      invoiceNumber,
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Invoice number already exists" },
        { status: 400 }
      );
    }

    // Auto-populate companyName from customer if not provided
    let finalCompanyName = companyName;
    if (!finalCompanyName) {
      const customer = await Customer.findById(customerId);
      if (customer && customer.companyName) {
        finalCompanyName = customer.companyName;
      }
    }

    const invoice = new Invoice({
      userId: session.user.email,
      customerId,
      invoiceNumber,
      issueDate: new Date(issueDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
      items,
      template: template || "modern-blue",
      subtotal,
      tax,
      discount,
      total,
      companyName: finalCompanyName,
      status: "draft",
    });

    await invoice.save();

    return NextResponse.json(
      {
        success: true,
        invoice,
        message: "Invoice created successfully",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating invoice:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create invoice", details: errorMessage },
      { status: 500 }
    );
  }
}
