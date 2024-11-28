"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const arc = __importStar(require("@architect/functions"));
const middleware_1 = require("@calatrava/middleware");
const middleware_2 = require("@architect/shared/middleware");
const request_response_1 = require("@calatrava/request-response");
const types_1 = require("@architect/shared/types");
const nanoid_1 = require("@architect/shared/nanoid");
const token_1 = require("@architect/shared/token");
const data_1 = require("@architect/shared/data");
const datawrapper_1 = require("@calatrava/datawrapper");
const request_schemas_1 = require("@architect/shared/request-schemas");
const MFA_RECOVERY_CODE_RATE_LIMIT_COUNT = 3;
const THIRTY_MINUTES = 1000 * 60 * 30;
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.mfaRecoverRequestSchema, middleware_2.attachCommonHeaders), middleware_2.validateMagicLinkCode, function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const now = Date.now();
                    const { tables, magicLinkSuccess } = req;
                    const { email, mfaRecoveryCode } = req.body;
                    const usersTable = tables.get(types_1.Tables.Users);
                    const mfaRecoveryCodeRateLimitsTable = tables.get(types_1.ExpirableTables.MfaRecoveryCodeRateLimits);
                    const mfaRecoveryCodeRateLimitTableKeyMethods = data_1.tableKeyManager.getTable(types_1.ExpirableTables.MfaRecoveryCodeRateLimits);
                    const { userId, name, mfaRecoveryCode: existingMfaRecoveryCode, } = yield usersTable.getByIndex({
                        email,
                    });
                    if (!existingMfaRecoveryCode) {
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 401,
                        });
                    }
                    const mfaRecoveryCodeRateLimit = yield mfaRecoveryCodeRateLimitsTable.getById({
                        userId: userId || email,
                    });
                    if (mfaRecoveryCodeRateLimit.count >= MFA_RECOVERY_CODE_RATE_LIMIT_COUNT) {
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 401,
                            json: {},
                        });
                    }
                    else {
                        yield mfaRecoveryCodeRateLimitsTable.update({ userId: userId || email }, {
                            userId: userId || email,
                            count: mfaRecoveryCodeRateLimit.count + 1,
                        }, { createdAt: mfaRecoveryCodeRateLimit.createdAt });
                    }
                    if (mfaRecoveryCode !== existingMfaRecoveryCode) {
                        yield mfaRecoveryCodeRateLimitsTable.create({
                            partitionKey: mfaRecoveryCodeRateLimitTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Partition, {
                                userId: userId || email,
                            }),
                            sortKey: mfaRecoveryCodeRateLimitTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Sort, {
                                createdAt: now,
                            }),
                            userId: userId || email,
                            count: 1,
                            createdAt: now,
                            modifiedAt: now,
                            lastSubmittedAt: now,
                            TTL: now + THIRTY_MINUTES,
                        });
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 401,
                        });
                    }
                    // generate recovery codes
                    const newMfaRecoveryCode = (0, nanoid_1.apiKeyNanoid)();
                    // store secret key and recovery codes for mfa
                    const updateResult = yield usersTable.update({ userId }, {
                        modifiedAt: Date.now(),
                        mfaRecoveryCode: newMfaRecoveryCode,
                    }, { email });
                    const user = {
                        email,
                        name,
                        userId,
                    };
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {
                            accessToken: (0, token_1.encodeAccessToken)(user),
                            refreshToken: (0, token_1.encodeRefreshToken)(user),
                            user,
                            mfaRecoveryCode: newMfaRecoveryCode,
                        },
                    });
                }
                catch (e) {
                    console.log("Unhandled Error: ");
                    console.log(e);
                    return {
                        statusCode: 500,
                    };
                }
            });
        });
    }
}
__decorate([
    (0, request_response_1.Route)({
        open: true,
        summary: "",
        description: "",
        path: "/auth/mfa/recover",
        tags: ["Auth"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "MfaRecoverRequest",
        responseSchema: "MfaGenerateResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [400], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map