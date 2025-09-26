import { searchJobLogs } from "@better-bull-board/clickhouse/crud";
import { NextRequest, NextResponse } from "next/server";
import { getJobLogsInput } from "./schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobRunId, level, messageContains, limit = 100, offset = 0 } = getJobLogsInput.parse(body);

    const logs = await searchJobLogs({
      jobRunId,
      level,
      messageContains,
      limit,
      offset,
    });

    // For now, we'll return the count of logs as total
    // In a real scenario, you might want to do a separate count query
    const total = logs.length;

    return NextResponse.json({
      logs,
      total,
    });
  } catch (error) {
    console.error("Error fetching job logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch job logs" },
      { status: 500 }
    );
  }
}