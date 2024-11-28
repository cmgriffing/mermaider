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
import { mfaGenerateSecretRequestSchema } from "@architect/shared/request-schemas";
import { Tables } from "@architect/shared/types";
import { nanoid, apiKeyNanoid } from "@architect/shared/nanoid";
import QRCode from "qrcode";

import { base32nopad } from "@scure/base";
import { MfaGenerateSecretResponse } from "@architect/shared/response-types";
import { MfaGenerateSecretRequest } from "@architect/shared/request-types";
import { mockDBRequest } from "@architect/shared/utils";
import { DBKeys } from "@calatrava/datawrapper";

class Handler {
  @Route({
    open: true,
    summary: "",
    description: "",
    path: "/auth/mfa/generate",
    tags: ["Auth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestSchema: "MfaGenerateSecretRequest",
    responseSchema: "MfaGenerateSecretResponse",
    errorSchema: "EmptyResponse",
    definedErrors: [], // ADD EXTRA RESPONSE CODES
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(mfaGenerateSecretRequestSchema, attachCommonHeaders),
      validateMagicLinkCode,
      async function http(
        req: HttpRequestWithMagicLinkResult
      ): Promise<HttpResponse> {
        try {
          const { tables, magicLinkSuccess } = req;
          const { email } = req.body as MfaGenerateSecretRequest;

          const usersTable = tables.get<User>(Tables.Users);

          // fetch user
          const {
            userId,
            mfaSecretKey: existingMfaSecretKey,
            mfaRecoveryCode,
          } = await usersTable.getByIndex(
            {
              email,
            },
            DBKeys.Sort
          );

          // create secret key for user mfa
          const mfaSecretKey = apiKeyNanoid();

          const base32SecretKey =
            existingMfaSecretKey ||
            base32nopad.encode(Buffer.from(mfaSecretKey, "utf8"));

          const url = `otpauth://totp/Waltr:${email}?secret=${base32SecretKey}&issuer=Waltr`;

          // generate base64 image of url for app auth
          const mfaQrCode = await QRCode.toDataURL(url);

          // make sure user hasn't generated already
          if ((existingMfaSecretKey && mfaRecoveryCode) || !magicLinkSuccess) {
            await mockDBRequest();

            if (existingMfaSecretKey && mfaRecoveryCode) {
              // log error
            }

            return attachCommonHeaders({
              statusCode: 400,
            });
          }

          // store secret key and recovery codes for mfa
          const updateResult = await usersTable.update(
            { userId },
            {
              modifiedAt: Date.now(),
              mfaSecretKey: base32SecretKey,
            },
            { email }
          );

          return attachCommonHeaders({
            statusCode: 200,
            json: {
              url,
              image: mfaQrCode,
              mfaSecretKey: base32SecretKey,
            } as MfaGenerateSecretResponse,
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
