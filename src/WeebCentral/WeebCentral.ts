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
    Request,
    Response,
} from '@paperback/types'

import { WeebCentralParser } from './WeebCentralParser'

const DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '1.2.2',
    name: 'WeebCentral',
    icon: 'icon.png',
    author: 'Tu',
    description: 'Extension for WeebCentral',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'English',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | 
             SourceIntents.HOMEPAGE_SECTIONS | 
             SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    parser = new WeebCentralParser()
    baseUrl = DOMAIN

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
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: []
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const limit = 32
        const offset = (page - 1) * limit
        
        const request = App.createRequest({
            url: `${this.baseUrl}/search?text=${encodeURIComponent(query.title ?? '')}&offset=${offset}&limit=${limit}&display_mode=Full+Display`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        const hasNextPage = manga.length >= limit ? { page: page + 1 } : undefined

        return App.createPagedResults({
            results: manga,
            metadata: hasNextPage
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const limit = 32
        const offset = (page - 1) * limit
        let url = ''

        switch (homepageSectionId) {
            case 'hot':
                url = `${this.baseUrl}/search?sort=Best+Match&offset=${offset}&limit=${limit}&display_mode=Full+Display`
                break
            case 'latest':
                url = `${this.baseUrl}/search?sort=Latest+Updates&offset=${offset}&limit=${limit}&display_mode=Full+Display`
                break
            default:
                return App.createPagedResults({ results: [], metadata: undefined })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseViewMore($)
        
        const hasNextPage = manga.length >= limit ? { page: page + 1 } : undefined

        return App.createPagedResults({
            results: manga,
            metadata: hasNextPage,
        })
    }
}