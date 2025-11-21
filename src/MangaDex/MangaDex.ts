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
    PartialSourceManga
} from '@paperback/types'

import { URLBuilder } from '../helper'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.0.0',
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only)',
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
        requestsPerSecond: 5, 
        requestTimeout: 20000
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
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        const desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''

        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)
        
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        let status = 'Ongoing'
        if (attributes.status === 'completed') status = 'Completed'
        if (attributes.status === 'hiatus') status = 'Hiatus'
        if (attributes.status === 'cancelled') status = 'Cancelled'

        const tags: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: [] })]
        tags[0]!.tags = attributes.tags.map((tag: any) => App.createTag({ id: tag.id, label: tag.attributes.name.en }))

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
        // URL pulito: Solo inglese, ordinato per capitolo decrescente, limite 500
        const url = `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0`

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters: Chapter[] = []
        
        if (!data.data) return []

        for (const chapter of data.data) {
            const attr = chapter.attributes
            
            // Saltiamo i capitoli che sono solo link esterni (es. MangaPlus)
            if (attr.externalUrl) continue

            const chapNum = parseFloat(attr.chapter) || 0
            
            // Titolo pulito: Se c'è un titolo specifico lo usa, altrimenti "Chapter X"
            let title = ''
            if (attr.title) {
                title = attr.title
            } else if (attr.chapter) {
                title = `Chapter ${attr.chapter}`
            } else {
                title = 'Oneshot'
            }

            chapters.push(App.createChapter({
                id: chapter.id,
                name: title,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: 'en'
            }))
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const baseUrl = data.baseUrl
        const hash = data.chapter.hash
        const fileNames = data.chapter.data 

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
        
        // Cerca titoli che contengono il testo, includendo copertine, ordinati per rilevanza.
        // Includiamo TUTTI i content rating per essere sicuri di trovare il manga.
        const url = `${MD_API}/manga?limit=${limit}&offset=${offset}&title=${encodeURIComponent(query.title ?? '')}&includes[]=cover_art&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
        
        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
        if (data.data) {
            for (const manga of data.data) {
                const attr = manga.attributes
                // Fallback titolo intelligente
                const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
                
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                const image = fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg'

                results.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: image,
                    title: title,
                    subtitle: attr.status
                }))
            }
        }

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Sezione Popolari
        const section1 = App.createHomeSection({
            id: 'popular',
            title: 'Popular (English Available)',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section1)

        // Sezione Ultime Aggiunte
        const section2 = App.createHomeSection({
            id: 'latest',
            title: 'Latest English Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section2)
        
        const ratings = '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica'

        // Richiesta Popolari (Include lingua inglese disponibile)
        const popularUrl = `${MD_API}/manga?limit=10&order[followedCount]=desc&includes[]=cover_art&availableTranslatedLanguage[]=en${ratings}`
        const popularRequest = App.createRequest({ url: popularUrl, method: 'GET' })
        const popularResponse = await this.requestManager.schedule(popularRequest, 1)
        const popularData = JSON.parse(popularResponse.data ?? '{}')
        
        const popularItems: PartialSourceManga[] = []
        if (popularData.data) {
            for (const manga of popularData.data) {
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                popularItems.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                    title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                    subtitle: 'Popular'
                }))
            }
        }
        section1.items = popularItems
        sectionCallback(section1)

        // Richiesta Recenti (Filtra per lingua inglese)
        const latestUrl = `${MD_API}/manga?limit=10&order[createdAt]=desc&includes[]=cover_art&availableTranslatedLanguage[]=en${ratings}`
        const latestRequest = App.createRequest({ url: latestUrl, method: 'GET' })
        const latestResponse = await this.requestManager.schedule(latestRequest, 1)
        const latestData = JSON.parse(latestResponse.data ?? '{}')
        
        const latestItems: PartialSourceManga[] = []
        if (latestData.data) {
            for (const manga of latestData.data) {
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                latestItems.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                    title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                    subtitle: 'New Entry'
                }))
            }
        }
        section2.items = latestItems
        sectionCallback(section2)
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
}