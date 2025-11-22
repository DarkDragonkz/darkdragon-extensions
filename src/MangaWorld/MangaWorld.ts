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
    version: '3.0.8',
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld.',
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
    
    RETRIES = 10
    parser = new Parser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 8,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${this.baseUrl}/`,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    // FIX: Gestione corretta delle sezioni "View More"
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case '1': // Ultimi capitoli
                url = `${this.baseUrl}/?page=${page}`
                break
            case '2': // Manga del mese (Popolari)
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            case '3': // Capitoli di tendenza
                // Usiamo i più letti o popolari per il trending
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            default:
                return App.createPagedResults({ results: [], metadata: { page: -1 } })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga: PartialSourceManga[] = this.parser.parseViewMore($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined,
        })
    }

    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        return time
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
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