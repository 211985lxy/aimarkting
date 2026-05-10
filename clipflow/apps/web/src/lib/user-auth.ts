import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "./prisma"
import { getSubscriptionStatus } from "@/lib/subscription"

const JWT_SECRET =
  process.env.JWT_SECRET || "user-secret-change-me"

interface UserPayload {
  id: string
  email: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signUserToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyUserToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload
  } catch {
    return null
  }
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  return null
}

/**
 * User auth middleware wrapper.
 * Validates user JWT and injects user context into handler.
 */
export function withUserAuth(
  handler: (
    request: NextRequest,
    context: { user: UserPayload; params?: Record<string, string> }
  ) => Promise<NextResponse>,
  options: { requireActivation?: boolean } = {}
) {
  return async (
    request: NextRequest,
    segmentData?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = verifyUserToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user still exists
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    })
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    if (options.requireActivation !== false) {
      const subscriptionStatus = getSubscriptionStatus(dbUser.expiresAt)

      if (subscriptionStatus !== "active") {
        return NextResponse.json(
          {
            error:
              subscriptionStatus === "expired"
                ? "Subscription expired"
                : "Activation required",
            code:
              subscriptionStatus === "expired"
                ? "SUBSCRIPTION_EXPIRED"
                : "ACTIVATION_REQUIRED",
          },
          { status: 403 }
        )
      }
    }

    const params = segmentData ? await segmentData.params : undefined
    return handler(request, { user, params })
  }
}
