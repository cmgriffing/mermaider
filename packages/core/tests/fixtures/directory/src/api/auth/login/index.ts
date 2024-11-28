import * as arc from "@architect/functions";
import { HttpHandler, HttpResponse } from "@architect/functions";

import { User } from "tsbs";

import { DBKeys } from "@calatrava/datawrapper";
import { EmailClient, EmailProvider } from "@calatrava/email";
import { HttpRequestWithTables, isValidRequest } from "@calatrava/middleware";
import { Route } from "@calatrava/request-response";

import {
  MAGIC_LINK_RATE_LIMIT_COUNT,
  MAGIC_LINK_RATE_LIMIT_TTL,
  MAGIC_LINK_TTL,
  NEW_MAGIC_LINK_TTL,
} from "@architect/shared/auth";
import { tableKeyManager } from "@architect/shared/data";
import { emailTemplateIdMap } from "@architect/shared/email/email-template-id-map";
import { EmailTemplate } from "@architect/shared/email/email-templates";
import {
  attachCommonHeaders,
  commonHeaders,
  getTables,
} from "@architect/shared/middleware";
import { nanoid } from "@architect/shared/nanoid";
import { loginRequestSchema } from "@architect/shared/request-schemas";
import { LoginRequest } from "@architect/shared/request-types";
import {
  ExpirableTables,
  MagicLinkCode,
  MagicLinkRateLimit,
  Tables,
} from "@architect/shared/types";
import { mockDBRequest } from "@architect/shared/utils";

const { EMAIL_ACCESS_KEY, CLIENT_BASE_URL } = process.env;

class Handler {
  @Route({
    open: true,
    summary: "",
    description: "",
    path: "/auth/register",
    tags: ["Auth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "LoginRequest",
    responseSchema: "PostUserResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [
      // HTTPStatusCode.BadRequest,
      // HTTPStatusCode.InternalServerError,
      400,
    ],
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(loginRequestSchema, attachCommonHeaders),
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const { tables } = req;
          const now = Date.now();

          const usersTable = tables.get<User>(Tables.Users);
          const usersTableKeyMethods = tableKeyManager.getTable(Tables.Users);

          const magicLinksTable = tables.get<MagicLinkCode>(
            ExpirableTables.MagicLinkCodes,
            "ttl",
          );
          const magicLinksTableKeyMethods = tableKeyManager.getTable(
            ExpirableTables.MagicLinkCodes,
          );

          const magicLinkRateLimitsTable = tables.get<MagicLinkRateLimit>(
            ExpirableTables.MagicLinkRateLimits,
            "ttl",
          );
          const magicLinkRateLimitsTableKeyMethods = tableKeyManager.getTable(
            ExpirableTables.MagicLinkRateLimits,
          );

          const { email } = req.body as LoginRequest;

          let user = await usersTable.getById({ email }, DBKeys.Sort);

          if (!user) {
            const newUserId = nanoid();
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
          } else {
            await mockDBRequest();
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

          const emailClient = new EmailClient(
            {
              provider: EmailProvider.Mailgun,
              accessKey: EMAIL_ACCESS_KEY,
              fromEmail: `no-reply@getwaltr.com`,
              emailTemplateIdMap,
            },
            // true
          );

          const magicLink = `${CLIENT_BASE_URL}/mfa?email=${email}&magic-link-code=${magicLinkCode}`;

          console.log("MAGIC LINK:", magicLink);

          // const sendResult = await emailClient.sendEmail(
          //   email,
          //   // TODO: add email template for magic link
          //   EmailTemplate.MagicLink,
          //   {
          //     magicLink,
          //     subject: "Password Reset request sent from Waltr",
          //   }
          // );

          return attachCommonHeaders({
            statusCode: 200,
            json: {},
          });
        } catch (e) {
          console.log("Unhandled Error: ");
          console.log(e);
          return {
            statusCode: 500,
            json: {},
          };
        }
      },
    );
  }
}

exports.handler = Handler.get();
