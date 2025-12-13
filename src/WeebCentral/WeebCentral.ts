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
    version: '1.2.4',
    name: 'WeebCentral',
    description: 'Extension that pulls manga from WeebCentral.',
    author: 'Gabe',
    authorWebsite: 'http://github.com/GabrielCWT',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: BASE_DOMAIN,
    sourceTags: [
        {
            text: 'English',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS |
        SourceIntents.HOMEPAGE_SECTIONS |
        SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    constructor(private cheerio: any) { }
    
    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${BASE_DOMAIN}/`,
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                    },
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            },
        },
    })

    parser = new Parser()
    baseUrl = BASE_DOMAIN

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        
        return this.parser.parseChapters($)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        
        // Parsing delle immagini dal lettore (Mancante nel tuo file parser originale, ma necessario per non crashare)
        // Se il tuo file parser originale aveva un metodo parseChapterDetails diverso, usa quello.
        // Qui uso una logica standard per WeebCentral.
        const pages: string[] = []
        $('img').each((_: any, img: any) => {
            const url = $(img).attr('src')
            if (url && !url.includes('loader') && !url.includes('logo')) {
                pages.push(url)
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = `${this.baseUrl}/search?text=${encodeURIComponent(query.title ?? '')}`
        
        // Aggiunta gestione offset/limit come da logica funzionante
        const limit = 32
        const offset = (page - 1) * limit
        url += `&offset=${offset}&limit=${limit}&display_mode=Full+Display`

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        let mData = undefined
        if (!this.parser.isLastPage($)) {
            mData = { page: page + 1 }
        }

        return App.createPagedResults({
            results: manga,
            metadata: mData,
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let param = ''
        const limit = 32
        const offset = (page - 1) * limit

        switch (homepageSectionId) {
            case 'hot':
                param = `search?sort=Best+Match&offset=${offset}&limit=${limit}&display_mode=Full+Display`
                break
            case 'latest':
                param = `search?sort=Latest+Updates&offset=${offset}&limit=${limit}&display_mode=Full+Display`
                break
            case 'recommendations':
                // Nota: Recommendations solitamente non ha view more nel sito, ma gestiamo il caso
                param = `search?sort=Best+Match&offset=${offset}&limit=${limit}` 
                break
            default:
                throw new Error('Section id not supported')
        }

        const request = App.createRequest({
            url: `${this.baseUrl}/${param}`,
            method: 'GET',
        })
        
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseViewMore($, homepageSectionId)
        
        let mData = undefined
        if (!this.parser.isLastPage($)) {
            mData = { page: page + 1 }
        }

        return App.createPagedResults({
            results: manga,
            metadata: mData,
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
                throw new Error(`The requested page ${response.url} was not found.`)
        }
    }
}