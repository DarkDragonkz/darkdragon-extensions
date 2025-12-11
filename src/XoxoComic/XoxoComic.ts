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
    HomeSectionType,
    Request
} from '@paperback/types'

import { XoxoComicParser } from './XoxoComicParser'

const DOMAIN = 'https://xoxocomic.com'

export const XoxoComicInfo: SourceInfo = {
    version: '1.2.1', // Bump versione per Home Revamp Fix
    name: 'XoxoComic',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics from ${DOMAIN}`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Comics',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class XoxoComic implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new XoxoComicParser()
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${DOMAIN}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/comic/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const url = mangaId.includes('/') ? `${this.baseUrl}/${mangaId}` : `${this.baseUrl}/comic/${mangaId}`
        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const urlBase = mangaId.includes('/') ? `${this.baseUrl}/${mangaId}` : `${this.baseUrl}/comic/${mangaId}`
        const request = App.createRequest({ url: urlBase, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const totalPages = this.parser.getChapterPageCount($)
        let allChapters = this.parser.parseChapters($, mangaId)

        if (totalPages > 1) {
            const promises = []
            for (let i = 2; i <= totalPages; i++) {
                const req = App.createRequest({
                    url: `${urlBase}?page=${i}`,
                    method: 'GET'
                })
                promises.push(this.requestManager.schedule(req, 1))
            }

            const responses = await Promise.all(promises)
            for (const res of responses) {
                const $page = this.cheerio.load(res.data)
                const pageChapters = this.parser.parseChapters($page, mangaId)
                allChapters = allChapters.concat(pageChapters)
            }
        }

        return allChapters.map((chapter, index) => {
            chapter.sortingIndex = index
            return chapter
        })
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let url = chapterId.startsWith('http') ? chapterId : `${this.baseUrl}/${chapterId}`
        if (!url.endsWith('/all')) url = `${url}/all`

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${this.baseUrl}/search-comic?keyword=${encodeURIComponent(query.title ?? '')}&page=${page}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseGridItems($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Trending (Hot) - LARGE, NO View More
        const trendingSection = App.createHomeSection({ 
            id: 'trending', 
            title: 'Trending Comics 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })

        // 2. Latest Updates - CONTINUOUS, SI View More
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })

        // 3. Top Month (Popular) - NORMAL, NO View More
        const topMonthSection = App.createHomeSection({ 
            id: 'top_month', 
            title: 'Top Month ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })

        // 4. Top Week (New) - NORMAL, NO View More
        const topWeekSection = App.createHomeSection({ 
            id: 'top_week', 
            title: 'Top Week ⚡', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })

        // URL Specifici per ogni sezione
        const requests = [
            App.createRequest({ url: `${this.baseUrl}/hot-comic`, method: 'GET' }),      // Trending
            App.createRequest({ url: `${this.baseUrl}/comic-update`, method: 'GET' }),   // Latest
            App.createRequest({ url: `${this.baseUrl}/popular-comic`, method: 'GET' }),  // Top Month
            App.createRequest({ url: `${this.baseUrl}/new-comic`, method: 'GET' })       // Top Week
        ]

        // Eseguiamo
        sectionCallback(trendingSection)
        sectionCallback(latestSection)
        sectionCallback(topMonthSection)
        sectionCallback(topWeekSection)

        const responses = await Promise.all(requests.map(req => this.requestManager.schedule(req, 1)))

        // Parsing Trending
        const $trending = this.cheerio.load(responses[0].data)
        trendingSection.items = this.parser.parseGridItems($trending)
        sectionCallback(trendingSection)

        // Parsing Latest
        const $latest = this.cheerio.load(responses[1].data)
        latestSection.items = this.parser.parseGridItems($latest)
        sectionCallback(latestSection)

        // Parsing Top Month
        const $month = this.cheerio.load(responses[2].data)
        topMonthSection.items = this.parser.parseGridItems($month)
        sectionCallback(topMonthSection)

        // Parsing Top Week
        const $week = this.cheerio.load(responses[3].data)
        topWeekSection.items = this.parser.parseGridItems($week)
        sectionCallback(topWeekSection)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        // Solo Latest ha il View More abilitato
        if (homepageSectionId === 'latest') {
            url = `${this.baseUrl}/comic-update?page=${page}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseGridItems($)
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }
}