(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sources = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeColor = void 0;
var BadgeColor;
(function (BadgeColor) {
    BadgeColor["BLUE"] = "default";
    BadgeColor["GREEN"] = "success";
    BadgeColor["GREY"] = "info";
    BadgeColor["YELLOW"] = "warning";
    BadgeColor["RED"] = "danger";
})(BadgeColor = exports.BadgeColor || (exports.BadgeColor = {}));

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeSectionType = void 0;
var HomeSectionType;
(function (HomeSectionType) {
    HomeSectionType["singleRowNormal"] = "singleRowNormal";
    HomeSectionType["singleRowLarge"] = "singleRowLarge";
    HomeSectionType["doubleRow"] = "doubleRow";
    HomeSectionType["featured"] = "featured";
})(HomeSectionType = exports.HomeSectionType || (exports.HomeSectionType = {}));

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],5:[function(require,module,exports){
"use strict";
/**
 * Request objects hold information for a particular source (see sources for example)
 * This allows us to to use a generic api to make the calls against any source
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlEncodeObject = exports.convertTime = exports.Source = void 0;
/**
* @deprecated Use {@link PaperbackExtensionBase}
*/
class Source {
    constructor(cheerio) {
        this.cheerio = cheerio;
    }
    /**
     * @deprecated use {@link Source.getSearchResults getSearchResults} instead
     */
    searchRequest(query, metadata) {
        return this.getSearchResults(query, metadata);
    }
    /**
     * @deprecated use {@link Source.getSearchTags} instead
     */
    async getTags() {
        // @ts-ignore
        return this.getSearchTags?.();
    }
}
exports.Source = Source;
// Many sites use '[x] time ago' - Figured it would be good to handle these cases in general
function convertTime(timeAgo) {
    let time;
    let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0]);
    trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed;
    if (timeAgo.includes('minutes')) {
        time = new Date(Date.now() - trimmed * 60000);
    }
    else if (timeAgo.includes('hours')) {
        time = new Date(Date.now() - trimmed * 3600000);
    }
    else if (timeAgo.includes('days')) {
        time = new Date(Date.now() - trimmed * 86400000);
    }
    else if (timeAgo.includes('year') || timeAgo.includes('years')) {
        time = new Date(Date.now() - trimmed * 31556952000);
    }
    else {
        time = new Date(Date.now());
    }
    return time;
}
exports.convertTime = convertTime;
/**
 * When a function requires a POST body, it always should be defined as a JsonObject
 * and then passed through this function to ensure that it's encoded properly.
 * @param obj
 */
function urlEncodeObject(obj) {
    let ret = {};
    for (const entry of Object.entries(obj)) {
        ret[encodeURIComponent(entry[0])] = encodeURIComponent(entry[1]);
    }
    return ret;
}
exports.urlEncodeObject = urlEncodeObject;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRating = exports.SourceIntents = void 0;
var SourceIntents;
(function (SourceIntents) {
    SourceIntents[SourceIntents["MANGA_CHAPTERS"] = 1] = "MANGA_CHAPTERS";
    SourceIntents[SourceIntents["MANGA_TRACKING"] = 2] = "MANGA_TRACKING";
    SourceIntents[SourceIntents["HOMEPAGE_SECTIONS"] = 4] = "HOMEPAGE_SECTIONS";
    SourceIntents[SourceIntents["COLLECTION_MANAGEMENT"] = 8] = "COLLECTION_MANAGEMENT";
    SourceIntents[SourceIntents["CLOUDFLARE_BYPASS_REQUIRED"] = 16] = "CLOUDFLARE_BYPASS_REQUIRED";
    SourceIntents[SourceIntents["SETTINGS_UI"] = 32] = "SETTINGS_UI";
})(SourceIntents = exports.SourceIntents || (exports.SourceIntents = {}));
/**
 * A content rating to be attributed to each source.
 */
var ContentRating;
(function (ContentRating) {
    ContentRating["EVERYONE"] = "EVERYONE";
    ContentRating["MATURE"] = "MATURE";
    ContentRating["ADULT"] = "ADULT";
})(ContentRating = exports.ContentRating || (exports.ContentRating = {}));

},{}],7:[function(require,module,exports){
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./Source"), exports);
__exportStar(require("./ByteArray"), exports);
__exportStar(require("./Badge"), exports);
__exportStar(require("./interfaces"), exports);
__exportStar(require("./SourceInfo"), exports);
__exportStar(require("./HomeSectionType"), exports);
__exportStar(require("./PaperbackExtensionBase"), exports);

},{"./Badge":1,"./ByteArray":2,"./HomeSectionType":3,"./PaperbackExtensionBase":4,"./Source":5,"./SourceInfo":6,"./interfaces":15}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],15:[function(require,module,exports){
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./ChapterProviding"), exports);
__exportStar(require("./CloudflareBypassRequestProviding"), exports);
__exportStar(require("./HomePageSectionsProviding"), exports);
__exportStar(require("./MangaProgressProviding"), exports);
__exportStar(require("./MangaProviding"), exports);
__exportStar(require("./RequestManagerProviding"), exports);
__exportStar(require("./SearchResultsProviding"), exports);

},{"./ChapterProviding":8,"./CloudflareBypassRequestProviding":9,"./HomePageSectionsProviding":10,"./MangaProgressProviding":11,"./MangaProviding":12,"./RequestManagerProviding":13,"./SearchResultsProviding":14}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],30:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],35:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],36:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],37:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],38:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],39:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],41:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],42:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],43:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],44:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],45:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],48:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],49:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],50:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],51:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],52:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],53:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],54:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],55:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],56:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],57:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],58:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],59:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],60:[function(require,module,exports){
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./DynamicUI/Exports/DUIBinding"), exports);
__exportStar(require("./DynamicUI/Exports/DUIForm"), exports);
__exportStar(require("./DynamicUI/Exports/DUIFormRow"), exports);
__exportStar(require("./DynamicUI/Exports/DUISection"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIButton"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIHeader"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIInputField"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUILabel"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUILink"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIMultilineLabel"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUINavigationButton"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIOAuthButton"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUISecureInputField"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUISelect"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUIStepper"), exports);
__exportStar(require("./DynamicUI/Rows/Exports/DUISwitch"), exports);
__exportStar(require("./Exports/ChapterDetails"), exports);
__exportStar(require("./Exports/Chapter"), exports);
__exportStar(require("./Exports/Cookie"), exports);
__exportStar(require("./Exports/HomeSection"), exports);
__exportStar(require("./Exports/IconText"), exports);
__exportStar(require("./Exports/MangaInfo"), exports);
__exportStar(require("./Exports/MangaProgress"), exports);
__exportStar(require("./Exports/PartialSourceManga"), exports);
__exportStar(require("./Exports/MangaUpdates"), exports);
__exportStar(require("./Exports/PBCanvas"), exports);
__exportStar(require("./Exports/PBImage"), exports);
__exportStar(require("./Exports/PagedResults"), exports);
__exportStar(require("./Exports/RawData"), exports);
__exportStar(require("./Exports/Request"), exports);
__exportStar(require("./Exports/SourceInterceptor"), exports);
__exportStar(require("./Exports/RequestManager"), exports);
__exportStar(require("./Exports/Response"), exports);
__exportStar(require("./Exports/SearchField"), exports);
__exportStar(require("./Exports/SearchRequest"), exports);
__exportStar(require("./Exports/SourceCookieStore"), exports);
__exportStar(require("./Exports/SourceManga"), exports);
__exportStar(require("./Exports/SecureStateManager"), exports);
__exportStar(require("./Exports/SourceStateManager"), exports);
__exportStar(require("./Exports/Tag"), exports);
__exportStar(require("./Exports/TagSection"), exports);
__exportStar(require("./Exports/TrackedMangaChapterReadAction"), exports);
__exportStar(require("./Exports/TrackerActionQueue"), exports);

},{"./DynamicUI/Exports/DUIBinding":17,"./DynamicUI/Exports/DUIForm":18,"./DynamicUI/Exports/DUIFormRow":19,"./DynamicUI/Exports/DUISection":20,"./DynamicUI/Rows/Exports/DUIButton":21,"./DynamicUI/Rows/Exports/DUIHeader":22,"./DynamicUI/Rows/Exports/DUIInputField":23,"./DynamicUI/Rows/Exports/DUILabel":24,"./DynamicUI/Rows/Exports/DUILink":25,"./DynamicUI/Rows/Exports/DUIMultilineLabel":26,"./DynamicUI/Rows/Exports/DUINavigationButton":27,"./DynamicUI/Rows/Exports/DUIOAuthButton":28,"./DynamicUI/Rows/Exports/DUISecureInputField":29,"./DynamicUI/Rows/Exports/DUISelect":30,"./DynamicUI/Rows/Exports/DUIStepper":31,"./DynamicUI/Rows/Exports/DUISwitch":32,"./Exports/Chapter":33,"./Exports/ChapterDetails":34,"./Exports/Cookie":35,"./Exports/HomeSection":36,"./Exports/IconText":37,"./Exports/MangaInfo":38,"./Exports/MangaProgress":39,"./Exports/MangaUpdates":40,"./Exports/PBCanvas":41,"./Exports/PBImage":42,"./Exports/PagedResults":43,"./Exports/PartialSourceManga":44,"./Exports/RawData":45,"./Exports/Request":46,"./Exports/RequestManager":47,"./Exports/Response":48,"./Exports/SearchField":49,"./Exports/SearchRequest":50,"./Exports/SecureStateManager":51,"./Exports/SourceCookieStore":52,"./Exports/SourceInterceptor":53,"./Exports/SourceManga":54,"./Exports/SourceStateManager":55,"./Exports/Tag":56,"./Exports/TagSection":57,"./Exports/TrackedMangaChapterReadAction":58,"./Exports/TrackerActionQueue":59}],61:[function(require,module,exports){
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./generated/_exports"), exports);
__exportStar(require("./base/index"), exports);
__exportStar(require("./compat/DyamicUI"), exports);

},{"./base/index":7,"./compat/DyamicUI":16,"./generated/_exports":60}],62:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NineManga = exports.getExportVersion = void 0;
const helper_1 = require("./helper");
const NineMangaParser_1 = require("./NineMangaParser");
const BASE_VERSION = '3.0.0';
const getExportVersion = (EXTENSION_VERSION) => {
    return BASE_VERSION.split('.')
        .map((x, index) => Number(x) + Number(EXTENSION_VERSION.split('.')[index]))
        .join('.');
};
exports.getExportVersion = getExportVersion;
class NineManga {
    constructor(cheerio) {
        this.cheerio = cheerio;
        // FIX: Rimosso UserAgentRandomizer per stabilità Cloudflare
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
            interceptor: {
                interceptRequest: async (request) => {
                    var _a;
                    request.headers = Object.assign(Object.assign({}, ((_a = request.headers) !== null && _a !== void 0 ? _a : {})), {
                        'referer': `${this.baseUrl}/`,
                        // Usa UA di default di Paperback
                    });
                    return request;
                },
                interceptResponse: async (response) => {
                    return response;
                }
            }
        });
        this.alternativeChapterUrl = false;
        this.parser = new NineMangaParser_1.Parser();
        this.RETRIES = 7;
    }
    getMangaShareUrl(mangaId) {
        return `${this.baseUrl}/manga/${mangaId}?waring=1`;
    }
    async supportsTagExclusion() {
        return true;
    }
    async getMangaDetails(mangaId) {
        const request = this.createRequest(`${this.baseUrl}/manga/${mangaId}?waring=1`);
        const response = await this.requestManager.schedule(request, this.RETRIES);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId, this);
    }
    async getChapters(mangaId) {
        const request = this.createRequest(`${this.baseUrl}/manga/${mangaId}?waring=1`);
        const response = await this.requestManager.schedule(request, this.RETRIES);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId, this);
    }
    async getChapterDetails(mangaId, chapterId) {
        const request = App.createRequest({
            url: `${chapterId}-10-1`,
            method: 'GET',
            headers: this.constructHeaders({}),
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapterDetails($, mangaId, chapterId, this);
    }
    async getSearchResults(query, metadata) {
        var _a;
        let page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
        if (page == -1)
            return App.createPagedResults({ results: [], metadata: { page: -1 } });
        const request = this.constructSearchRequest(page, query);
        const response = await this.requestManager.schedule(request, 2);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        const manga = this.parser.parseSearchResults($, this);
        page++;
        if (manga.length < 30)
            page = -1;
        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
        });
    }
    async getTags() {
        const request = this.createRequest(`${this.baseUrl}/search`);
        const response = await this.requestManager.schedule(request, 1);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseTags($);
    }
    async getHomePageSections(sectionCallback) {
        let request = this.createRequest(`${this.baseUrl}`);
        let response = await this.requestManager.schedule(request, this.RETRIES);
        this.checkResponseError(response);
        const $ = this.cheerio.load(response.data);
        request = this.createRequest(`${this.baseUrl}/list/New-Update/`);
        response = await this.requestManager.schedule(request, this.RETRIES);
        this.checkResponseError(response);
        const $$ = this.cheerio.load(response.data);
        await this.parser.parseHomeSections($, $$, sectionCallback, this);
    }
    async getViewMoreItems(_, __) {
        return App.createPagedResults({ results: [], metadata: { page: -1 } });
    }
    convertTime(timeAgo) {
        var _a;
        let time;
        let trimmed = Number(((_a = /\d*/.exec(timeAgo)) !== null && _a !== void 0 ? _a : [])[0]);
        trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed;
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000);
        }
        else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000);
        }
        else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000);
        }
        else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000);
        }
        else {
            time = new Date(timeAgo);
        }
        return time;
    }
    parseStatus(str) {
        let status = 'Unknown';
        switch (str.toLowerCase()) {
            case 'ongoing':
                status = 'Ongoing';
                break;
            case 'completed':
                status = 'Completed';
                break;
        }
        return status;
    }
    createRequest(url) {
        return App.createRequest({
            url,
            method: 'GET',
            headers: this.constructHeaders({}),
        });
    }
    constructSearchRequest(page, query) {
        var _a, _b, _c;
        return App.createRequest({
            url: new helper_1.URLBuilder(this.baseUrl)
                .addPathComponent('search')
                .addQueryParameter('name_sel', 'contain')
                .addQueryParameter('wd', encodeURIComponent((_a = query === null || query === void 0 ? void 0 : query.title) !== null && _a !== void 0 ? _a : ''))
                .addQueryParameter('completed_series', 'either')
                .addQueryParameter('category_id', (_b = query === null || query === void 0 ? void 0 : query.includedTags) === null || _b === void 0 ? void 0 : _b.map((x) => x.id))
                .addQueryParameter('out_category_id', (_c = query === null || query === void 0 ? void 0 : query.excludedTags) === null || _c === void 0 ? void 0 : _c.map((x) => x.id))
                .addQueryParameter('type', 'high')
                .addQueryParameter('page', page.toString())
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        });
    }
    constructHeaders(headers, refererPath) {
        headers = headers !== null && headers !== void 0 ? headers : {};
        headers['accept-language'] = 'es-ES,es;q=0.9,en;q=0.8,gl;q=0.7';
        return headers;
    }
    async getCloudflareBypassRequest() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'user-agent': await this.requestManager.getDefaultUserAgent(),
                referer: `${this.baseUrl}/`,
            },
        });
    }
    checkResponseError(response) {
        const status = response.status;
        switch (status) {
            case 403:
            case 503:
                throw new Error(`CLOUDFLARE BYPASS ERROR:\nPlease go to the homepage of <${this.baseUrl}> and press the cloud icon.`);
            case 404:
                throw new Error(`The requested page ${response.request.url} was not found!`);
        }
    }
}
exports.NineManga = NineManga;

},{"./NineMangaParser":64,"./helper":65}],63:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NineMangaIT = exports.NineMangaITInfo = void 0;
const types_1 = require("@paperback/types");
const NineManga_1 = require("../NineManga");
const IT_DOMAIN = 'https://it.ninemanga.com';
exports.NineMangaITInfo = {
    version: (0, NineManga_1.getExportVersion)('0.0.3'),
    name: 'NineMangaIT',
    description: 'Extension that pulls manga from it.ninemanga.com',
    author: 'NmN',
    authorWebsite: 'http://github.com/pandyenmn',
    icon: 'icon.png',
    contentRating: types_1.ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian',
            type: types_1.BadgeColor.GREY
        },
    ],
    intents: types_1.SourceIntents.MANGA_CHAPTERS | types_1.SourceIntents.HOMEPAGE_SECTIONS | types_1.SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
};
class NineMangaIT extends NineManga_1.NineManga {
    constructor() {
        super(...arguments);
        this.baseUrl = IT_DOMAIN;
        this.languageCode = 'it';
        this.genreTag = 'Genere(s)';
        this.authorTag = 'Author(s)';
        this.statusTag = 'Stato';
    }
    parseStatus(str) {
        let status = 'Unknown';
        switch (str.toLowerCase()) {
            case 'in corso':
                status = 'Ongoing';
                break;
            case 'completato':
                status = 'Completed';
                break;
        }
        return status;
    }
    convertTime(timeAgo) {
        var _a;
        let time;
        let trimmed = Number(((_a = /\d*/.exec(timeAgo)) !== null && _a !== void 0 ? _a : [])[0]);
        trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed;
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000);
        }
        else if (timeAgo.includes('ore') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000);
        }
        else {
            time = new Date(timeAgo);
        }
        return time;
    }
}
exports.NineMangaIT = NineMangaIT;

},{"../NineManga":62,"@paperback/types":61}],64:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const types_1 = require("@paperback/types");
class Parser {
    parseMangaDetails($, mangaId, source) {
        var _a, _b, _c, _d, _e, _f, _g;
        const title = (_a = $('.bookface img').attr('alt')) !== null && _a !== void 0 ? _a : '';
        let image = (_b = $('.bookface img').attr('src')) !== null && _b !== void 0 ? _b : '';
        if (!image || image.includes('logo-alt')) {
            image = (_c = $('.bookface img').attr('data-src')) !== null && _c !== void 0 ? _c : 'https://paperback.moe/icons/logo-alt.svg';
        }
        let desc = (_d = $('.bookintro p').text().trim().replace('Summary:', '')) !== null && _d !== void 0 ? _d : '';
        if (desc == '')
            desc = `No Description provided by the source(${source.baseUrl})`;
        let author = '';
        let status_str = '';
        let hentai = false;
        const arrayTags = [];
        const info = $('.message li').toArray();
        for (const obj of info) {
            const item = $('b', obj).text().trim().replace(':', '');
            switch (item) {
                case source.genreTag:
                    for (const e of $('a', obj).toArray()) {
                        const id = (_f = (_e = $(e).attr('href')) === null || _e === void 0 ? void 0 : _e.replace('/category/', '').replace('.html', '')) !== null && _f !== void 0 ? _f : '';
                        const label = (_g = $(e).text().trim()) !== null && _g !== void 0 ? _g : '';
                        if (['ADULT', 'SMUT', 'MATURE'].includes(id.toUpperCase()))
                            hentai = true;
                        if (!id || !label)
                            continue;
                        arrayTags.push({ id: id, label: label });
                    }
                    break;
                case source.authorTag:
                    author = $('a', obj).text().trim();
                    break;
                case source.statusTag:
                    status_str = $('a', obj).first().text().trim();
                    break;
            }
        }
        const tagSections = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => App.createTag(x)) })];
        const status = source.parseStatus(status_str);
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                rating: 0,
                status,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        });
    }
    parseChapters($, mangaId, source) {
        var _a, _b, _c;
        const chapters = [];
        let prevChapNum = 1;
        const arrChapters = $('.sub_vol_ul li').toArray().reverse();
        for (const obj of arrChapters) {
            const id = (_b = (_a = $('a', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace('.html', '').replace(/\/$/, '')) !== null && _b !== void 0 ? _b : '';
            const name = (_c = $('a', obj).attr('title')) !== null && _c !== void 0 ? _c : '';
            const chapNum = prevChapNum++;
            const time = source.convertTime($('span', obj).text().trim());
            chapters.push(App.createChapter({
                id,
                name,
                chapNum,
                time,
                langCode: source.languageCode,
            }));
        }
        return chapters;
    }
    async parseChapterDetails($, mangaId, id, source) {
        var _a;
        const pages = [];
        const pageArr = $('select#page option').toArray();
        let end = '';
        let i = 0;
        for (const obj of pageArr) {
            const page = (_a = $(obj).attr('value')) !== null && _a !== void 0 ? _a : '';
            if (i == 0)
                end = page;
            if (i > 0 && page == end)
                break;
            const imagesArray = await this.getImage(`${source.baseUrl}${page}`, source);
            for (const image of imagesArray)
                pages.push(image);
            i++;
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        });
    }
    parseSearchResults($, source) {
        var _a, _b, _c, _d, _e, _f;
        const results = [];
        for (const obj of $('.direlist .bookinfo').toArray()) {
            const id = (_b = (_a = $('.bookname', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _b !== void 0 ? _b : '';
            const title = (_c = $('.bookname', obj).text().trim()) !== null && _c !== void 0 ? _c : '';
            const subTitle = (_d = $('.chaptername', obj).text().trim().replace(title, '').trim()) !== null && _d !== void 0 ? _d : '';
            let image = (_e = $('dt img', obj).attr('src')) !== null && _e !== void 0 ? _e : '';
            if (!image)
                image = (_f = $('dt img', obj).attr('data-src')) !== null && _f !== void 0 ? _f : '';
            results.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: subTitle,
            }));
        }
        return results;
    }
    parseTags($) {
        var _a;
        const genres = [];
        for (const obj of $('div.typelist li.cate_list').toArray()) {
            const id = $(obj).attr('cate_id');
            const label = (_a = $(obj).text().trim()) !== null && _a !== void 0 ? _a : '';
            if (!id || !label)
                continue;
            genres.push(App.createTag({ label, id }));
        }
        return [App.createTagSection({ id: '0', label: 'genres', tags: genres })];
    }
    async parseHomeSections($, $$, sectionCallback, source) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        // Definiamo le sezioni come richieste dall'utente
        const sectionAggiornamenti = App.createHomeSection({ id: 'top_update', title: 'In Evidenza', containsMoreItems: false, type: types_1.HomeSectionType.singleRowNormal });
        const sectionPopolari = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: false, type: types_1.HomeSectionType.singleRowNormal });
        const sectionNuovi = App.createHomeSection({ id: 'new', title: 'Nuove Aggiunte', containsMoreItems: false, type: types_1.HomeSectionType.singleRowNormal });
        const sectionRecenti = App.createHomeSection({ id: 'recent', title: 'Ultimi Caricamenti', containsMoreItems: true, type: types_1.HomeSectionType.singleRowNormal });
        const aggiornamenti = [];
        const popolari = [];
        const nuovi = [];
        const recenti = [];
        // 1. PARSING "AGGIORNARE" (Top Slider - .pop_update)
        const arrAggiornamenti = $('.pop_update li').toArray();
        for (const obj of arrAggiornamenti) {
            const href = $('.bookname', obj).attr('href');
            const id = (_a = href === null || href === void 0 ? void 0 : href.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _a !== void 0 ? _a : '';
            // Pulizia del titolo (rimuove la data in rosso se presente)
            let title = (_b = $('.bookface', obj).attr('title')) !== null && _b !== void 0 ? _b : '';
            if (!title)
                title = $('.bookname', obj).text().trim();
            let image = (_c = $('.bookface img', obj).attr('src')) !== null && _c !== void 0 ? _c : '';
            if (id && title) {
                aggiornamenti.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: 'Aggiornato'
                }));
            }
        }
        sectionAggiornamenti.items = aggiornamenti;
        sectionCallback(sectionAggiornamenti);
        // 2. PARSING "POPOLARE" (Rightbox)
        // Cerchiamo l'header che contiene "Popolare" e prendiamo la UL successiva
        const popularHeader = $('.rightbox .ttline').filter((_, e) => $(e).text().includes('Popolare'));
        const popularList = popularHeader.next('ul').find('li').toArray();
        for (const obj of popularList) {
            const link = $('dt a', obj);
            const id = (_e = (_d = link.attr('href')) === null || _d === void 0 ? void 0 : _d.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _e !== void 0 ? _e : '';
            let image = (_f = $('img', link).attr('src')) !== null && _f !== void 0 ? _f : '';
            let title = (_g = $('img', link).attr('alt')) !== null && _g !== void 0 ? _g : '';
            if (!title)
                title = $('dd a.show_book_desc b', obj).text().trim();
            if (id) {
                popolari.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: undefined
                }));
            }
        }
        sectionPopolari.items = popolari;
        sectionCallback(sectionPopolari);
        // 3. PARSING "NUOVO" (Rightbox)
        // Stessa logica: cerchiamo header "Nuovo"
        const newHeader = $('.rightbox .ttline').filter((_, e) => $(e).text().includes('Nuovo'));
        const newList = newHeader.next('ul').find('li').toArray();
        for (const obj of newList) {
            const link = $('dt a', obj);
            const id = (_j = (_h = link.attr('href')) === null || _h === void 0 ? void 0 : _h.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _j !== void 0 ? _j : '';
            let image = (_k = $('img', link).attr('src')) !== null && _k !== void 0 ? _k : '';
            let title = (_l = $('img', link).attr('alt')) !== null && _l !== void 0 ? _l : '';
            if (!title)
                title = $('dd a.show_book_desc b', obj).text().trim();
            if (id) {
                nuovi.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: 'Novità'
                }));
            }
        }
        sectionNuovi.items = nuovi;
        sectionCallback(sectionNuovi);
        // 4. PARSING "ULTIMI AGGIORNAMENTI MANGA" (Lista Centrale - .homeupdate)
        // Nota: Questa sezione nell'HTML non ha immagini (solo testo). Useremo un fallback.
        const arrRecenti = $('.homeupdate li').toArray();
        for (const obj of arrRecenti) {
            const link = $('h1.bookopen a', obj);
            const href = link.attr('href');
            const id = (_m = href === null || href === void 0 ? void 0 : href.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _m !== void 0 ? _m : '';
            const title = link.text().trim();
            const latestChap = $('dl dt a', obj).text().trim();
            // Fallback icona obbligatorio perché l'HTML non ha img qui
            const image = 'https://paperback.moe/icons/logo-alt.svg';
            if (id && title) {
                recenti.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: latestChap
                }));
            }
        }
        sectionRecenti.items = recenti;
        sectionCallback(sectionRecenti);
    }
    filterUpdatedManga($, time, ids, source) {
        var _a, _b, _c;
        let passedReferenceTimePrior = false;
        let passedReferenceTimeCurrent = false;
        const updatedManga = [];
        for (const obj of $('.homeupdate li').toArray()) {
            const id = (_b = (_a = $('a', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _b !== void 0 ? _b : '';
            let mangaTime;
            const timeSelector = (_c = $('dd', obj).text().trim()) !== null && _c !== void 0 ? _c : '';
            // eslint-disable-next-line prefer-const
            mangaTime = source.convertTime(timeSelector !== null && timeSelector !== void 0 ? timeSelector : '');
            // Check if the date is valid, if it isn't we should skip it
            if (!mangaTime.getTime())
                continue;
            passedReferenceTimeCurrent = mangaTime <= time;
            if (!passedReferenceTimeCurrent || !passedReferenceTimePrior) {
                if (ids.includes(id)) {
                    updatedManga.push(id);
                }
            }
            else
                break;
            if (typeof id === 'undefined') {
                throw new Error(`Failed to parse homepage sections for ${source.baseUrl}/${source.homePage}/`);
            }
            passedReferenceTimePrior = passedReferenceTimeCurrent;
        }
        return updatedManga;
    }
    async getImage(url, source) {
        var _a;
        const request = source.createRequest(url);
        const response = await source.requestManager.schedule(request, 3);
        const $ = source.cheerio.load(response.data);
        const arrImages = [];
        const img = $('div.pic_box img.manga_pic').toArray();
        for (const obj of img) {
            const i = (_a = $(obj).attr('src')) !== null && _a !== void 0 ? _a : '';
            arrImages.push(i);
        }
        return arrImages;
    }
}
exports.Parser = Parser;

},{"@paperback/types":61}],65:[function(require,module,exports){
"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLBuilder = void 0;
class URLBuilder {
    constructor(baseUrl) {
        this.parameters = {};
        this.pathComponents = [];
        this.baseUrl = baseUrl.replace(/(^\/)?(?=.*)(\/$)?/gim, '');
    }
    addPathComponent(component) {
        this.pathComponents.push(component.replace(/(^\/)?(?=.*)(\/$)?/gim, ''));
        return this;
    }
    addQueryParameter(key, value) {
        this.parameters[key] = value;
        return this;
    }
    buildUrl({ addTrailingSlash, includeUndefinedParameters } = { addTrailingSlash: false, includeUndefinedParameters: false }) {
        let finalUrl = this.baseUrl + '/';
        finalUrl += this.pathComponents.join('/');
        finalUrl += addTrailingSlash ? '/' : '';
        finalUrl += Object.values(this.parameters).length > 0 ? '?' : '';
        finalUrl += Object.entries(this.parameters).map(entry => {
            if (entry[1] == null && !includeUndefinedParameters) {
                return undefined;
            }
            if (Array.isArray(entry[1])) {
                return `${entry[0]}=` + entry[1].map(value => value || includeUndefinedParameters ? `${value},` : undefined)
                    .filter(x => x !== undefined)
                    .join('');
            }
            if (typeof entry[1] === 'object') {
                return Object.keys(entry[1]).map(key => `${entry[0]}[${key}]=${entry[1][key]}`)
                    .join('&');
            }
            return `${entry[0]}=${entry[1]}`;
        }).filter(x => x !== undefined).join('&');
        return finalUrl;
    }
}
exports.URLBuilder = URLBuilder;

},{}]},{},[63])(63)
});
