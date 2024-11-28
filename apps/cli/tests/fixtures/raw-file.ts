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
import {
  ExpirableTables,
  MagicLinkCode,
  MfaRecoveryCodeRateLimit,
  Tables,
} from "@architect/shared/types";
import { apiKeyNanoid } from "@architect/shared/nanoid";
import { encodeAccessToken, encodeRefreshToken } from "@architect/shared/token";
import { MfaGenerateRecoveryResponse } from "@architect/shared/response-types";
import { MfaRecoverRequest } from "@architect/shared/request-types";
import { tableKeyManager } from "@architect/shared/data";
import { DBKeys } from "@calatrava/datawrapper";
import { mfaRecoverRequestSchema } from "@architect/shared/request-schemas";

const MFA_RECOVERY_CODE_RATE_LIMIT_COUNT = 3;
const THIRTY_MINUTES = 1000 * 60 * 30;

class Handler {
  @Route({
    open: true,
    summary: "",
    description: "",
    path: "/auth/mfa/recover",
    tags: ["Auth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "MfaRecoverRequest",
    responseSchema: "MfaGenerateResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [400], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(mfaRecoverRequestSchema, attachCommonHeaders),
      validateMagicLinkCode,
      async function http(
        req: HttpRequestWithMagicLinkResult,
      ): Promise<HttpResponse> {
        try {
          const now = Date.now();
          const { tables, magicLinkSuccess } = req;
          const { email, mfaRecoveryCode } = req.body as MfaRecoverRequest;

          const usersTable = tables.get<User>(Tables.Users);
          const mfaRecoveryCodeRateLimitsTable =
            tables.get<MfaRecoveryCodeRateLimit>(
              ExpirableTables.MfaRecoveryCodeRateLimits,
            );

          const mfaRecoveryCodeRateLimitTableKeyMethods =
            tableKeyManager.getTable(ExpirableTables.MfaRecoveryCodeRateLimits);

          const {
            userId,
            name,
            mfaRecoveryCode: existingMfaRecoveryCode,
          } = await usersTable.getByIndex({
            email,
          });

          if (!existingMfaRecoveryCode) {
            return attachCommonHeaders({
              statusCode: 401,
            });
          }

          const mfaRecoveryCodeRateLimit =
            await mfaRecoveryCodeRateLimitsTable.getById({
              userId: userId || email,
            });

          if (
            mfaRecoveryCodeRateLimit.count >= MFA_RECOVERY_CODE_RATE_LIMIT_COUNT
          ) {
            return attachCommonHeaders({
              statusCode: 401,
              json: {},
            });
          } else {
            await mfaRecoveryCodeRateLimitsTable.update(
              { userId: userId || email },
              {
                userId: userId || email,
                count: mfaRecoveryCodeRateLimit.count + 1,
              },
              { createdAt: mfaRecoveryCodeRateLimit.createdAt },
            );
          }

          if (mfaRecoveryCode !== existingMfaRecoveryCode) {
            await mfaRecoveryCodeRateLimitsTable.create({
              partitionKey: mfaRecoveryCodeRateLimitTableKeyMethods.getTableKey(
                DBKeys.Partition,
                {
                  userId: userId || email,
                },
              ),
              sortKey: mfaRecoveryCodeRateLimitTableKeyMethods.getTableKey(
                DBKeys.Sort,
                {
                  createdAt: now,
                },
              ),
              userId: userId || email,
              count: 1,
              createdAt: now,
              modifiedAt: now,
              lastSubmittedAt: now,
              TTL: now + THIRTY_MINUTES,
            });

            return attachCommonHeaders({
              statusCode: 401,
            });
          }

          // generate recovery codes
          const newMfaRecoveryCode = apiKeyNanoid();

          // store secret key and recovery codes for mfa
          const updateResult = await usersTable.update(
            { userId },
            {
              modifiedAt: Date.now(),
              mfaRecoveryCode: newMfaRecoveryCode,
            },
            { email },
          );

          const user = {
            email,
            name,
            userId,
          };

          return attachCommonHeaders({
            statusCode: 200,
            json: {
              accessToken: encodeAccessToken(user),
              refreshToken: encodeRefreshToken(user),
              user,
              mfaRecoveryCode: newMfaRecoveryCode,
            } as MfaGenerateRecoveryResponse,
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
