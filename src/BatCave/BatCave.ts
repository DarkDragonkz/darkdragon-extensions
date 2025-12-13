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

import { BatCaveParser } from './BatCaveParser'

const DOMAIN = 'https://batcave.biz'

export const BatCaveInfo: SourceInfo = {
    version: '1.0.9',
    name: 'BatCave',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics from ${DOMAIN}`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Comics 🇺🇸',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class BatCave implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new BatCaveParser()
    
    RETRIES = 2

    constructor(private cheerio: any) { }

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${this.baseUrl}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string { return `${this.baseUrl}/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let param = ''
        
        if (homepageSectionId === 'latest') {
            param = `page/${page}/`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: `${this.baseUrl}/${param}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        
        let manga = this.parser.parseGridItems($, '.sect--latest .latest, .content .short', '.latest__chapter')

        if (manga.length === 0) {
             manga = this.parser.parseSearchResults($)
        }

        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        const request = App.createRequest({
            url: `${this.baseUrl}/index.php?do=search`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                'do': 'search',
                'subaction': 'search',
                'story': query.title ?? '',
                'search_start': page
            }
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)

        return App.createPagedResults({
            results: manga,
            metadata: undefined 
        })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            }
        })
    }
}