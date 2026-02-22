import { NextRequest, NextResponse } from "next/server";
import { simulateHouseEdge } from "@/app/lib/simulation-fast";
import { HouseRules, DEFAULT_HOUSE_RULES } from "@/app/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numHands, rules } = body as { numHands?: number; rules?: Partial<HouseRules> };

    const hands = numHands || 10000;
    const houseRules: HouseRules = {
      ...DEFAULT_HOUSE_RULES,
      ...rules,
    };

    const result = simulateHouseEdge(hands, houseRules);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 }
    );
  }
}
