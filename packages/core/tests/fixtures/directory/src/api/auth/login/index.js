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
const email_1 = require("@calatrava/email");
const middleware_1 = require("@calatrava/middleware");
const request_response_1 = require("@calatrava/request-response");
const auth_1 = require("@architect/shared/auth");
const data_1 = require("@architect/shared/data");
const email_template_id_map_1 = require("@architect/shared/email/email-template-id-map");
const middleware_2 = require("@architect/shared/middleware");
const nanoid_1 = require("@architect/shared/nanoid");
const request_schemas_1 = require("@architect/shared/request-schemas");
const types_1 = require("@architect/shared/types");
const utils_1 = require("@architect/shared/utils");
const { EMAIL_ACCESS_KEY, CLIENT_BASE_URL } = process.env;
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.loginRequestSchema, middleware_2.attachCommonHeaders), function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const { tables } = req;
                    const now = Date.now();
                    const usersTable = tables.get(types_1.Tables.Users);
                    const usersTableKeyMethods = data_1.tableKeyManager.getTable(types_1.Tables.Users);
                    const magicLinksTable = tables.get(types_1.ExpirableTables.MagicLinkCodes, "ttl");
                    const magicLinksTableKeyMethods = data_1.tableKeyManager.getTable(types_1.ExpirableTables.MagicLinkCodes);
                    const magicLinkRateLimitsTable = tables.get(types_1.ExpirableTables.MagicLinkRateLimits, "ttl");
                    const magicLinkRateLimitsTableKeyMethods = data_1.tableKeyManager.getTable(types_1.ExpirableTables.MagicLinkRateLimits);
                    const { email } = req.body;
                    let user = yield usersTable.getById({ email }, datawrapper_1.DBKeys.Sort);
                    if (!user) {
                        const newUserId = (0, nanoid_1.nanoid)();
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
                    else {
                        yield (0, utils_1.mockDBRequest)();
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
                    const emailClient = new email_1.EmailClient({
                        provider: email_1.EmailProvider.Mailgun,
                        accessKey: EMAIL_ACCESS_KEY,
                        fromEmail: `no-reply@getwaltr.com`,
                        emailTemplateIdMap: email_template_id_map_1.emailTemplateIdMap,
                    });
                    const magicLink = `${CLIENT_BASE_URL}/mfa?email=${email}&magic-link-code=${magicLinkCode}`;
                    console.log("MAGIC LINK:", magicLink);
                    // const sendResult = await emailClient.sendEmail(
                    //   email,
                    //   // TODO: add email template for magic link
                    //   EmailTemplate.MagicLink,
                    //   {
                    //     magicLink,
                    //     subject: "Password Reset request sent from Waltr",
                    //   }
                    // );
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {},
                    });
                }
                catch (e) {
                    console.log("Unhandled Error: ");
                    console.log(e);
                    return {
                        statusCode: 500,
                        json: {},
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
        path: "/auth/register",
        tags: ["Auth"],
        headers: Object.assign({}, middleware_2.commonHeaders),
        method: "POST",
        requestSchema: "LoginRequest",
        responseSchema: "PostUserResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [
            // HTTPStatusCode.BadRequest,
            // HTTPStatusCode.InternalServerError,
            400,
        ],
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map