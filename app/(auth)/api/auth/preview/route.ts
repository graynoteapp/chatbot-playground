import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (
    process.env.ENABLE_PREVIEW_AUTH !== "1" ||
    process.env.NODE_ENV === "production"
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (!process.env.AUTH_SECRET) {
    return new Response("AUTH_SECRET is required", { status: 500 });
  }

  const token = await encode({
    token: {
      id: "local-preview-user",
      type: "regular",
      name: "Preview User",
      email: "preview@example.com",
    },
    secret: process.env.AUTH_SECRET,
    salt: "authjs.session-token",
    maxAge: 60 * 60 * 24,
  });

  const response = new NextResponse(null, {
    headers: { Location: "/" },
    status: 307,
  });
  response.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
    secure: false,
  });

  return response;
}
