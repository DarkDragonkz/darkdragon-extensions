import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    HomeSectionType,
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
    Request
} from '@paperback/types'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.1.1',
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only) - Optimized',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'ENGLISH',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // Richiediamo dettagli, autori, artisti e copertina in una sola chiamata
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        
        if (!json.data || !json.data.attributes) {
            throw new Error(`Failed to load manga details for ${mangaId}`)
        }

        const attr = json.data.attributes
        const rel = json.data.relationships

        // Titolo: Preferenza EN -> Primo disponibile
        const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown Title'
        const desc = attr.description.en ?? Object.values(attr.description)[0] ?? ''

        // Autori e Artisti
        const authors = rel.filter((x: any) => x.type === 'author').map((x: any) => x.attributes?.name).filter((x: any) => x)
        const artists = rel.filter((x: any) => x.type === 'artist').map((x: any) => x.attributes?.name).filter((x: any) => x)

        // Copertina
        const coverRel = rel.find((x: any) => x.type === 'cover_art')
        const image = coverRel?.attributes?.fileName 
            ? `${MD_UPLOADS}/covers/${mangaId}/${coverRel.attributes.fileName}` 
            : 'https://paperback.moe/icons/logo-alt.svg'

        // Status
        let status = 'Ongoing'
        if (attr.status === 'completed') status = 'Completed'
        if (attr.status === 'hiatus') status = 'Hiatus'
        if (attr.status === 'cancelled') status = 'Cancelled'

        // Tags
        const tags: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: [] })]
        tags[0]!.tags = attr.tags.map((tag: any) => App.createTag({ id: tag.id, label: tag.attributes.name.en }))

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: tags,
                desc: desc
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const chapters: Chapter[] = []
        let offset = 0
        const limit = 500 // Massimo permesso dall'API
        let run = true

        while (run) {
            // Costruiamo l'URL manualmente per precisione
            // order[chapter]=desc: I più recenti prima
            // translatedLanguage[]=en: Solo inglese
            // includeFutureUpdates=0: Niente capitoli non ancora usciti
            const url = `${MD_API}/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0`
            
            const request = App.createRequest({ url, method: 'GET' })
            const response = await this.requestManager.schedule(request, 1)
            const json = JSON.parse(response.data ?? '{}')

            if (!json.data || json.data.length === 0) {
                run = false
                break
            }

            for (const item of json.data) {
                const attr = item.attributes
                
                // Ignora link esterni (MangaPlus, etc)
                if (attr.externalUrl) continue

                const chapNum = parseFloat(attr.chapter) || 0
                
                // Logica anti-duplicati:
                // Poiché chiediamo i capitoli in ordine DISCENDENTE (più recenti prima),
                // se incontriamo un numero di capitolo già presente, è una versione più vecchia o di un altro gruppo.
                // La ignoriamo per tenere la lista pulita.
                // Eccezione: i capitoli "0" (spesso oneshot) possono essere multipli.
                if (chapNum !== 0 && chapters.some(c => c.chapNum === chapNum)) {
                    continue
                }

                let name = ''
                if (attr.title) name = attr.title
                else if (attr.chapter) name = `Chapter ${attr.chapter}`
                else name = 'Oneshot'

                chapters.push(App.createChapter({
                    id: item.id,
                    name: name,
                    chapNum: chapNum,
                    volume: parseFloat(attr.volume) || 0,
                    time: new Date(attr.publishAt),
                    langCode: 'en'
                }))
            }

            if (json.total && (offset + limit) < json.total) {
                offset += limit
            } else {
                run = false
            }
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        
        if (!json.baseUrl) throw new Error('Failed to get chapter server')

        const baseUrl = json.baseUrl
        const hash = json.chapter.hash
        const fileNames = json.chapter.data 

        const pages: string[] = []
        for (const file of fileNames) {
            pages.push(`${baseUrl}/data/${hash}/${file}`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        // Pulizia del titolo: trim degli spazi e codifica URI
        const searchTitle = query.title?.trim() ?? ''
        const encodedTitle = encodeURIComponent(searchTitle)

        // Costruiamo l'URL base
        // Nota: Usiamo %5B%5D invece di [] per massima compatibilità con l'encoder di Paperback
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes%5B%5D=cover_art`

        // Aggiungiamo il titolo solo se presente
        if (encodedTitle.length > 0) {
            url += `&title=${encodedTitle}&order%5Brelevance%5D=desc`
        } else {
            // Se non c'è titolo, ordiniamo per popolarità o rating
            url += `&order%5BfollowedCount%5D=desc`
        }

        // Aggiungiamo i Content Rating (Safe, Suggestive, Erotica, Pornographic)
        // È fondamentale ripeterli per vederli tutti
        url += '&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&contentRating%5B%5D=pornographic'

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
        if (json.data) {
            for (const item of json.data) {
                results.push(this.parsePartialManga(item))
            }
        }

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Popular Section
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Now (EN)', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        sectionCallback(popularSection)

        // 2. Latest Updates Section
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates (EN)', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        sectionCallback(latestSection)

        // Params comuni
        const commonParams = '&includes[]=cover_art&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica'

        // --- FETCH POPULAR ---
        const popularUrl = `${MD_API}/manga?limit=10&order[followedCount]=desc${commonParams}`
        const popularRequest = App.createRequest({ url: popularUrl, method: 'GET' })
        
        // Eseguiamo in parallelo se possibile, ma per sicurezza sequenziale
        const popRes = await this.requestManager.schedule(popularRequest, 1)
        const popJson = JSON.parse(popRes.data ?? '{}')
        
        if (popJson.data) {
            popularSection.items = popJson.data.map((item: any) => this.parsePartialManga(item))
            sectionCallback(popularSection)
        }

        // --- FETCH LATEST ---
        const latestUrl = `${MD_API}/manga?limit=10&order[latestUploadedChapter]=desc${commonParams}`
        const latestRequest = App.createRequest({ url: latestUrl, method: 'GET' })
        
        const latRes = await this.requestManager.schedule(latestRequest, 1)
        const latJson = JSON.parse(latRes.data ?? '{}')
        
        if (latJson.data) {
            latestSection.items = latJson.data.map((item: any) => this.parsePartialManga(item))
            sectionCallback(latestSection)
        }
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const offset = metadata?.offset ?? 0
        const limit = 20 // Carichiamo 20 item per volta quando si scorre
        let url = ''
        
        // Parametri comuni: Cover, Lingua EN, Rating (Safe/Suggestive/Erotica), Limite e Offset
        const commonParams = `&includes[]=cover_art&availableTranslatedLanguage[]=en&limit=${limit}&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`

        if (homepageSectionId === 'popular') {
            url = `${MD_API}/manga?order[followedCount]=desc${commonParams}`
        } else if (homepageSectionId === 'latest') {
            url = `${MD_API}/manga?order[latestUploadedChapter]=desc${commonParams}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        if (json.data) {
            for (const item of json.data) {
                results.push(this.parsePartialManga(item))
            }
        }

        // Se abbiamo ricevuto risultati, prepariamo l'offset per la pagina successiva
        let nextMetadata: any = undefined
        if (results.length >= limit) {
            nextMetadata = { offset: offset + limit }
        }

        return App.createPagedResults({
            results: results,
            metadata: nextMetadata
        })
    }

    // Helper per parserizzare i risultati parziali (Home e Search)
    private parsePartialManga(item: any): PartialSourceManga {
        const attr = item.attributes
        const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
        
        const coverRel = item.relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        
        // Usiamo le thumbnail a 256px per risparmiare banda nella lista
        const image = fileName 
            ? `${MD_UPLOADS}/covers/${item.id}/${fileName}.256.jpg` 
            : 'https://paperback.moe/icons/logo-alt.svg'

        return App.createPartialSourceManga({
            mangaId: item.id,
            image: image,
            title: title,
            subtitle: attr.status ?? undefined
        })
    }
}