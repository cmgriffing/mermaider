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
const middleware_3 = require("@architect/shared/middleware");
const request_schemas_1 = require("@architect/shared/request-schemas");
const types_1 = require("@architect/shared/types");
const datawrapper_1 = require("@calatrava/datawrapper");
const utils_1 = require("@architect/shared/utils");
const nanoid_1 = require("@architect/shared/nanoid");
class Handler {
    static get() {
        return arc.http.async(middleware_2.getTables, (0, middleware_1.isValidRequest)(request_schemas_1.mfaNextRequestSchema), middleware_3.validateMagicLinkCode, function http(req) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const { tables, magicLinkSuccess } = req;
                    const { email } = req.body;
                    const usersTable = tables.get(types_1.Tables.Users);
                    const magicLinksTable = tables.get(types_1.ExpirableTables.MagicLinkCodes, "ttl");
                    // fetch user
                    const user = yield usersTable.getByIndex({
                        email,
                    }, datawrapper_1.DBKeys.Sort);
                    const existingMagicLink = yield magicLinksTable.getById({
                        userId: (user === null || user === void 0 ? void 0 : user.userId) || email,
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
                        yield utils_1.mockDBRequest;
                        return (0, middleware_2.attachCommonHeaders)({
                            statusCode: 400,
                        });
                    }
                    const newMagicLinkCode = (0, nanoid_1.nanoid)();
                    yield magicLinksTable.update({ userId: user.userId }, {
                        magicLinkCode: newMagicLinkCode,
                    }, { createdAt: existingMagicLink.createdAt });
                    let nextStep = "validate";
                    if (!user.mfaSecretKey || !user.mfaRecoveryCode) {
                        nextStep = "setup";
                    }
                    return (0, middleware_2.attachCommonHeaders)({
                        statusCode: 200,
                        json: {
                            magicLinkCode: newMagicLinkCode,
                            nextStep,
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
        requestSchema: "MfaNextRequest",
        responseSchema: "MfaNextResponse",
        errorSchema: "EmptyResponse",
        definedErrors: [400], // ADD EXTRA RESPONSE CODES
    })
], Handler, "get", null);
exports.handler = Handler.get();
//# sourceMappingURL=index.js.map