import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    PagedResults,
    SearchRequest,
    SourceInfo,
    SourceIntents,
    SourceManga,
    BadgeColor,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding,
} from '@paperback/types'

import { ReadAllComicsParser } from './ReadAllComicsParser'

const DOMAIN = 'https://readallcomics.com'

export const ReadAllComicsInfo: SourceInfo = {
    version: '1.5.2', // Bump versione
    name: 'ReadAllComics',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics from ${DOMAIN}`,
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Comics 🇺🇸',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class ReadAllComics implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new ReadAllComicsParser()
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${DOMAIN}/`,
                    'origin': DOMAIN,
                    'user-agent': await this.requestManager.getDefaultUserAgent(),
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/category/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/category/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/category/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let url = chapterId
        if (!url.startsWith('http')) {
            url = `${this.baseUrl}/${url.replace(/^\/+/, '')}`
        }
        const baseHost = new URL(this.baseUrl).host
        const parsedUrl = new URL(url)
        if (parsedUrl.host !== baseHost) {
            throw new Error('Invalid chapter URL')
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        // CARICHIAMO CHEERIO QUI: Più sicuro della regex su stringa
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // Nota: La ricerca su ReadAllComics sembra supportare la paginazione, ma è complessa.
        // Manteniamo la logica base per ora.
        const searchUrl = `${this.baseUrl}/?story=${encodeURIComponent(query.title ?? '')}&s=&type=comic`

        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)

        return App.createPagedResults({
            results: manga,
            metadata: undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        // Gestione Paginazione "Latest"
        // Pattern tipico WordPress: /page/2/
        if (homepageSectionId === 'latest') {
            url = `${this.baseUrl}/page/${page}/`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        // Riusiamo parseSearchResults/parseGridItems che gestisce i post
        const manga = this.parser.parseSearchResults($)
        
        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': this.baseUrl,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }
}
