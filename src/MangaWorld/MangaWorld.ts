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

import { Parser } from './parser'
import { URLBuilder } from '../helper'

const MW_DOMAIN = 'https://www.mangaworld.mx'

export const MangaWorldInfo: SourceInfo = {
    version: '3.0.8', // Bump version
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld (0.8).',
    author: 'NmN',
    authorWebsite: 'http://github.com/pandeynmm',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: MW_DOMAIN,
    sourceTags: [
        {
            text: 'ITALIAN',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaWorld implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding { 
    baseUrl = MW_DOMAIN
    
    constructor(private cheerio: any) {}
    
    RETRIES = 5 // Ridotto leggermente, 10 è eccessivo
    parser = new Parser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 6, // Più conservativo per evitare ban IP
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${this.baseUrl}/`,
                        // RIMOSSO User-Agent hardcodato per evitare conflitti Cloudflare
                    }
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
        return this.parser.parseChapters($, mangaId, this)
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
        if (page == -1) return App.createPagedResults({ results: [], metadata: { page: -1 } })
        const request = this.constructSearchRequest(page, query)
        const data = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(data.data)
        const manga = this.parser.parseSearchResults($)
        page++
        if (manga.length < 16) page = -1
        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
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

    async getViewMoreItems(_: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${this.baseUrl}/?page=${page}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga: PartialSourceManga[] = this.parser.parseViewMore($)
        return App.createPagedResults({
            results: manga,
            metadata: { page: page + 1 },
        })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                // Qui usiamo l'UA corretto del dispositivo
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        const request = App.createRequest({
            url: new URLBuilder(this.baseUrl)
                .addPathComponent('archive')
                .addQueryParameter('keyword', encodeURIComponent(query?.title ?? ''))
                .addQueryParameter(
                    'genre',
                    query?.includedTags?.map((x: any) => x.id)
                )
                .addQueryParameter('sort', 'most_read')
                .addQueryParameter('page', page.toString())
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        })
        return request
    }
}