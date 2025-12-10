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
    Request
} from '@paperback/types'

import { MangaDexParser } from './MangaDexParser'

const MD_API = 'https://api.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.1.1', // Bump version per fix search
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only) with high-res covers and scanlation groups support.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.GREEN,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    parser = new MangaDexParser()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org',
                    'User-Agent': 'Paperback-iOS/MangaDex-Ext'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // include scanlation_group per i credits
        const url = `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0&includes[]=scanlation_group`

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters = this.parser.parseChapters(data)

        // Fix Ordinamento volumi misti
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
                method: 'GET',
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            return this.parser.parseChapterDetails(data, mangaId, chapterId)
        } catch (e) {
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: ['https://paperback.moe/icons/logo-alt.svg'] 
            })
        }
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        // Costruzione URL robusta
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art`

        // FILTRI: Aggiungiamo 'pornographic' se l'app è settata su MATURE, altrimenti alcuni risultati spariscono
        url += '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic'
        
        // Lingua: Solo Inglese
        url += '&availableTranslatedLanguage[]=en'
        
        // Gestione Query Titolo
        if (query.title) {
            const safeTitle = query.title.trim()
            if (safeTitle.length > 0) {
                url += `&title=${encodeURIComponent(safeTitle)}&order[relevance]=desc`
            } else {
                // Se l'utente cerca stringa vuota o spazi
                url += '&order[followedCount]=desc'
            }
        } else {
            // Default sort se non c'è query
            url += '&order[followedCount]=desc' 
        }
        
        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        // Usiamo thumbs low-res per la lista search (più veloce)
        const results = this.parser.parseSearchResults(data, false)

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            App.createHomeSection({ id: 'popular', title: 'Popular 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.continuous }), 
            App.createHomeSection({ id: 'recently_added', title: 'Recently Added 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'recommended', title: 'Top Rated ⭐', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'featured', title: 'Featured (Monthly) 🌟', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'self_published', title: 'Self-Published 🖊️', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        ]

        const baseParams = 'limit=15&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en'

        const urls: Record<string, string> = {
            popular: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`,
            latest: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`,
            recently_added: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`,
            recommended: `${MD_API}/manga?${baseParams}&order[rating]=desc`,
            featured: `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`,
            self_published: `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`
        }

        const promises = sections.map(async (section) => {
            try {
                const url = urls[section.id]
                if (!url) return

                const request = App.createRequest({ url: url, method: 'GET' })
                const response = await this.requestManager.schedule(request, 1)
                const data = JSON.parse(response.data ?? '{}')
                
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
        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`; break;
            case 'latest': url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`; break;
            case 'recently_added': url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`; break;
            case 'recommended': url = `${MD_API}/manga?${baseParams}&order[rating]=desc`; break;
            case 'featured': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`; break;
            case 'self_published': url = `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data, false)

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }
}