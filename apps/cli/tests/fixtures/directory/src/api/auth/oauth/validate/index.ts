import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";

import { User } from "tsbs";

import { DBKeys } from "@calatrava/datawrapper";
import { HttpRequestWithTables, isValidRequest } from "@calatrava/middleware";
import { Route } from "@calatrava/request-response";

// LEAVING OFF: Implement the frontend aspect of things and create the Github app
import {
  MAGIC_LINK_RATE_LIMIT_COUNT,
  MAGIC_LINK_RATE_LIMIT_TTL,
  MAGIC_LINK_TTL,
  NEW_MAGIC_LINK_TTL,
} from "@architect/shared/auth";
import { tableKeyManager } from "@architect/shared/data";
import {
  attachCommonHeaders,
  commonHeaders,
  getTables,
} from "@architect/shared/middleware";
import { nanoid } from "@architect/shared/nanoid";
import { oauthValidateRequestSchema } from "@architect/shared/request-schemas";
import { OauthValidateRequest } from "@architect/shared/request-types";
import {
  ExpirableTables,
  MagicLinkCode,
  MagicLinkRateLimit,
  Tables,
} from "@architect/shared/types";
import { mockDBRequest } from "@architect/shared/utils";

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
} = process.env;

type Provider = "github" | "google" | "microsoft" | "twitter";

const providerMap: Record<
  Provider,
  {
    validate: (code: string) => Promise<{ email: string }>;
  }
> = {
  github: {
    validate: async (code: string) => {
      const exchangeCodeResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
          }),
        },
      );

      const exchangeCodeResponseJson = await exchangeCodeResponse.json();

      const userInfoResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
        },
      });

      const userInfoResponseJson = await userInfoResponse.json();

      const userEmailsResponse = await fetch(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
          },
        },
      );

      // LEAVING OFF: Cannot use an OAUTH App to get emails. Must use a Github App instead.
      // AFTER THAT: Consider creating an OAUTH "table" to track OpenID values and allow users to login with multiple different providers. This would also be more robust against the user changing their "primary" email on a provider.
      // AFTER THAT: Implement other providers besides GitHub

      const userEmailsResponseJson = await userEmailsResponse.json();

      console.log({ userEmailsResponseJson });

      return {
        email: userInfoResponseJson.email,
      };
    },
    // validationUrl: "https://github.com/login/oauth/access_token",
  },
  google: {
    validate: async (code: string) => {
      const exchangeCodeResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/tokeninfo",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
          }),
        },
      );

      const exchangeCodeResponseJson = await exchangeCodeResponse.json();

      // TODO: Get proper url for user info
      const userInfoResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${exchangeCodeResponseJson.access_token}`,
        },
      });

      const userInfoResponseJson = await userInfoResponse.json();

      return {
        email: userInfoResponseJson.email,
      };
    },
    // validationUrl: "https://www.googleapis.com/oauth2/v3/tokeninfo",
  },
  microsoft: {
    validate: async (code: string) => {
      const exchangeCodeResponse = await fetch(
        "https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            code,
          }),
        },
      );

      const exchangeCodeResponseJson = await exchangeCodeResponse.json();

      const userInfoResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
        },
      });

      const userInfoResponseJson = await userInfoResponse.json();

      return {
        email: userInfoResponseJson.email,
      };
    },
    // validationUrl:
    // "https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo",
  },
  twitter: {
    // validationUrl:
    //   "https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo",
    validate: async (code: string) => {
      const exchangeCodeResponse = await fetch(
        "https://api.twitter.com/2/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: TWITTER_CLIENT_ID,
            client_secret: TWITTER_CLIENT_SECRET,
            code,
          }),
        },
      );

      const exchangeCodeResponseJson = await exchangeCodeResponse.json();

      const userInfoResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
        },
      });

      const userInfoResponseJson = await userInfoResponse.json();

      return {
        email: userInfoResponseJson.email,
      };
    },
  },
};

class Handler {
  @Route({
    summary: "SET_ROUTE_SUMMARY",
    description: "SET_ROUTE_DESCRIPTION",
    path: "/SET_PATH_HERE",
    tags: ["SET_TAGS_HERE"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "OauthValidateRequest",
    responseSchema: "OauthValidateResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [400], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(oauthValidateRequestSchema, attachCommonHeaders),
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const now = Date.now();
          const { code, provider } = req.body as OauthValidateRequest;

          const usersTable = req.tables.get<User>(Tables.Users);
          const usersTableKeyMethods = tableKeyManager.getTable(Tables.Users);

          const magicLinksTable = req.tables.get<MagicLinkCode>(
            ExpirableTables.MagicLinkCodes,
            "ttl",
          );
          const magicLinksTableKeyMethods = tableKeyManager.getTable(
            ExpirableTables.MagicLinkCodes,
          );
          const magicLinkRateLimitsTable = req.tables.get<MagicLinkRateLimit>(
            ExpirableTables.MagicLinkRateLimits,
            "ttl",
          );
          const magicLinkRateLimitsTableKeyMethods = tableKeyManager.getTable(
            ExpirableTables.MagicLinkRateLimits,
          );

          if (!providerMap[provider as Provider]) {
            return attachCommonHeaders({
              statusCode: 400,
              json: {},
            });
          }

          const { validate } = providerMap[provider as Provider];

          const { email } = await validate(code);

          let user = await usersTable.getById({ email });

          if (!user) {
            const now = Date.now();
            const newUserId = nanoid();
            // create the user
            user = await usersTable.create({
              partitionKey: usersTableKeyMethods.getTableKey(DBKeys.Partition, {
                userId: newUserId,
              }),
              sortKey: usersTableKeyMethods.getTableKey(DBKeys.Sort, {
                email,
              }),
              tertiaryKey: usersTableKeyMethods.getTableKey(DBKeys.Tertiary, {
                createdAt: now,
              }),
              userId: newUserId,
              // TODO: maybe sanitize the user name
              name: email.split("@")[0] || "",
              email,
              createdAt: now,
              modifiedAt: now,
            });
          }

          const { userId } = user;

          const existingMagicLink = await magicLinksTable.getById({
            userId,
          });
          const magicLinkRateLimit = await magicLinkRateLimitsTable.getById({
            userId,
          });

          if (existingMagicLink) {
            if (existingMagicLink.createdAt + NEW_MAGIC_LINK_TTL > now) {
              await mockDBRequest();
            } else {
              await magicLinksTable.remove(
                {
                  userId: userId,
                },
                { createdAt: existingMagicLink.createdAt },
              );
            }
          } else {
            await mockDBRequest();
          }

          if (!magicLinkRateLimit) {
            await magicLinkRateLimitsTable.create({
              partitionKey: magicLinkRateLimitsTableKeyMethods.getTableKey(
                DBKeys.Partition,
                {
                  userId: userId || email,
                },
              ),
              sortKey: magicLinkRateLimitsTableKeyMethods.getTableKey(
                DBKeys.Sort,
                {
                  createdAt: now,
                },
              ),
              userId: userId || email,
              count: 1,
              createdAt: now,
              modifiedAt: now,
              lastRequestedAt: now,
              TTL: now + MAGIC_LINK_RATE_LIMIT_TTL,
            });
          } else if (magicLinkRateLimit?.count >= MAGIC_LINK_RATE_LIMIT_COUNT) {
            await mockDBRequest();
          } else {
            await magicLinkRateLimitsTable.update(
              { userId },
              {
                userId,
                count: magicLinkRateLimit.count + 1,
              },
              { createdAt: magicLinkRateLimit.createdAt },
            );
          }

          const magicLinkCode = nanoid();

          await magicLinksTable.create({
            partitionKey: magicLinksTableKeyMethods.getTableKey(
              DBKeys.Partition,
              {
                userId: userId || email,
              },
            ),
            sortKey: magicLinksTableKeyMethods.getTableKey(DBKeys.Sort, {
              createdAt: now,
            }),
            userId: userId || email,
            magicLinkCode,
            createdAt: now,
            modifiedAt: now,
            TTL: now + MAGIC_LINK_TTL,
          });

          return attachCommonHeaders({
            statusCode: 200,
            json: {
              email,
              magicLinkCode,
            },
          });
        } catch (e) {
          console.log("Unhandled Error: ");
          console.log(e);
          return {
            statusCode: 500,
          };
        }
      },
    );
  }
}

exports.handler = Handler.get();
