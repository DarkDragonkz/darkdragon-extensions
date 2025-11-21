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
        this.userAgentRandomizer = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:77.0) Gecko/20100101 Firefox/78.0${Math.floor(Math.random() * 100000)}`;
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
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
    // QUESTI METODI DEVONO ESSERE DEFINITI NELLA CLASSE BASE PER POTER ESSERE "OVERRIDDEN"
    // O DEVONO ESSERE ASTRATTI SE VOGLIAMO FORZARE L'IMPLEMENTAZIONE.
    // Li definisco come metodi normali che possono essere sovrascritti.
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
    // Aggiunto parseStatus come metodo base per evitare errore di override
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
        if (this.userAgentRandomizer !== '') {
            headers['user-agent'] = this.userAgentRandomizer;
        }
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
//# sourceMappingURL=NineManga.js.map