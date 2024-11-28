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
const datawrapper_1 = require("@calatrava/datawrapper");
const middleware_1 = require("@calatrava/middleware");
const request_response_1 = require("@calatrava/request-response");
// LEAVING OFF: Implement the frontend aspect of things and create the Github app
const auth_1 = require("@architect/shared/auth");
const data_1 = require("@architect/shared/data");
const middleware_2 = require("@architect/shared/middleware");
const nanoid_1 = require("@architect/shared/nanoid");
const request_schemas_1 = require("@architect/shared/request-schemas");
const types_1 = require("@architect/shared/types");
const utils_1 = require("@architect/shared/utils");
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, } = process.env;
const providerMap = {
    github: {
        validate: (code) => __awaiter(void 0, void 0, void 0, function* () {
            const exchangeCodeResponse = yield fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
                body: new URLSearchParams({
                    client_id: GITHUB_CLIENT_ID,
                    client_secret: GITHUB_CLIENT_SECRET,
                    code,
                }),
            });
            const exchangeCodeResponseJson = yield exchangeCodeResponse.json();
            const userInfoResponse = yield fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
                },
            });
            const userInfoResponseJson = yield userInfoResponse.json();
            const userEmailsResponse = yield fetch("https://api.github.com/user/emails", {
                headers: {
                    Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
                },
            });
            // LEAVING OFF: Cannot use an OAUTH App to get emails. Must use a Github App instead.
            // AFTER THAT: Consider creating an OAUTH "table" to track OpenID values and allow users to login with multiple different providers. This would also be more robust against the user changing their "primary" email on a provider.
            // AFTER THAT: Implement other providers besides GitHub
            const userEmailsResponseJson = yield userEmailsResponse.json();
            console.log({ userEmailsResponseJson });
            return {
                email: userInfoResponseJson.email,
            };
        }),
        // validationUrl: "https://github.com/login/oauth/access_token",
    },
    google: {
        validate: (code) => __awaiter(void 0, void 0, void 0, function* () {
            const exchangeCodeResponse = yield fetch("https://www.googleapis.com/oauth2/v3/tokeninfo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    code,
                }),
            });
            const exchangeCodeResponseJson = yield exchangeCodeResponse.json();
            // TODO: Get proper url for user info
            const userInfoResponse = yield fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `token ${exchangeCodeResponseJson.access_token}`,
                },
            });
            const userInfoResponseJson = yield userInfoResponse.json();
            return {
                email: userInfoResponseJson.email,
            };
        }),
        // validationUrl: "https://www.googleapis.com/oauth2/v3/tokeninfo",
    },
    microsoft: {
        validate: (code) => __awaiter(void 0, void 0, void 0, function* () {
            const exchangeCodeResponse = yield fetch("https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: MICROSOFT_CLIENT_ID,
                    client_secret: MICROSOFT_CLIENT_SECRET,
                    code,
                }),
            });
            const exchangeCodeResponseJson = yield exchangeCodeResponse.json();
            const userInfoResponse = yield fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
                },
            });
            const userInfoResponseJson = yield userInfoResponse.json();
            return {
                email: userInfoResponseJson.email,
            };
        }),
        // validationUrl:
        // "https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo",
    },
    twitter: {
        // validationUrl:
        //   "https://login.microsoftonline.com/common/v2.0/oauth2/v2.0/tokeninfo",
        validate: (code) => __awaiter(void 0, void 0, void 0, function* () {
            const exchangeCodeResponse = yield fetch("https://api.twitter.com/2/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: TWITTER_CLIENT_ID,
                    client_secret: TWITTER_CLIENT_SECRET,
                    code,
                }),
            });
            const exchangeCodeResponseJson = yield exchangeCodeResponse.json();
            const userInfoResponse = yield fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${exchangeCodeResponseJson.access_token}`,
                },
            });
            const userInfoResponseJson = yield userInfoResponse.json();
            return {
                email: userInfoResponseJson.email,
            };
        }),
    },
};
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.oauthValidateRequestSchema, middleware_2.attachCommonHeaders), function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const now = Date.now();
                    const { code, provider } = req.body;
                    const usersTable = req.tables.get(types_1.Tables.Users);
                    const usersTableKeyMethods = data_1.tableKeyManager.getTable(types_1.Tables.Users);
                    const magicLinksTable = req.tables.get(types_1.ExpirableTables.MagicLinkCodes, "ttl");
                    const magicLinksTableKeyMethods = data_1.tableKeyManager.getTable(types_1.ExpirableTables.MagicLinkCodes);
                    const magicLinkRateLimitsTable = req.tables.get(types_1.ExpirableTables.MagicLinkRateLimits, "ttl");
                    const magicLinkRateLimitsTableKeyMethods = data_1.tableKeyManager.getTable(types_1.ExpirableTables.MagicLinkRateLimits);
                    if (!providerMap[provider]) {
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 400,
                            json: {},
                        });
                    }
                    const { validate } = providerMap[provider];
                    const { email } = yield validate(code);
                    let user = yield usersTable.getById({ email });
                    if (!user) {
                        const now = Date.now();
                        const newUserId = (0, nanoid_1.nanoid)();
                        // create the user
                        user = yield usersTable.create({
                            partitionKey: usersTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Partition, {
                                userId: newUserId,
                            }),
                            sortKey: usersTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Sort, {
                                email,
                            }),
                            tertiaryKey: usersTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Tertiary, {
                                createdAt: now,
                            }),
                            userId: newUserId,
                            // TODO: maybe sanitize the user name
                            name: email.split("@")[0] || "",
                            email,
                            createdAt: now,
                            modifiedAt: now,
                        });
                    }
                    const { userId } = user;
                    const existingMagicLink = yield magicLinksTable.getById({
                        userId,
                    });
                    const magicLinkRateLimit = yield magicLinkRateLimitsTable.getById({
                        userId,
                    });
                    if (existingMagicLink) {
                        if (existingMagicLink.createdAt + auth_1.NEW_MAGIC_LINK_TTL > now) {
                            yield (0, utils_1.mockDBRequest)();
                        }
                        else {
                            yield magicLinksTable.remove({
                                userId: userId,
                            }, { createdAt: existingMagicLink.createdAt });
                        }
                    }
                    else {
                        yield (0, utils_1.mockDBRequest)();
                    }
                    if (!magicLinkRateLimit) {
                        yield magicLinkRateLimitsTable.create({
                            partitionKey: magicLinkRateLimitsTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Partition, {
                                userId: userId || email,
                            }),
                            sortKey: magicLinkRateLimitsTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Sort, {
                                createdAt: now,
                            }),
                            userId: userId || email,
                            count: 1,
                            createdAt: now,
                            modifiedAt: now,
                            lastRequestedAt: now,
                            TTL: now + auth_1.MAGIC_LINK_RATE_LIMIT_TTL,
                        });
                    }
                    else if ((magicLinkRateLimit === null || magicLinkRateLimit === void 0 ? void 0 : magicLinkRateLimit.count) >= auth_1.MAGIC_LINK_RATE_LIMIT_COUNT) {
                        yield (0, utils_1.mockDBRequest)();
                    }
                    else {
                        yield magicLinkRateLimitsTable.update({ userId }, {
                            userId,
                            count: magicLinkRateLimit.count + 1,
                        }, { createdAt: magicLinkRateLimit.createdAt });
                    }
                    const magicLinkCode = (0, nanoid_1.nanoid)();
                    yield magicLinksTable.create({
                        partitionKey: magicLinksTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Partition, {
                            userId: userId || email,
                        }),
                        sortKey: magicLinksTableKeyMethods.getTableKey(datawrapper_1.DBKeys.Sort, {
                            createdAt: now,
                        }),
                        userId: userId || email,
                        magicLinkCode,
                        createdAt: now,
                        modifiedAt: now,
                        TTL: now + auth_1.MAGIC_LINK_TTL,
                    });
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {
                            email,
                            magicLinkCode,
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
        summary: "SET_ROUTE_SUMMARY",
        description: "SET_ROUTE_DESCRIPTION",
        path: "/SET_PATH_HERE",
        tags: ["SET_TAGS_HERE"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "OauthValidateRequest",
        responseSchema: "OauthValidateResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [400], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map