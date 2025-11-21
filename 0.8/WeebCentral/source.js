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
exports.WeebCentral = exports.WeebCentralInfo = void 0;
const types_1 = require("@paperback/types");
const WeebCentralParser_1 = require("./WeebCentralParser");
const helper_1 = require("../helper");
const DOMAIN = 'https://weebcentral.com';
exports.WeebCentralInfo = {
    version: '1.0.14',
    name: 'WeebCentral',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls manga from ${DOMAIN}`,
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'ENGLISH',
            type: types_1.BadgeColor.BLUE,
        },
    ],
    intents: types_1.SourceIntents.MANGA_CHAPTERS | types_1.SourceIntents.HOMEPAGE_SECTIONS | types_1.SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
};
class WeebCentral {
    constructor(cheerio) {
        this.cheerio = cheerio;
        this.baseUrl = DOMAIN;
        this.parser = new WeebCentralParser_1.WeebCentralParser();
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 5,
            requestTimeout: 20000,
            interceptor: {
                interceptRequest: async (request) => {
                    var _a;
                    request.headers = Object.assign(Object.assign({}, ((_a = request.headers) !== null && _a !== void 0 ? _a : {})), {
                        'referer': `${this.baseUrl}/`,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    });
                    return request;
                },
                interceptResponse: async (response) => {
                    return response;
                }
            }
        });
    }
    getMangaShareUrl(mangaId) {
        return `${this.baseUrl}/series/${mangaId}`;
    }
    async getMangaDetails(mangaId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId);
    }
    async getChapters(mangaId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId);
    }
    async getChapterDetails(mangaId, chapterId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapterDetails($, mangaId, chapterId);
    }
    async getSearchResults(query, metadata) {
        var _a;
        const limit = 32;
        const offset = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.offset) !== null && _a !== void 0 ? _a : 0;
        const url = new helper_1.URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addPathComponent('data')
            .addQueryParameter('limit', limit.toString())
            .addQueryParameter('offset', offset.toString())
            .addQueryParameter('sort', 'Best Match')
            .addQueryParameter('display_mode', 'Full Display')
            .addQueryParameter('official', 'Any');
        if (query.title) {
            url.addQueryParameter('text', query.title);
        }
        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const manga = this.parser.parseSearchResults($);
        // FIX: Definiamo esplicitamente il tipo 'any' per evitare errori TypeScript
        let nextMetadata = undefined;
        if (this.parser.isLastPage($)) {
            nextMetadata = undefined;
        }
        else {
            nextMetadata = { offset: offset + limit };
        }
        return App.createPagedResults({
            results: manga,
            metadata: nextMetadata
        });
    }
    async getHomePageSections(sectionCallback) {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        this.parser.parseHomeSections($, sectionCallback);
    }
    async getViewMoreItems(homepageSectionId, metadata) {
        var _a;
        const page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
        let url = '';
        if (homepageSectionId === 'latest_updates') {
            url = `${this.baseUrl}/latest-updates/${page}`;
        }
        else {
            return App.createPagedResults({ results: [] });
        }
        const request = App.createRequest({
            url: url,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const manga = this.parser.parseSearchResults($);
        if (manga.length > 0) {
            return App.createPagedResults({
                results: manga,
                metadata: { page: page + 1 }
            });
        }
        return App.createPagedResults({ results: [] });
    }
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        });
    }
    constructSearchRequest(query) {
        var _a;
        const queryText = (_a = query === null || query === void 0 ? void 0 : query.title) !== null && _a !== void 0 ? _a : '';
        const url = new helper_1.URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addPathComponent('data')
            .addQueryParameter('text', queryText)
            .addQueryParameter('display_mode', 'Full Display')
            .addQueryParameter('official', 'Any');
        return App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        });
    }
}
exports.WeebCentral = WeebCentral;

},{"../helper":64,"./WeebCentralParser":63,"@paperback/types":61}],63:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeebCentralParser = void 0;
const types_1 = require("@paperback/types");
class WeebCentralParser {
    parseMangaDetails($, mangaId) {
        var _a, _b;
        let title = $('h1').first().text().trim();
        if (!title)
            title = (_a = $('section:has(picture)').first().attr('data-tip')) !== null && _a !== void 0 ? _a : '';
        const image = (_b = $('img[alt$=" cover"]').attr('src')) !== null && _b !== void 0 ? _b : 'https://paperback.moe/icons/logo-alt.svg';
        const desc = $('.whitespace-pre-wrap').text().trim();
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim();
        const statusStr = $('strong:contains("Status")').next('a').text().trim();
        let status = 'Unknown';
        if (statusStr.toLowerCase().includes('ongoing'))
            status = 'Ongoing';
        else if (statusStr.toLowerCase().includes('complete'))
            status = 'Completed';
        const arrayTags = [];
        $('strong:contains("Tags(s)")').nextAll('span').each((_, span) => {
            const a = $('a', span);
            const id = a.text().trim();
            const label = a.text().trim();
            if (id)
                arrayTags.push({ id, label });
        });
        const tagSections = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })];
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc || 'No description available'
            })
        });
    }
    parseChapters($, mangaId) {
        const chapters = [];
        $('a[href*="/chapters/"]').each((_, element) => {
            var _a;
            const href = $(element).attr('href');
            const id = href === null || href === void 0 ? void 0 : href.split('/chapters/')[1];
            let name = $(element).find('span:contains("Chapter"), span:contains("Episode")').first().text().trim();
            if (!name)
                name = $(element).find('.grow span').first().text().trim();
            if (!name)
                name = $(element).text().trim();
            const numMatch = name.match(/(\d+(\.\d+)?)/g);
            const chapNum = numMatch ? parseFloat((_a = numMatch[numMatch.length - 1]) !== null && _a !== void 0 ? _a : '0') : 0;
            const timeStr = $(element).find('time').attr('datetime');
            const time = timeStr ? new Date(timeStr) : new Date();
            if (id) {
                chapters.push(App.createChapter({
                    id: id,
                    name: name,
                    chapNum: chapNum,
                    langCode: 'en',
                    time: time
                }));
            }
        });
        return chapters;
    }
    parseChapterDetails($, mangaId, chapterId) {
        const pages = [];
        $('img').each((_, img) => {
            let src = $(img).attr('src');
            if (!src)
                src = $(img).attr('data-src');
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src);
            }
        });
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    parseSearchResults($) {
        const results = [];
        $('article, div.bg-base-100, a[href*="/series/"]').each((_, item) => {
            var _a, _b;
            let linkElement = $(item);
            if (!linkElement.is('a')) {
                linkElement = $('a[href*="/series/"]', item).first();
            }
            const href = linkElement.attr('href');
            if (!href)
                return;
            const parts = (_a = href.split('/series/')[1]) === null || _a === void 0 ? void 0 : _a.split('/');
            const id = parts === null || parts === void 0 ? void 0 : parts[0];
            let image = $('img', item).attr('src');
            if (!image)
                image = $('img', item).attr('data-src');
            if (!image)
                image = linkElement.find('img').attr('src');
            let title = (_b = $(item).attr('data-tip')) === null || _b === void 0 ? void 0 : _b.trim();
            if (!title) {
                const potentialTitles = [];
                $(item).find('.text-lg, .font-semibold, .font-bold, .text-white').each((_, el) => {
                    const t = $(el).text().trim();
                    if (t && t !== 'Official' && t !== 'Manga' && !t.includes('Chapter')) {
                        potentialTitles.push(t);
                    }
                });
                if (potentialTitles.length > 0)
                    title = potentialTitles[0];
            }
            if (id && title && title !== 'Official') {
                const exists = results.some(m => m.mangaId === id);
                if (!exists) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image !== null && image !== void 0 ? image : '',
                        title: title,
                        subtitle: undefined
                    }));
                }
            }
        });
        return results;
    }
    parseHomeSections($, sectionCallback) {
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const hotManga = [];
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first();
        $('article', hotContainer).each((_, manga) => {
            var _a, _b, _c, _d, _e;
            const link = $('a', manga).attr('href');
            const id = (_c = (_b = (_a = link === null || link === void 0 ? void 0 : link.split('/series/')) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.split('/')) === null || _c === void 0 ? void 0 : _c[0];
            let title = (_d = $(manga).attr('data-tip')) === null || _d === void 0 ? void 0 : _d.trim();
            if (!title)
                title = $('.text-white', manga).first().text().trim();
            const image = (_e = $('img', manga).attr('src')) !== null && _e !== void 0 ? _e : '';
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }));
            }
        });
        hotSection.items = hotManga;
        sectionCallback(hotSection);
        const latestManga = [];
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first();
        $('article', latestContainer).each((_, manga) => {
            var _a, _b, _c, _d, _e;
            const linkElement = $('a[href*="/series/"]', manga);
            const link = linkElement.attr('href');
            const id = (_c = (_b = (_a = link === null || link === void 0 ? void 0 : link.split('/series/')) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.split('/')) === null || _c === void 0 ? void 0 : _c[0];
            let title = (_d = $(manga).attr('data-tip')) === null || _d === void 0 ? void 0 : _d.trim();
            if (!title)
                title = $('.font-semibold.text-lg', manga).text().trim();
            const image = (_e = $('img', manga).attr('src')) !== null && _e !== void 0 ? _e : '';
            const chapter = $('span', manga).last().text().trim();
            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }));
            }
        });
        latestSection.items = latestManga;
        sectionCallback(latestSection);
    }
    isLastPage($) {
        return $(`span:contains("View More Results...")`).length === 0;
    }
}
exports.WeebCentralParser = WeebCentralParser;

},{"@paperback/types":61}],64:[function(require,module,exports){
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

},{}]},{},[62])(62)
});
