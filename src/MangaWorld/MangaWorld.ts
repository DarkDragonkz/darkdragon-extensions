import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    Request,
    Response,
    SourceIntents,
    HomeSectionType,
    App
} from '@paperback/types';
import { MangaWorldParser } from './MangaWorldParser';

const MW_DOMAIN = 'https://www.mangaworld.mx';

export const MangaWorldInfo: SourceInfo = {
    version: '1.0.1',
    name: 'MangaWorld',
    icon: 'icon.png',
    author: 'Paperback Community',
    authorWebsite: 'https://github.com/paperback-community',
    description: 'Estensione per MangaWorld (Scan ITA) basata su estrazione JSON diretta.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: MW_DOMAIN,
    sourceTags: [
        { text: 'Italiano', type: 'badge' },
        { text: 'Scan', type: 'badge' }
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
};

export class MangaWorld extends Source {
    private parser = new MangaWorldParser();

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...request.headers,
                    'Referer': MW_DOMAIN,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                };
                return request;
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response;
            }
        }
    });

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = App.createRequest({
            url: `${MW_DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const data = this.parser.extractMcData(response.data);
        
        // Fallback: se il JSON fallisce, si potrebbe implementare un parsing HTML qui
        if (!data) throw new Error('Failed to extract JSON data from MangaWorld');

        return this.parser.parseMangaDetails(data, mangaId);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${MW_DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const data = this.parser.extractMcData(response.data);

        return this.parser.parseChapterList(data, mangaId);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // Costruzione URL di lettura: necessita di un path valido.
        // MangaId è tipo "1708/one-piece".
        const url = `${MW_DOMAIN}/manga/${mangaId}/read/${chapterId}`;

        const request = App.createRequest({
            url: url,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const data = this.parser.extractMcData(response.data);

        return this.parser.parseChapterDetails(data, mangaId, chapterId);
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: MW_DOMAIN,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const data = this.parser.extractMcData(response.data);

        // 1. Popular Section
        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'In Tendenza',
            containsMoreItems: false,
            type: HomeSectionType.singleRowLarge
        });
        popularSection.items = this.parser.parseHomeSection(data, 'popular');
        sectionCallback(popularSection);

        // 2. Latest Section
        const latestSection = App.createHomeSection({
            id: 'latest',
            title: 'Ultime Aggiunte',
            containsMoreItems: true,
            type: HomeSectionType.simpleRow
        });
        latestSection.items = this.parser.parseHomeSection(data, 'latest');
        sectionCallback(latestSection);
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page || 1;
        const searchUrl = `${MW_DOMAIN}/archive?keyword=${encodeURIComponent(query.title || '')}&page=${page}`;

        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        
        const results = this.parser.parseSearchResults($);

        return App.createPagedResults({
            results: results,
            metadata: { page: page + 1 }
        });
    }
}