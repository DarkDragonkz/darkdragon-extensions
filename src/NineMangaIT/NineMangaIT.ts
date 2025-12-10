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
    TagType,
    Request,
    Response,
} from '@paperback/types'
import { NineMangaITParser } from './NineMangaITParser'

const NINE_MANGA_IT_DOMAIN = 'https://it.ninemanga.com'

export const NineMangaITInfo: SourceInfo = {
    version: '2.0.1',
    name: 'NineMangaIT',
    icon: 'icon.png',
    author: 'Paperback',
    authorWebsite: 'https://github.com/Paperback-iOS',
    description: 'Extension that pulls manga from NineManga IT',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: NINE_MANGA_IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian',
            type: BadgeColor.GREY,
        },
        {
            text: 'Notifications',
            type: BadgeColor.GREEN,
        },
    ],
}

export class NineMangaIT extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': NINE_MANGA_IT_DOMAIN,
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    },
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            },
        },
    })

    baseUrl = NINE_MANGA_IT_DOMAIN
    parser = new NineMangaITParser()

    override async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}.html`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseMangaDetails($, mangaId)
    }

    override async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}.html?warning=1`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapters($, mangaId)
    }

    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // FIX: Aggiunto parametro style=list per caricare tutte le immagini in una pagina
        const request = App.createRequest({
            url: `${this.baseUrl}/chapter/${chapterId}.html`,
            method: 'GET',
            param: '?style=list' 
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        this.parser.parseHomeSections($, $, sectionCallback, this.baseUrl)
    }

    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        // Implementazione di base per evitare errori se richiamato
        return App.createPagedResults({ results: [] })
    }

    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const searchUrl = `${this.baseUrl}/search/?name_sel=contain&wd=${encodeURIComponent(query.title ?? '')}&page=${page}`
        
        const request = App.createRequest({
            url: searchUrl,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        const manga = this.parser.parseSearchResults($, this.baseUrl)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }
}