import {
    Chapter,
    ChapterDetails,
    HomeSection,
    PagedResults,
    SearchRequest,
    SourceManga,
    TagSection,
    Request,
    Response,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding,
} from '@paperback/types'

import { URLBuilder } from './helper'
import { Parser } from './NineMangaParser'
const BASE_VERSION = '3.0.0'

export const getExportVersion = (EXTENSION_VERSION: string): string => {
    return BASE_VERSION.split('.')
        .map((x, index) => Number(x) + Number(EXTENSION_VERSION.split('.')[index]))
        .join('.')
}

export abstract class NineManga implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    constructor(private cheerio: any) {}
    
    // FIX: User-Agent Desktop fisso per vedere le colonne laterali (Hot/New)
    readonly userAgentDesktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${this.baseUrl}/`,
                        'user-agent': this.userAgentDesktop // Forziamo Desktop
                    }
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    abstract baseUrl: string
    abstract languageCode: string
    abstract genreTag: string
    abstract authorTag: string
    abstract statusTag: string

    alternativeChapterUrl = false
    parser = new Parser()

    RETRIES = 7

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/manga/${mangaId}?waring=1`
    }

    async supportsTagExclusion(): Promise<boolean> {
        return true
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = this.createRequest(`${this.baseUrl}/manga/${mangaId}?waring=1`)
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseMangaDetails($, mangaId, this)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = this.createRequest(`${this.baseUrl}/manga/${mangaId}?waring=1`)
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapters($, mangaId, this)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${chapterId}-10-1`,
            method: 'GET',
            headers: this.constructHeaders({}),
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapterDetails($, mangaId, chapterId, this)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page == -1) return App.createPagedResults({ results: [], metadata: { page: -1 } })
        const request = this.constructSearchRequest(page, query)
        const response = await this.requestManager.schedule(request, 2)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        const manga = this.parser.parseSearchResults($, this)
        page++
        if (manga.length < 30) page = -1
        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }

    async getTags(): Promise<TagSection[]> {
        const request = this.createRequest(`${this.baseUrl}/search`)
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseTags($)
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        let request = this.createRequest(`${this.baseUrl}`)
        let response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        await this.parser.parseHomeSections($, $$, sectionCallback, this)
    }

    async getViewMoreItems(_: string, __: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [], metadata: { page: -1 } })
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
    
    parseStatus(str: string): string {
        let status = 'Unknown'
        switch (str.toLowerCase()) {
            case 'ongoing':
                status = 'Ongoing'
                break
            case 'completed':
                status = 'Completed'
                break
        }
        return status
    }

    createRequest(url: string): any {
        return App.createRequest({
            url,
            method: 'GET',
            headers: this.constructHeaders({}),
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        return App.createRequest({
            url: new URLBuilder(this.baseUrl)
                .addPathComponent('search')
                .addQueryParameter('name_sel', 'contain')
                .addQueryParameter('wd', encodeURIComponent(query?.title ?? ''))
                .addQueryParameter('completed_series', 'either')
                .addQueryParameter(
                    'category_id',
                    query?.includedTags?.map((x: any) => x.id)
                )
                .addQueryParameter(
                    'out_category_id',
                    query?.excludedTags?.map((x: any) => x.id)
                )
                .addQueryParameter('type', 'high')
                .addQueryParameter('page', page.toString())
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        })
    }

    constructHeaders(headers?: any, refererPath?: string): any {
        headers = headers ?? {}
        // Importante: User agent deve essere coerente
        headers['user-agent'] = this.userAgentDesktop
        headers['accept-language'] = 'es-ES,es;q=0.9,en;q=0.8,gl;q=0.7'
        return headers
    }

    async getCloudflareBypassRequest(): Promise<Request> {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'user-agent': this.userAgentDesktop,
                referer: `${this.baseUrl}/`,
            },
        })
    }

    checkResponseError(response: Response): void {
        const status = response.status
        switch (status) {
            case 403:
            case 503:
                throw new Error(`CLOUDFLARE BYPASS ERROR:\nPlease go to the homepage of <${this.baseUrl}> and press the cloud icon.`)
            case 404:
                throw new Error(`The requested page ${response.request.url} was not found!`)
        }
    }
}