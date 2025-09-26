import { searchJobRuns } from "@better-bull-board/clickhouse/crud";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const jobRuns = await searchJobRuns({ id });

    if (!jobRuns || jobRuns.length === 0) {
      return NextResponse.json(
        { error: "Job run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(jobRuns[0]);
  } catch (error) {
    console.error("Error fetching job run:", error);
    return NextResponse.json(
      { error: "Failed to fetch job run" },
      { status: 500 }
    );
  }
}