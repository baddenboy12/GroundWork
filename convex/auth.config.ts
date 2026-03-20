import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.KEYCLOAK_OIDC_AUTHORITY!,
      applicationID: process.env.KEYCLOAK_OIDC_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
