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
    PartialSourceManga,
} from '@paperback/types'

import { WeebCentralParser } from './WeebCentralParser'
import { URLBuilder } from '../helper'

const DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '1.0.17',
    name: 'WeebCentral',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls manga from ${DOMAIN}`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'ENGLISH',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new WeebCentralParser()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${this.baseUrl}/`,
                        // RIMOSSO User-Agent forzato
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
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 32
        const offset = metadata?.offset ?? 0
        
        const url = new URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addPathComponent('data')
            .addQueryParameter('limit', limit.toString())
            .addQueryParameter('offset', offset.toString())
            .addQueryParameter('sort', 'Best Match')
            .addQueryParameter('display_mode', 'Full Display')
            .addQueryParameter('official', 'Any')
        
        if (query.title) {
            url.addQueryParameter('text', query.title)
        }

        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        let nextMetadata: any = undefined
        if (!this.parser.isLastPage($)) {
             nextMetadata = { offset: offset + limit }
        }

        return App.createPagedResults({
            results: manga,
            metadata: nextMetadata
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
        let url = ''

        if (homepageSectionId === 'latest_updates') {
            url = `${this.baseUrl}/latest-updates/${page}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseSearchResults($)
        
        if (manga.length > 0) {
            return App.createPagedResults({
                results: manga,
                metadata: { page: page + 1 }
            })
        }

        return App.createPagedResults({ results: [] })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }
}