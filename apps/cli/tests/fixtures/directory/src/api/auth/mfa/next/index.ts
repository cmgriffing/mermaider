import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import { HttpRequestWithUser, isValidRequest } from "@calatrava/middleware";
import { MfaSetupStep, User } from "tsbs";
import {
  getTables,
  getUser,
  commonHeaders,
  attachCommonHeaders,
} from "@architect/shared/middleware";
import { Route } from "@calatrava/request-response";
import {
  validateMagicLinkCode,
  HttpRequestWithMagicLinkResult,
} from "@architect/shared/middleware";
import { mfaNextRequestSchema } from "@architect/shared/request-schemas";
import {
  Tables,
  ExpirableTables,
  MagicLinkCode,
  TypedHttpResponse,
} from "@architect/shared/types";
import { DBKeys } from "@calatrava/datawrapper";
import { MfaNextRequest } from "@architect/shared/request-types";
import { mockDBRequest } from "@architect/shared/utils";
import { nanoid } from "@architect/shared/nanoid";
import { MfaNextResponse } from "@architect/shared/response-types";

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
    requestSchema: "MfaNextRequest",
    responseSchema: "MfaNextResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [400], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(mfaNextRequestSchema),
      validateMagicLinkCode,
      async function http(
        req: HttpRequestWithMagicLinkResult
      ): Promise<TypedHttpResponse<MfaNextResponse>> {
        try {
          const { tables, magicLinkSuccess } = req;
          const { email } = req.body as MfaNextRequest;

          const usersTable = tables.get<User>(Tables.Users);
          const magicLinksTable = tables.get<MagicLinkCode>(
            ExpirableTables.MagicLinkCodes,
            "ttl"
          );

          // fetch user
          const user = await usersTable.getByIndex(
            {
              email,
            },
            DBKeys.Sort
          );

          const existingMagicLink = await magicLinksTable.getById({
            userId: user?.userId || email,
          });

          let failure = false;

          if (!user) {
            // TODO: log this appropriately
            failure = true;
          }
          if (!magicLinkSuccess) {
            // TODO: log this appropriately
            failure = true;
          }
          if (!existingMagicLink) {
            // TODO: log this appropriately
            failure = true;
          }

          if (failure) {
            await mockDBRequest;

            return attachCommonHeaders({
              statusCode: 400,
            });
          }

          const newMagicLinkCode = nanoid();

          await magicLinksTable.update(
            { userId: user.userId },
            {
              magicLinkCode: newMagicLinkCode,
            },
            { createdAt: existingMagicLink.createdAt }
          );

          let nextStep: MfaSetupStep = "validate";

          if (!user.mfaSecretKey || !user.mfaRecoveryCode) {
            nextStep = "setup";
          }

          return attachCommonHeaders({
            statusCode: 200,
            json: {
              magicLinkCode: newMagicLinkCode,
              nextStep,
            } as MfaNextResponse,
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
