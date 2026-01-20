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
    Request,
    Response
} from '@paperback/types'

import { Parser } from './WeebCentralParser'

const BASE_DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '1.0.9',
    name: 'WeebCentral',
    description: 'Extension that pulls manga from WeebCentral.',
    author: 'DarkDragonkz',
    authorWebsite: 'http://github.com/DarkDragonkz',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: BASE_DOMAIN,
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.GREEN,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS |
        SourceIntents.HOMEPAGE_SECTIONS |
        SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    constructor(private cheerio: any) {}

    baseUrl = BASE_DOMAIN
    RETRY = 5
    parser = new Parser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'user-agent': await this.requestManager.getDefaultUserAgent(),
                    'referer': `${this.baseUrl}/`,
                }
                return request
            },
            interceptResponse: async (response: Response) => {
                return response
            },
        },
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        
        if (response.status === 404) {
            throw new Error(`Manga with id ${mangaId} not found!`)
        }
        
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchTags(): Promise<TagSection[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/search`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseTags($)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const LIMIT = 32
        const offset = metadata?.offset ?? 0
        let searchParams = ''

        // Title search
        if (query.title) {
            searchParams = searchParams.concat(`&text=${encodeURIComponent(query.title)}`)
        }

        // Tag search
        if (query.includedTags) {
            for (const tag of query.includedTags) {
                searchParams = searchParams.concat(`&included_tag=${tag.id}`)
            }
        }

        searchParams = searchParams.concat(`&limit=${LIMIT}&offset=${offset}`)
        
        const request = App.createRequest({
            url: `${this.baseUrl}/search/data?sort=Best%20Match&order=Ascending&display_mode=Full%20Display${searchParams}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        
        const $ = this.cheerio.load(response.data)
        const results = await this.parser.parseSearchResults($)
        
        const nextPageMetadata = this.parser.isLastPage($)
            ? undefined
            : { offset: offset + LIMIT }

        return App.createPagedResults({
            results,
            metadata: nextPageMetadata,
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let param = ''

        switch (homepageSectionId) {
            case 'recent':
                param = `latest-updates/${page}`
                metadata = {
                    ...metadata,
                    page: page + 1,
                }
                break
            case 'hot':
                param = `hot-updates`
                metadata = undefined // Hot updates non sembra avere paginazione nello switch case originale, o usa un'altra logica
                break
            default:
                throw new Error('Section id not supported')
        }

        const request = App.createRequest({
            url: `${this.baseUrl}/${param}`,
            method: 'GET',
        })
        
        const response = await this.requestManager.schedule(request, this.RETRY)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseViewMore($, homepageSectionId)
        
        return App.createPagedResults({
            results: manga,
            metadata,
        })
    }

    async getCloudflareBypassRequestAsync(): Promise<Request> {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'user-agent': await this.requestManager.getDefaultUserAgent(),
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
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
