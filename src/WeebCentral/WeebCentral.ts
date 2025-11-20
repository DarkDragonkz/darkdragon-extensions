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

import { WeebCentralParser } from './WeebCentralParser'
import { URLBuilder } from '../helper'

const DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '1.0.3',
    name: 'WeebCentral',
    icon: 'icon.png',
    author: 'GameFuzzy',
    authorWebsite: 'https://github.com/gamefuzzy',
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
                        'user-agent': await this.requestManager.getDefaultUserAgent(),
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
        // Scarichiamo la lista completa dei capitoli direttamente
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // WeebCentral carica le immagini nella pagina "images" con reading_style
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
         const request = this.constructSearchRequest(query)
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
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(_: string, metadata: any): Promise<PagedResults> {
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

    constructSearchRequest(query: SearchRequest): any {
        const url = new URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addPathComponent('data')
            .addQueryParameter('text', encodeURIComponent(query?.title ?? ''))
            .addQueryParameter('display_mode', 'Full Display')
            
        return App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })
    }
}