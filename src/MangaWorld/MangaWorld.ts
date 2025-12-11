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

import { MangaWorldParser } from './MangaWorldParser'
import { URLBuilder } from '../helper'

const MW_DOMAIN = 'https://www.mangaworld.mx'

export const MangaWorldInfo: SourceInfo = {
    version: '3.5.1', // Bump UI
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
    parser = new MangaWorldParser()
    
    constructor(private cheerio: any) {}
    
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${this.baseUrl}/`,
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
        return `${this.baseUrl}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}/read/${chapterId}?style=list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // UI MIGLIORATA: Top Mensile Grande
        const sectionMonth = App.createHomeSection({
            id: 'month',
            title: 'Top Mensile 🔥',
            containsMoreItems: false,
            type: 'singleRowLarge',
        })

        const sectionLatest = App.createHomeSection({
            id: 'latest',
            title: 'Ultime Uscite 🆕',
            containsMoreItems: true,
            type: 'continuous',
        })

        const sectionTrending = App.createHomeSection({
            id: 'trending',
            title: 'In Tendenza ⚡',
            containsMoreItems: false,
            type: 'singleRowNormal',
        })

        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        })

        sectionCallback(sectionMonth)
        sectionCallback(sectionLatest)
        sectionCallback(sectionTrending)

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        this.parser.parseHomeSections($, sectionMonth, sectionLatest, sectionTrending)
        
        sectionCallback(sectionMonth)
        sectionCallback(sectionLatest)
        sectionCallback(sectionTrending)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let param = ''
        
        switch (homepageSectionId) {
            case 'latest':
                param = 'archive?sort=newest'
                break
            case 'month':
                param = 'archive?sort=most_read'
                break
            default:
                return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: `${this.baseUrl}/${param}&page=${page}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseViewMore($)
        const nextPage = manga.length > 0 ? page + 1 : undefined
        
        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined,
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = this.constructSearchRequest(page, query)

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseViewMore($)
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