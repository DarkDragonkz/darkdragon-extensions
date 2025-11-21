"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaWorld = exports.MangaWorldInfo = void 0;
const types_1 = require("@paperback/types");
const parser_1 = require("./parser");
const helper_1 = require("../helper");
const MW_DOMAIN = 'https://www.mangaworld.mx';
exports.MangaWorldInfo = {
    version: '3.0.6',
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld (0.8).',
    author: 'NmN',
    authorWebsite: 'http://github.com/pandeynmm',
    icon: 'icon.png',
    contentRating: types_1.ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: MW_DOMAIN,
    sourceTags: [
        {
            text: 'ITALIAN',
            type: types_1.BadgeColor.GREY,
        },
    ],
    intents: types_1.SourceIntents.MANGA_CHAPTERS | types_1.SourceIntents.HOMEPAGE_SECTIONS | types_1.SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
};
class MangaWorld {
    constructor(cheerio) {
        this.cheerio = cheerio;
        this.baseUrl = MW_DOMAIN;
        this.RETRIES = 10;
        this.parser = new parser_1.Parser();
        // FIX: Aggiunto Interceptor per gestire Referer e User-Agent automaticamente
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 8,
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
        return `${this.baseUrl}/manga/${mangaId}`;
    }
    async getMangaDetails(mangaId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId);
    }
    async getChapters(mangaId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId, this);
    }
    async getChapterDetails(mangaId, chapterId) {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}/read/${chapterId}/?style=list`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseChapterDetails($, mangaId, chapterId);
    }
    async getTags() {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        return this.parser.parseTags($, this.baseUrl);
    }
    async getSearchResults(query, metadata) {
        var _a;
        let page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
        if (page == -1)
            return App.createPagedResults({ results: [], metadata: { page: -1 } });
        const request = this.constructSearchRequest(page, query);
        const data = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(data.data);
        const manga = this.parser.parseSearchResults($);
        page++;
        if (manga.length < 16)
            page = -1;
        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
        });
    }
    async getHomePageSections(sectionCallback) {
        const request = App.createRequest({
            url: `${this.baseUrl}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        this.parser.parseHomeSections($, sectionCallback);
    }
    async getViewMoreItems(_, metadata) {
        var _a;
        const page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
        const request = App.createRequest({
            url: `${this.baseUrl}/?page=${page}`,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, this.RETRIES);
        const $ = this.cheerio.load(response.data);
        const manga = this.parser.parseViewMore($);
        return App.createPagedResults({
            results: manga,
            metadata: { page: page + 1 },
        });
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
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        });
    }
    constructSearchRequest(page, query) {
        var _a, _b;
        const request = App.createRequest({
            url: new helper_1.URLBuilder(this.baseUrl)
                .addPathComponent('archive')
                .addQueryParameter('keyword', encodeURIComponent((_a = query === null || query === void 0 ? void 0 : query.title) !== null && _a !== void 0 ? _a : ''))
                .addQueryParameter('genre', (_b = query === null || query === void 0 ? void 0 : query.includedTags) === null || _b === void 0 ? void 0 : _b.map((x) => x.id))
                .addQueryParameter('sort', 'most_read')
                .addQueryParameter('page', page.toString())
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        });
        return request;
    }
}
exports.MangaWorld = MangaWorld;
//# sourceMappingURL=MangaWorld.js.map