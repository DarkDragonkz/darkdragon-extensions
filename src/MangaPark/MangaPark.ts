import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    BadgeColor,
    SourceIntents,
    SourceManga,
    TagSection,
    Request,
    Response
} from '@paperback/types'
import { MangaParkParser } from './MangaParkParser'

const MP_DOMAIN = 'https://mangapark.net'

export const MangaParkInfo: SourceInfo = {
    version: '1.0.2',
    name: 'MangaPark',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    description: 'Extension for MangaPark',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: MP_DOMAIN,
    sourceTags: [
        {
            text: 'ENGLISH',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaPark extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (req: any) => {
                req.headers = {
                    ...(req.headers ?? {}),
                    'referer': `${MP_DOMAIN}/`,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                return req
            },
            interceptResponse: async (res: any) => { return res }
        }
    })

    parser = new MangaParkParser()

    getMangaShareUrl(mangaId: string): string { return `${MP_DOMAIN}/title/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // chapterId qui è lo slug completo (es. "9939308-vol-0-ch-78")
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        
        // 1. Estraiamo il blocco dati JSON di Qwik
        const $ = this.cheerio.load(response.data)
        const jsonScript = $('script[type="qwik/json"]').html()
        if (!jsonScript) throw new Error('Failed to extract Qwik JSON data')

        let jsonData: any
        try {
            jsonData = JSON.parse(jsonScript)
        } catch (e) {
            throw new Error('Failed to parse Qwik JSON')
        }

        const objs = jsonData.objs || []
        let pages: string[] = []

        // 2. Ricerca delle Immagini nel JSON
        // Cerchiamo l'array più lungo che contiene stringhe URL HTTP
        for (const item of objs) {
            if (Array.isArray(item) && item.length > 0) {
                const firstItem = item[0]
                if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
                    const isImageArray = item.every(x => typeof x === 'string' && x.startsWith('http'))
                    if (isImageArray && item.length > pages.length) {
                        pages = item
                    }
                }
            }
        }

        if (pages.length === 0) throw new Error('No pages found')

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${MP_DOMAIN}/search?word=${encodeURIComponent(query.title ?? '')}&page=${page}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, MP_DOMAIN)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: MP_DOMAIN,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback, MP_DOMAIN)
    }

    // FIX: Metodo obbligatorio per Cloudflare Bypass
    async getCloudflareBypassRequest(): Promise<Request> {
        return App.createRequest({
            url: MP_DOMAIN,
            method: 'GET',
            headers: {
                'referer': `${MP_DOMAIN}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }
}