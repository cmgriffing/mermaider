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
  commonHeaders,
  attachCommonHeaders,
  validateMagicLinkCode,
  HttpRequestWithMagicLinkResult,
} from "@architect/shared/middleware";
import { Route } from "@calatrava/request-response";
import { mfaGenerateRecoveryRequestSchema } from "@architect/shared/request-schemas";
import {
  ExpirableTables,
  MagicLinkCode,
  MagicLinkRateLimit,
  Tables,
} from "@architect/shared/types";
import { nanoid, apiKeyNanoid } from "@architect/shared/nanoid";

import { MfaGenerateRecoveryResponse } from "@architect/shared/response-types";
import { encodeAccessToken, encodeRefreshToken } from "@architect/shared/token";
import { MfaGenerateRecoveryRequest } from "@architect/shared/request-types";
import {
  createFakeUser,
  MAGIC_LINK_RATE_LIMIT_COUNT,
} from "@architect/shared/auth";
import { tableKeyManager } from "@architect/shared/data";
import { otpConfigBase } from "@architect/shared/otp";
import OTPAuth from "otpauth";
import { DBKeys } from "@calatrava/datawrapper";
import { mockDBRequest } from "@architect/shared/utils";

class Handler {
  @Route({
    open: true,
    summary: "",
    description: "",
    path: "/auth/mfa/generate/recovery",
    tags: ["Auth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "MfaGenerateRecoveryRequest",
    responseSchema: "MfaGenerateRecoveryResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(mfaGenerateRecoveryRequestSchema, attachCommonHeaders),
      validateMagicLinkCode,
      async function http(
        req: HttpRequestWithMagicLinkResult
      ): Promise<HttpResponse> {
        try {
          let failedAuth = false;

          const {
            tables,
            magicLinkSuccess,
            magicLinkCode,
            magicLinkRateLimit,
          } = req;
          const { email, mfaCode } = req.body as MfaGenerateRecoveryRequest;

          const usersTable = tables.get<User>(Tables.Users);

          const magicLinksTable = tables.get<MagicLinkCode>(
            ExpirableTables.MagicLinkCodes,
            "ttl"
          );

          const magicLinkRateLimitsTable = tables.get<MagicLinkRateLimit>(
            ExpirableTables.MagicLinkRateLimits,
            "ttl"
          );

          // fetch user
          const user = await usersTable.getByIndex(
            {
              email,
            },
            DBKeys.Sort
          );

          const {
            mfaRecoveryCode: existingMfaRecoveryCode,
            name,
            userId,
            mfaSecretKey,
          } = user || createFakeUser();

          console.log("MFA Secret key in generate/recovery", mfaSecretKey);

          const totp = new OTPAuth.TOTP({
            ...otpConfigBase,
            secret: mfaSecretKey,
            label: email,
          });

          if (
            totp.validate({
              token: mfaCode,
              timestamp: Date.now(),
              window: 2,
            }) === null
          ) {
            //TODO: log failure
            console.log("TOTP failed validation");
            failedAuth = true;
          }

          // make sure user hasn't generated already
          if (existingMfaRecoveryCode) {
            console.log("Recovery code already exists");
            //TODO: log failure
            failedAuth = true;
          }

          if (failedAuth || !magicLinkSuccess) {
            return attachCommonHeaders({
              statusCode: 400,
            });
          }

          // generate recovery code
          const mfaRecoveryCode = apiKeyNanoid();

          // store secret key and recovery codes for mfa
          await Promise.all([
            usersTable.update(
              { userId },
              {
                modifiedAt: Date.now(),
                mfaRecoveryCode,
              },
              { email }
            ),
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
                name,
                userId,
              },
              mfaRecoveryCode,
            } as MfaGenerateRecoveryResponse,
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
