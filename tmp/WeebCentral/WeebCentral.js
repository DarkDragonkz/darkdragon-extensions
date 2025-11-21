"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeebCentral = exports.WeebCentralInfo = void 0;
const types_1 = require("@paperback/types");
const WeebCentralParser_1 = require("./WeebCentralParser");
const helper_1 = require("../helper");
const DOMAIN = 'https://weebcentral.com';
exports.WeebCentralInfo = {
    version: '1.0.10',
    name: 'WeebCentral',
    icon: 'icon.png',
    author: 'DarkDragonkz',
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
    // --- LOGICA DI RICERCA CORRETTA ---
    async getSearchResults(query, metadata) {
        const request = this.constructSearchRequest(query);
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const manga = this.parser.parseSearchResults($);
        return App.createPagedResults({
            results: manga,
            metadata: undefined
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
        // CORREZIONE FINALE:
        // 1. Convertiamo gli spazi in trattini (slug) per la ricerca di titoli composti.
        const encodedText = queryText.replace(/'/g, '').trim().toLowerCase().replace(/ /g, '-');
        const url = new helper_1.URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addPathComponent('data') // Rimuovi questo se la Soluzione 1 fallisce. Per ora, lo conserviamo come dato dall'HTML
            .addQueryParameter('text', encodedText) // Passiamo lo slug
            .addQueryParameter('display_mode', 'Full Display')
            .addQueryParameter('official', 'Any');
        // Questa volta, usiamo il percorso dati completo con il parametro text codificato come slug
        const finalUrl = url.buildUrl();
        return App.createRequest({
            url: finalUrl,
            method: 'GET',
        });
    }
}
exports.WeebCentral = WeebCentral;
//# sourceMappingURL=WeebCentral.js.map