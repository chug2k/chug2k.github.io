import { createRemoteJWKSet, jwtVerify } from "jose";

const keySets = new Map();
export async function authenticate(request, env) {
  const issuer = env.ACCESS_ISSUER;
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || "") ||
    !env.ACCESS_AUD
  )
    throw Object.assign(
      new Error("The writing room login is not configured yet."),
      { status: 503 },
    );
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token)
    throw Object.assign(new Error("Sign in to the writing room to continue."), {
      status: 401,
    });
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    keySets.set(issuer, keys);
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "email", "exp", "iat"],
    }));
  } catch {
    throw Object.assign(
      new Error(
        "Your writing room session expired. Sign in again; your local recovery copy is safe.",
      ),
      { status: 401 },
    );
  }
  const email = String(payload.email).toLowerCase();
  if (email !== env.ALLOWED_EMAIL)
    throw Object.assign(
      new Error("This account does not have access to the writing room."),
      { status: 403 },
    );
  return { email, name: "Charles" };
}
