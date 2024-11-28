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
const qrcode_1 = __importDefault(require("qrcode"));
const base_1 = require("@scure/base");
const utils_1 = require("@architect/shared/utils");
const datawrapper_1 = require("@calatrava/datawrapper");
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.mfaGenerateSecretRequestSchema, middleware_2.attachCommonHeaders), middleware_2.validateMagicLinkCode, function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const { tables, magicLinkSuccess } = req;
                    const { email } = req.body;
                    const usersTable = tables.get(types_1.Tables.Users);
                    // fetch user
                    const { userId, mfaSecretKey: existingMfaSecretKey, mfaRecoveryCode, } = yield usersTable.getByIndex({
                        email,
                    }, datawrapper_1.DBKeys.Sort);
                    // create secret key for user mfa
                    const mfaSecretKey = (0, nanoid_1.apiKeyNanoid)();
                    const base32SecretKey = existingMfaSecretKey ||
                        base_1.base32nopad.encode(Buffer.from(mfaSecretKey, "utf8"));
                    const url = `otpauth://totp/Waltr:${email}?secret=${base32SecretKey}&issuer=Waltr`;
                    // generate base64 image of url for app auth
                    const mfaQrCode = yield qrcode_1.default.toDataURL(url);
                    // make sure user hasn't generated already
                    if ((existingMfaSecretKey && mfaRecoveryCode) || !magicLinkSuccess) {
                        yield (0, utils_1.mockDBRequest)();
                        if (existingMfaSecretKey && mfaRecoveryCode) {
                            // log error
                        }
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 400,
                        });
                    }
                    // store secret key and recovery codes for mfa
                    const updateResult = yield usersTable.update({ userId }, {
                        modifiedAt: Date.now(),
                        mfaSecretKey: base32SecretKey,
                    }, { email });
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {
                            url,
                            image: mfaQrCode,
                            mfaSecretKey: base32SecretKey,
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
        path: "/auth/mfa/generate",
        tags: ["Auth"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "MfaGenerateSecretRequest",
        responseSchema: "MfaGenerateSecretResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map