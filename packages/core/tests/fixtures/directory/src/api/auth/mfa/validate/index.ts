import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  HttpRequestWithTables,
  HttpRequestWithUser,
  isValidRequest,
} from "@calatrava/middleware";
import { User } from "tsbs";
import {
  getTables,
  getUser,
  commonHeaders,
  attachCommonHeaders,
  validateMagicLinkCode,
  HttpRequestWithMagicLinkResult,
} from "@architect/shared/middleware";
import { Route } from "@calatrava/request-response";
import { encodeAccessToken, encodeRefreshToken } from "@architect/shared/token";
import {
  ExpirableTables,
  MagicLinkCode,
  MagicLinkRateLimit,
  Tables,
} from "@architect/shared/types";
import * as OTPAuth from "otpauth";
import { otpConfigBase } from "@architect/shared/otp";
import { createFakeUser } from "@architect/shared/auth";
import { mfaValidateRequestSchema } from "@architect/shared/request-schemas";
import { DBKeys } from "@calatrava/datawrapper";

class Handler {
  @Route({
    open: true,
    summary: "",
    description: "",
    path: "/auth/mfa/validate",
    tags: ["Auth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "MfaValidateRequest",
    responseSchema: "MfaValidateResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [400], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(mfaValidateRequestSchema, attachCommonHeaders),
      validateMagicLinkCode,
      async function http(
        req: HttpRequestWithMagicLinkResult
      ): Promise<HttpResponse> {
        try {
          let failed = false;
          const {
            tables,
            magicLinkSuccess,
            magicLinkCode,
            magicLinkRateLimit,
          } = req;
          const { email: submittedEmail, mfaCode } = req.body;

          const usersTable = tables.get<User>(Tables.Users);

          const magicLinksTable = tables.get<MagicLinkCode>(
            ExpirableTables.MagicLinkCodes,
            "ttl"
          );

          const magicLinkRateLimitsTable = tables.get<MagicLinkRateLimit>(
            ExpirableTables.MagicLinkRateLimits,
            "ttl"
          );

          const user = await usersTable.getByIndex(
            {
              email: submittedEmail,
            },
            DBKeys.Sort
          );

          const { mfaSecretKey, name, userId, email } =
            user || createFakeUser();

          const totp = new OTPAuth.TOTP({
            ...otpConfigBase,
            secret: mfaSecretKey,
            label: email,
          });

          if (totp.validate({ token: mfaCode, window: 1 }) === null) {
            //TODO: log failure
            failed = true;
          }

          if (failed || !magicLinkSuccess) {
            return attachCommonHeaders({
              statusCode: 400,
            });
          }

          await Promise.all([
            magicLinksTable.remove(
              {
                userId: userId,
              },
              { createdAt: magicLinkCode.createdAt }
            ),
            magicLinkRateLimitsTable.remove(
              {
                userId: userId,
              },
              { createdAt: magicLinkRateLimit.createdAt }
            ),
          ]);

          return attachCommonHeaders({
            statusCode: 200,
            json: {
              accessToken: encodeAccessToken(user),
              refreshToken: encodeRefreshToken(user),
              user: {
                email,
                name: user.name,
                userId: user.userId,
              },
            },
          });
        } catch (e) {
          console.log("Unhandled Error: ");
          console.log(e);
          return {
            statusCode: 500,
          };
        }
      }
    );
  }
}

exports.handler = Handler.get();
