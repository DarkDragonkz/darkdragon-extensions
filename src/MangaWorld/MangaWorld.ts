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
    TagSection,
    PartialSourceManga,
} from '@paperback/types'

import { MangaWorldParser } from './MangaWorldParser'
import { URLBuilder } from '../helper'

const MW_DOMAIN = 'https://www.mangaworld.mx'

export const MangaWorldInfo: SourceInfo = {
    version: '3.5.0', // Bump version per fix date e status
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld.',
    author: 'NmN & DarkDragonkz',
    authorWebsite: 'http://github.com/pandeynmm',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: MW_DOMAIN,
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaWorld implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding { 
    baseUrl = MW_DOMAIN
    
    constructor(private cheerio: any) {}
    
    RETRIES = 2
    parser = new MangaWorldParser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 4, // 4-5 è safe per MangaWorld
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${this.baseUrl}/`,
                    // Usa UserAgent dinamico se possibile, altrimenti un fallback recente
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
                return request
            },
            interceptResponse: async (response: any) => {
                const data = response.data
                // Check per Cloudflare Challenge
                if (typeof data === 'string' && (data.includes('Just a moment...') || data.includes('Cloudflare'))) {
                    throw new Error('Cloudflare check required')
                }
                return response
            }
        }
    })
    
    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}/read/${chapterId}/?style=list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getTags(): Promise<TagSection[]> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseTags($, this.baseUrl)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page === -1) return App.createPagedResults({ results: [], metadata: undefined })
        
        const request = this.constructSearchRequest(page, query)
        
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined,
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case '1': 
                url = `${this.baseUrl}/?page=${page}`
                break
            case '2': 
            case '3': 
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            default:
                return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga: PartialSourceManga[] = this.parser.parseViewMore($)
        
        const nextPage = manga.length > 0 ? page + 1 : undefined
        
        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined,
        })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        const builder = new URLBuilder(this.baseUrl)
            .addPathComponent('archive')
            .addQueryParameter('page', page.toString())

        if (query.title) {
            builder.addQueryParameter('keyword', encodeURIComponent(query.title))
        }

        if (query.includedTags && query.includedTags.length > 0) {
            builder.addQueryParameter('genre', query.includedTags[0]?.id)
        }

        builder.addQueryParameter('sort', 'most_read')

        return App.createRequest({
            url: builder.buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        })
    }
}