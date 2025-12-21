import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagType,
    TagSection,
    ContentRating,
    Request,
    Response,
    SourceIntents,
    ChapterProviding,
    MangaProviding,
    SearchResultsProviding,
    HomePageSectionsProviding
} from 'paperback-extensions-common'

// CONFIGURAZIONE DOMINIO
// Aggiornato al nuovo dominio rilevato dal tuo link
const ML_DOMAIN = 'https://lek-manga.net'

export const MangaLekInfo: SourceInfo = {
    version: '3.2.7', // Incremento versione per il fix
    name: 'MangaLek',
    icon: 'icon.png',
    author: 'Netsky',
    authorWebsite: 'https://github.com/TheNetsky',
    description: 'Extension that pulls manga from MangaLek (lek-manga.net)',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: ML_DOMAIN,
    sourceTags: [
        {
            text: 'Arabic',
            type: TagType.GREY,
        },
        {
            text: 'Madara',
            type: TagType.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaLek extends Source implements MangaProviding, ChapterProviding, SearchResultsProviding, HomePageSectionsProviding {
    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    requestManager = createRequestManager({
        requestsPerSecond: 2,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (input: Request): Promise<Request> => {
                input.headers = {
                    ...(input.headers ?? {}),
                    'Referer': `${ML_DOMAIN}/`,
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
                }
                return input
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${ML_DOMAIN}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${ML_DOMAIN}/manga/${mangaId}/`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        // --- FIX SLUG CRASH ---
        // Logica robusta: prende l'ultimo pezzo dell'URL che non è vuoto.
        // Funziona sia con "manga/nome/" che con "manga/nome"
        const rawUrl = response.request.url;
        let slug = '';
        
        // Tentativo 1: Regex standard
        const regexMatch = rawUrl.match(/\/manga\/([^\/]+)/i);
        if (regexMatch && regexMatch[1]) {
            slug = regexMatch[1];
        } else {
            // Tentativo 2: Fallback (Split)
            const parts = rawUrl.split('/').filter(p => p.length > 0);
            slug = parts[parts.length - 1];
        }
        
        // Se fallisce ancora, usiamo l'ID passato
        if (!slug) slug = mangaId; 
        // ----------------------

        const title = $('.post-title h1').first().text().trim()
        const image = $('.summary_image img').first().attr('src') ?? ''
        const author = $('.author-content').text().trim()
        const artist = $('.artist-content').text().trim()
        const description = $('.description-summary .summary__content').text().trim()
        
        // Rating
        const ratingText = $('span#averagerate').text().trim()
        const rating = Number(ratingText) || 0

        // Status
        let status = 1 // ONGOING default
        const statusText = $('.post-content_item:contains("Status") .summary-content').text().trim().toLowerCase()
        if (statusText.includes('completed') || statusText.includes('end')) status = 0

        // Genres
        const arrayTags: TagSection[] = []
        const genres: string[] = []
        $('.genres-content a').each((_, element) => {
            genres.push($(element).text().trim())
        })
        if (genres.length > 0) {
            arrayTags.push({ id: '0', label: 'genres', tags: genres.map(g => ({ id: g, label: g })) })
        }

        return createManga({
            id: slug,
            titles: [title],
            image: image,
            rating: rating,
            status: status,
            author: author,
            artist: artist,
            tags: arrayTags,
            desc: description,
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${ML_DOMAIN}/manga/${mangaId}/ajax/chapters/`,
            method: 'POST',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        const chapters: Chapter[] = []
        
        $('.wp-manga-chapter').each((_, element) => {
            const link = $('a', element).attr('href')
            if (!link) return

            // Estrazione ID capitolo dall'URL (es: /56/ o /chapter-56/)
            const parts = link.split('/').filter(x => x.length > 0)
            const chapterId = parts[parts.length - 1] // Prende l'ultima parte come ID del capitolo

            const name = $('a', element).text().trim()
            const timeStr = $('.chapter-release-date i', element).text().trim() || $('.chapter-release-date a', element).attr('title') || new Date().toDateString()
            const date = new Date(timeStr) // Madara date parser di base

            // Fix per il numero capitolo se il nome è solo testo
            let chapNum = 0;
            const numMatch = name.match(/(\d+(\.\d+)?)/);
            if(numMatch) chapNum = parseFloat(numMatch[0]);

            chapters.push(createChapter({
                id: chapterId, // Usiamo lo slug del capitolo relativo
                mangaId: mangaId,
                name: name,
                langCode: 'ar',
                chapNum: chapNum,
                time: date,
            }))
        })

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // Costruzione URL capitolo: base + manga + capitolo
        // Es: https://lek-manga.net/manga/slug/chapter-56/
        const request = createRequestObject({
            url: `${ML_DOMAIN}/manga/${mangaId}/${chapterId}/`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        const pages: string[] = []
        
        // Selettore standard Madara per le immagini
        $('.reading-content img').each((_, element) => {
            let src = $(element).attr('data-src') || $(element).attr('src')
            if (src) {
                src = src.trim()
                // Fix per protocolli mancanti
                if (src.startsWith('//')) src = 'https:' + src
                pages.push(src)
            }
        })

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = createRequestObject({
            url: `${ML_DOMAIN}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        // Sezione: Latest Updates
        const latestSection = createHomeSection({ id: 'latest_updates', title: 'Latest Updates', view_more: true })
        sectionCallback(latestSection)

        const latestManga: any[] = []
        $('.page-item-detail.manga').each((_, element) => {
            const title = $('.post-title h3 a', element).text().trim()
            const url = $('.post-title h3 a', element).attr('href')
            const image = $('img', element).attr('data-src') || $('img', element).attr('src') || ''
            
            if (url) {
                 const parts = url.split('/').filter(x => x.length > 0)
                 const id = parts[parts.length - 1]

                latestManga.push(createMangaTile({
                    id: id,
                    image: image,
                    title: createIconText({ text: title }),
                }))
            }
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let param = ''
        
        if (homepageSectionId === 'latest_updates') {
            param = `page/${page}/?m_orderby=latest`
        }

        const request = createRequestObject({
            url: `${ML_DOMAIN}/${param}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga: any[] = []

        $('.page-item-detail.manga').each((_, element) => {
            const title = $('.post-title h3 a', element).text().trim()
            const url = $('.post-title h3 a', element).attr('href')
            const image = $('img', element).attr('data-src') || $('img', element).attr('src') || ''

            if (url) {
                const parts = url.split('/').filter(x => x.length > 0)
                const id = parts[parts.length - 1]

                manga.push(createMangaTile({
                    id: id,
                    image: image,
                    title: createIconText({ text: title }),
                }))
            }
        })

        // Check if there's a next page
        const m_metadata = { page: page + 1 }
        return createPagedResults({
            results: manga,
            metadata: m_metadata,
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const search = query.title ?? ''
        
        const request = createRequestObject({
            url: `${ML_DOMAIN}/?s=${encodeURIComponent(search)}&post_type=wp-manga`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga: any[] = []

        $('.c-tabs-item__content').each((_, element) => {
            const title = $('.post-title h3 a', element).text().trim()
            const url = $('.post-title h3 a', element).attr('href')
            const image = $('img', element).attr('data-src') || $('img', element).attr('src') || ''

            if (url) {
                const parts = url.split('/').filter(x => x.length > 0)
                const id = parts[parts.length - 1]

                manga.push(createMangaTile({
                    id: id,
                    image: image,
                    title: createIconText({ text: title }),
                }))
            }
        })

        return createPagedResults({
            results: manga,
            metadata: undefined // Madara search typically doesn't paginate simply
        })
    }
}