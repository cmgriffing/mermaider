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
const token_1 = require("@architect/shared/token");
const types_1 = require("@architect/shared/types");
const OTPAuth = __importStar(require("otpauth"));
const otp_1 = require("@architect/shared/otp");
const auth_1 = require("@architect/shared/auth");
const request_schemas_1 = require("@architect/shared/request-schemas");
const datawrapper_1 = require("@calatrava/datawrapper");
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.mfaValidateRequestSchema, middleware_2.attachCommonHeaders), middleware_2.validateMagicLinkCode, function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    let failed = false;
                    const { tables, magicLinkSuccess, magicLinkCode, magicLinkRateLimit, } = req;
                    const { email: submittedEmail, mfaCode } = req.body;
                    const usersTable = tables.get(types_1.Tables.Users);
                    const magicLinksTable = tables.get(types_1.ExpirableTables.MagicLinkCodes, "ttl");
                    const magicLinkRateLimitsTable = tables.get(types_1.ExpirableTables.MagicLinkRateLimits, "ttl");
                    const user = yield usersTable.getByIndex({
                        email: submittedEmail,
                    }, datawrapper_1.DBKeys.Sort);
                    const { mfaSecretKey, name, userId, email } = user || (0, auth_1.createFakeUser)();
                    const totp = new OTPAuth.TOTP(Object.assign(Object.assign({}, otp_1.otpConfigBase), { secret: mfaSecretKey, label: email }));
                    if (totp.validate({ token: mfaCode, window: 1 }) === null) {
                        //TODO: log failure
                        failed = true;
                    }
                    if (failed || !magicLinkSuccess) {
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 400,
                        });
                    }
                    yield Promise.all([
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
                                name: user.name,
                                userId: user.userId,
                            },
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
        path: "/auth/mfa/validate",
        tags: ["Auth"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "MfaValidateRequest",
        responseSchema: "MfaValidateResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [400], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map