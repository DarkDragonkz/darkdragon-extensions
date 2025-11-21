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
exports.MangaDex = exports.MangaDexInfo = void 0;
const types_1 = require("@paperback/types");
const helper_1 = require("../helper");
const MangaDexSettings_1 = require("./MangaDexSettings");
const MD_API = 'https://api.mangadex.org';
const MD_UPLOADS = 'https://uploads.mangadex.org';
exports.MangaDexInfo = {
    version: '1.0.0',
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'Extension for MangaDex (API v5)',
    contentRating: types_1.ContentRating.EVERYONE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'MULTI-LANG',
            type: types_1.BadgeColor.BLUE,
        },
    ],
    intents: types_1.SourceIntents.MANGA_CHAPTERS | types_1.SourceIntents.HOMEPAGE_SECTIONS | types_1.SourceIntents.SETTINGS_UI,
};
class MangaDex {
    constructor(cheerio) {
        this.cheerio = cheerio;
        // State Manager per salvare le impostazioni delle lingue
        this.stateManager = App.createSourceStateManager();
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 5,
            requestTimeout: 20000
        });
    }
    // Implementazione Menu Impostazioni
    async getSourceMenu() {
        return new MangaDexSettings_1.MangaDexSettings(this);
    }
    getMangaShareUrl(mangaId) {
        return `https://mangadex.org/title/${mangaId}`;
    }
    async getMangaDetails(mangaId) {
        var _a, _b, _c, _d, _e, _f;
        // Richiediamo anche autore, artista e cover art in una sola chiamata
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const data = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '{}');
        const attributes = data.data.attributes;
        const relationships = data.data.relationships;
        // Titolo (preferisci inglese, altrimenti il primo disponibile)
        const title = (_c = (_b = attributes.title.en) !== null && _b !== void 0 ? _b : Object.values(attributes.title)[0]) !== null && _c !== void 0 ? _c : 'Unknown Title';
        // Descrizione
        const desc = (_e = (_d = attributes.description.en) !== null && _d !== void 0 ? _d : Object.values(attributes.description)[0]) !== null && _e !== void 0 ? _e : '';
        // Autore e Artista
        const authors = relationships.filter((r) => r.type === 'author').map((r) => { var _a; return (_a = r.attributes) === null || _a === void 0 ? void 0 : _a.name; }).filter((n) => n);
        const artists = relationships.filter((r) => r.type === 'artist').map((r) => { var _a; return (_a = r.attributes) === null || _a === void 0 ? void 0 : _a.name; }).filter((n) => n);
        // Copertina
        const coverRel = relationships.find((r) => r.type === 'cover_art');
        const fileName = (_f = coverRel === null || coverRel === void 0 ? void 0 : coverRel.attributes) === null || _f === void 0 ? void 0 : _f.fileName;
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg';
        // Status
        let status = 'Ongoing';
        if (attributes.status === 'completed')
            status = 'Completed';
        if (attributes.status === 'hiatus')
            status = 'Hiatus';
        if (attributes.status === 'cancelled')
            status = 'Cancelled';
        // Tags
        const tags = [App.createTagSection({ id: '0', label: 'Genres', tags: [] })];
        tags[0].tags = attributes.tags.map((tag) => App.createTag({ id: tag.id, label: tag.attributes.name.en }));
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: tags,
                desc: desc
            })
        });
    }
    async getChapters(mangaId) {
        var _a;
        // Recupera le lingue salvate nelle impostazioni
        let languages = await this.stateManager.retrieve('languages');
        if (!languages || languages.length === 0)
            languages = MangaDexSettings_1.DEFAULT_LANGUAGES;
        // Costruisci i parametri per la query
        const url = new helper_1.URLBuilder(MD_API)
            .addPathComponent('manga')
            .addPathComponent(mangaId)
            .addPathComponent('feed')
            .addQueryParameter('limit', '500')
            .addQueryParameter('order[chapter]', 'desc')
            .addQueryParameter('translatedLanguage[]', languages);
        // .addQueryParameter('contentRating[]', ['safe', 'suggestive', 'erotica', 'pornographic']) // Opzionale: mostra tutto
        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const data = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '{}');
        const chapters = [];
        for (const chapter of data.data) {
            const attr = chapter.attributes;
            // Salta capitoli esterni (es. MangaPlus link)
            if (attr.externalUrl)
                continue;
            const lang = attr.translatedLanguage;
            const chapNum = parseFloat(attr.chapter) || 0;
            const title = attr.title ? `${attr.title}` : (attr.chapter ? `Chapter ${attr.chapter}` : 'Oneshot');
            // Aggiungiamo bandiera al titolo per chiarezza se ci sono più lingue
            let flag = '';
            if (lang === 'it')
                flag = '🇮🇹 ';
            else if (lang === 'en')
                flag = '🇬🇧 ';
            else
                flag = `[${lang}] `;
            chapters.push(App.createChapter({
                id: chapter.id,
                name: flag + title,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: lang,
                group: '' // MangaDex ha i gruppi nelle relationships, si potrebbe estrarre ma rallenta
            }));
        }
        return chapters;
    }
    async getChapterDetails(mangaId, chapterId) {
        var _a;
        // 1. Chiedi al server "At-Home" dove trovare le immagini
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const data = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '{}');
        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;
        const fileNames = data.chapter.data; // Usa 'data' per alta qualità, 'dataSaver' per risparmio dati
        const pages = [];
        for (const file of fileNames) {
            pages.push(`${baseUrl}/data/${hash}/${file}`);
        }
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    async getSearchResults(query, metadata) {
        var _a, _b, _c, _d, _e, _f;
        const limit = 20;
        const offset = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.offset) !== null && _a !== void 0 ? _a : 0;
        const url = new helper_1.URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', limit.toString())
            .addQueryParameter('offset', offset.toString())
            .addQueryParameter('title', (_b = query.title) !== null && _b !== void 0 ? _b : '')
            .addQueryParameter('includes[]', 'cover_art') // Per avere la copertina subito
            .addQueryParameter('order[relevance]', 'desc'); // Ordina per rilevanza
        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        const data = JSON.parse((_c = response.data) !== null && _c !== void 0 ? _c : '{}');
        const results = [];
        for (const manga of data.data) {
            const attr = manga.attributes;
            const title = (_e = (_d = attr.title.en) !== null && _d !== void 0 ? _d : Object.values(attr.title)[0]) !== null && _e !== void 0 ? _e : 'Unknown';
            // Trova la copertina nelle relationships
            const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
            const fileName = (_f = coverRel === null || coverRel === void 0 ? void 0 : coverRel.attributes) === null || _f === void 0 ? void 0 : _f.fileName;
            const image = fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg';
            results.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: image,
                title: title,
                subtitle: attr.status
            }));
        }
        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        });
    }
    async getHomePageSections(sectionCallback) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Sezione 1: Popolari (Titoli con più Follows)
        const section1 = App.createHomeSection({
            id: 'popular',
            title: 'Popular on MangaDex',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal
        });
        sectionCallback(section1);
        // Sezione 2: Ultime Aggiunte (per le lingue selezionate)
        const section2 = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates (Filtered)',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal
        });
        sectionCallback(section2);
        // Recupera Popolari
        const popularUrl = new helper_1.URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[followedCount]', 'desc')
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl();
        const popularRequest = App.createRequest({ url: popularUrl, method: 'GET' });
        const popularResponse = await this.requestManager.schedule(popularRequest, 1);
        const popularData = JSON.parse((_a = popularResponse.data) !== null && _a !== void 0 ? _a : '{}');
        const popularItems = [];
        for (const manga of popularData.data) {
            const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
            const fileName = (_b = coverRel === null || coverRel === void 0 ? void 0 : coverRel.attributes) === null || _b === void 0 ? void 0 : _b.fileName;
            popularItems.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                title: (_d = (_c = manga.attributes.title.en) !== null && _c !== void 0 ? _c : Object.values(manga.attributes.title)[0]) !== null && _d !== void 0 ? _d : 'Unknown',
                subtitle: 'Popular'
            }));
        }
        section1.items = popularItems;
        sectionCallback(section1);
        // Recupera Recenti (Qui servirebbe una logica complessa per prendere i manga dai capitoli, 
        // ma per semplicità prendiamo i manga creati di recente o aggiornati)
        const latestUrl = new helper_1.URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[createdAt]', 'desc') // Manga creati di recente
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl();
        const latestRequest = App.createRequest({ url: latestUrl, method: 'GET' });
        const latestResponse = await this.requestManager.schedule(latestRequest, 1);
        const latestData = JSON.parse((_e = latestResponse.data) !== null && _e !== void 0 ? _e : '{}');
        const latestItems = [];
        for (const manga of latestData.data) {
            const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
            const fileName = (_f = coverRel === null || coverRel === void 0 ? void 0 : coverRel.attributes) === null || _f === void 0 ? void 0 : _f.fileName;
            latestItems.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                title: (_h = (_g = manga.attributes.title.en) !== null && _g !== void 0 ? _g : Object.values(manga.attributes.title)[0]) !== null && _h !== void 0 ? _h : 'Unknown',
                subtitle: 'New Entry'
            }));
        }
        section2.items = latestItems;
        sectionCallback(section2);
    }
    async getViewMoreItems(homepageSectionId, metadata) {
        return App.createPagedResults({ results: [] });
    }
}
exports.MangaDex = MangaDex;

},{"../helper":64,"./MangaDexSettings":63,"@paperback/types":61}],63:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaDexSettings = exports.DEFAULT_LANGUAGES = exports.LANGUAGES = void 0;
const types_1 = require("@paperback/types");
// Lista delle lingue supportate da MangaDex che vogliamo filtrare
exports.LANGUAGES = [
    { id: 'it', name: 'Italiano' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Spanish' },
    { id: 'fr', name: 'French' },
    { id: 'de', name: 'German' },
    { id: 'ja', name: 'Japanese' }
];
exports.DEFAULT_LANGUAGES = ['it', 'en'];
class MangaDexSettings extends types_1.Form {
    async getSections() {
        const sections = [];
        const source = this.source; // Accesso allo state manager della source
        // Ottieni le lingue salvate o usa il default
        let selectedLanguages = await source.stateManager.retrieve('languages');
        if (!selectedLanguages) {
            selectedLanguages = exports.DEFAULT_LANGUAGES;
            await source.stateManager.store('languages', selectedLanguages);
        }
        // Crea una riga switch per ogni lingua
        const languageRows = exports.LANGUAGES.map(lang => {
            return (0, types_1.Switch)(lang.id, {
                label: lang.name,
                value: selectedLanguages.includes(lang.id),
                onValueChange: Application.Selector(this, 'onLanguageChange')
            });
        });
        sections.push((0, types_1.Section)('Languages Filter', languageRows));
        return sections;
    }
    async onLanguageChange(value, context) {
        const source = this.source;
        const langId = context.id;
        let selectedLanguages = await source.stateManager.retrieve('languages');
        if (!selectedLanguages)
            selectedLanguages = exports.DEFAULT_LANGUAGES;
        if (value) {
            // Aggiungi lingua se non c'è
            if (!selectedLanguages.includes(langId))
                selectedLanguages.push(langId);
        }
        else {
            // Rimuovi lingua
            selectedLanguages = selectedLanguages.filter(l => l !== langId);
        }
        // Salva
        await source.stateManager.store('languages', selectedLanguages);
    }
}
exports.MangaDexSettings = MangaDexSettings;

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
