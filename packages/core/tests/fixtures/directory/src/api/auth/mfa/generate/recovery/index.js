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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const arc = __importStar(require("@architect/functions"));
const middleware_1 = require("@calatrava/middleware");
const middleware_2 = require("@architect/shared/middleware");
const request_response_1 = require("@calatrava/request-response");
const request_schemas_1 = require("@architect/shared/request-schemas");
const types_1 = require("@architect/shared/types");
const nanoid_1 = require("@architect/shared/nanoid");
const token_1 = require("@architect/shared/token");
const auth_1 = require("@architect/shared/auth");
const otp_1 = require("@architect/shared/otp");
const otpauth_1 = __importDefault(require("otpauth"));
const datawrapper_1 = require("@calatrava/datawrapper");
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.mfaGenerateRecoveryRequestSchema, middleware_2.attachCommonHeaders), middleware_2.validateMagicLinkCode, function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    let failedAuth = false;
                    const { tables, magicLinkSuccess, magicLinkCode, magicLinkRateLimit, } = req;
                    const { email, mfaCode } = req.body;
                    const usersTable = tables.get(types_1.Tables.Users);
                    const magicLinksTable = tables.get(types_1.ExpirableTables.MagicLinkCodes, "ttl");
                    const magicLinkRateLimitsTable = tables.get(types_1.ExpirableTables.MagicLinkRateLimits, "ttl");
                    // fetch user
                    const user = yield usersTable.getByIndex({
                        email,
                    }, datawrapper_1.DBKeys.Sort);
                    const { mfaRecoveryCode: existingMfaRecoveryCode, name, userId, mfaSecretKey, } = user || (0, auth_1.createFakeUser)();
                    console.log("MFA Secret key in generate/recovery", mfaSecretKey);
                    const totp = new otpauth_1.default.TOTP(Object.assign(Object.assign({}, otp_1.otpConfigBase), { secret: mfaSecretKey, label: email }));
                    if (totp.validate({
                        token: mfaCode,
                        timestamp: Date.now(),
                        window: 2,
                    }) === null) {
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
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 400,
                        });
                    }
                    // generate recovery code
                    const mfaRecoveryCode = (0, nanoid_1.apiKeyNanoid)();
                    // store secret key and recovery codes for mfa
                    yield Promise.all([
                        usersTable.update({ userId }, {
                            modifiedAt: Date.now(),
                            mfaRecoveryCode,
                        }, { email }),
                        magicLinksTable.remove({
                            userId: userId,
                        }, { createdAt: magicLinkCode.createdAt }),
                        magicLinkRateLimitsTable.remove({
                            userId: userId,
                        }, { createdAt: magicLinkRateLimit.createdAt }),
                    ]);
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {
                            accessToken: (0, token_1.encodeAccessToken)(user),
                            refreshToken: (0, token_1.encodeRefreshToken)(user),
                            user: {
                                email,
                                name,
                                userId,
                            },
                            mfaRecoveryCode,
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
        path: "/auth/mfa/generate/recovery",
        tags: ["Auth"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "MfaGenerateRecoveryRequest",
        responseSchema: "MfaGenerateRecoveryResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map