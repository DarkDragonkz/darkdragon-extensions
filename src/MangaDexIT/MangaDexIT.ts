import {
    Source,
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
    Request,
    HomeSectionType,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding
} from '@paperback/types'

import { MangaDexITParser } from './MangaDexITParser'

const MD_API = 'https://api.mangadex.org'

export const MangaDexITInfo: SourceInfo = {
    version: '1.1.0', // Major bump per refactoring
    name: 'MangaDex IT',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    description: 'Estensione Italiana per MangaDex. Include ricerca Smart ID e copertine HD.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDexIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    parser = new MangaDexITParser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org',
                    'User-Agent': 'Paperback-iOS/MangaDexIT-Ext'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string { return `https://mangadex.org/title/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // Feed solo Italiano, ordinato per volume/capitolo
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=it&order[volume]=desc&order[chapter]=desc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includeFutureUpdates=0`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters = this.parser.parseChapters(data)

        // Sorting Client-Side di sicurezza (Volume -> Capitolo)
        return chapters.sort((a, b) => {
            if ((a.volume ?? 0) !== (b.volume ?? 0)) {
                return (b.volume ?? 0) - (a.volume ?? 0)
            }
            return (b.chapNum ?? 0) - (a.chapNum ?? 0)
        })
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        try {
            const request = App.createRequest({
                url: `${MD_API}/at-home/server/${chapterId}`,
                method: 'GET'
            })
            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            return this.parser.parseChapterDetails(data, mangaId, chapterId)
        } catch (e) {
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: ['https://paperback.moe/icons/logo-alt.svg'] // Fallback immagine errore
            })
        }
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art`

        // FILTRI FONDAMENTALI PER IT:
        // Qui MANTENIAMO il filtro lingua. Se cerco "One Piece" sulla source IT, 
        // voglio vederlo solo se esistono capitoli in IT.
        url += '&availableTranslatedLanguage[]=it'
        url += '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic'
        
        if (query.title) {
            const safeTitle = query.title.trim()
            // SMART SEARCH: Se è un UUID, cerca per ID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeTitle)

            if (isUUID) {
                url += `&ids[]=${safeTitle}`
            } else {
                url += `&title=${encodeURIComponent(safeTitle)}&order[relevance]=desc`
            }
        } else {
            // Ordine default per popolarità
            url += '&order[followedCount]=desc'
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        // Risultati ricerca: Qualità cover standard (.256) per velocità
        const results = this.parser.parseSearchResults(data, false)

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // UI MIGLIORATA:
        // 1. Popolari: Large (Vetrina)
        // 2. Ultime Uscite: Continuous (Scroll infinito verticale)
        // 3. Nuovi Arrivi: Normal (Scroll orizzontale)
        const sections = [
            App.createHomeSection({ id: 'popular', title: 'Popolari (IT) 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'latest', title: 'Ultime Uscite (IT) 🆙', containsMoreItems: true, type: HomeSectionType.continuous }),
            App.createHomeSection({ id: 'new', title: 'Nuovi Arrivi (IT) 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        ]

        // Parametri base comuni: Solo IT, Contenuto completo
        const baseParams = 'limit=15&includes[]=cover_art&availableTranslatedLanguage[]=it&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic'

        const urls: Record<string, string> = {
            popular: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`,
            latest: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`,
            new: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`
        }

        // Esecuzione parallela
        const promises = sections.map(async (section) => {
            try {
                const request = App.createRequest({ url: urls[section.id], method: 'GET' })
                const response = await this.requestManager.schedule(request, 1)
                const data = JSON.parse(response.data ?? '{}')
                
                // Se la sezione è Large, usa cover HD (.512)
                const useHighQuality = (section.type === HomeSectionType.singleRowLarge)
                section.items = this.parser.parseSearchResults(data, useHighQuality)
                
                sectionCallback(section)
            } catch (e) {
                console.error(`Error fetching section ${section.id}: ${e}`)
                sectionCallback(section)
            }
        })

        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&availableTranslatedLanguage[]=it&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`; break;
            case 'latest': url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`; break;
            case 'new': url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data, false)

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }
}