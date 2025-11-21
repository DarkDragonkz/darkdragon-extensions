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
    TagSection
} from '@paperback/types'
import { MangaParkParser } from './MangaParkParser'

const MP_DOMAIN = 'https://mangapark.net'

export const MangaParkInfo: SourceInfo = {
    version: '1.0.1',
    name: 'MangaPark',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    description: 'Extension for MangaPark (Qwik API)',
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
                    // Usiamo un UA generico ma moderno per evitare blocchi, 
                    // ma se noti problemi con Cloudflare, rimuovilo per usare quello di default.
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
        // Costruiamo l'URL del capitolo.
        // chapterId qui è lo slug completo (es. "9939308-vol-0-ch-78")
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        // 1. Estraiamo il blocco dati JSON di Qwik
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

        // 2. Ricerca Euristica delle Immagini:
        // Cerchiamo l'array più lungo all'interno di "objs" che contenga solo stringhe URL (http...)
        // Questo è un metodo molto robusto per MangaPark/Qwik.
        
        for (const item of objs) {
            if (Array.isArray(item) && item.length > 0) {
                // Controlliamo il primo elemento per vedere se è una stringa URL
                const firstItem = item[0]
                if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
                    
                    // Verifica veloce: sembra un array di immagini?
                    // (Controlliamo che tutti siano stringhe e inizino con http)
                    const isImageArray = item.every(x => typeof x === 'string' && x.startsWith('http'))
                    
                    if (isImageArray) {
                        // Se troviamo più array di immagini, prendiamo quello più lungo 
                        // (spesso ci sono array di thumbnail o icone più corti)
                        if (item.length > pages.length) {
                            pages = item
                        }
                    }
                }
            }
        }

        if (pages.length === 0) {
            throw new Error('No pages found in chapter data')
        }

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
}