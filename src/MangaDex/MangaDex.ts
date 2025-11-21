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
    SourceStateManager,
    ConfigurableSource
} from '@paperback/types'

import { URLBuilder } from '../helper'
import { MangaDexSettings, DEFAULT_LANGUAGES } from './MangaDexSettings'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'Extension for MangaDex (API v5)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'MULTI-LANG',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.SETTINGS_UI,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding, ConfigurableSource {
    
    // State Manager per salvare le impostazioni delle lingue
    stateManager = App.createSourceStateManager()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5, // MangaDex ha un rate limit di 5 req/s
        requestTimeout: 20000
    })

    // Implementazione Menu Impostazioni
    async getSourceMenu(): Promise<any> {
        return new MangaDexSettings(this)
    }

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // Richiediamo anche autore, artista e cover art in una sola chiamata
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        // Titolo (preferisci inglese, altrimenti il primo disponibile)
        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        
        // Descrizione
        const desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''

        // Autore e Artista
        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)
        
        // Copertina
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        // Status
        let status = 'Ongoing'
        if (attributes.status === 'completed') status = 'Completed'
        if (attributes.status === 'hiatus') status = 'Hiatus'
        if (attributes.status === 'cancelled') status = 'Cancelled'

        // Tags
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
        // Recupera le lingue salvate nelle impostazioni
        let languages = await this.stateManager.retrieve('languages') as string[]
        if (!languages || languages.length === 0) languages = DEFAULT_LANGUAGES

        // Costruisci i parametri per la query
        const url = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addPathComponent(mangaId)
            .addPathComponent('feed')
            .addQueryParameter('limit', '500')
            .addQueryParameter('order[chapter]', 'desc')
            .addQueryParameter('translatedLanguage[]', languages)
            // .addQueryParameter('contentRating[]', ['safe', 'suggestive', 'erotica', 'pornographic']) // Opzionale: mostra tutto
            
        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters: Chapter[] = []
        
        for (const chapter of data.data) {
            const attr = chapter.attributes
            
            // Salta capitoli esterni (es. MangaPlus link)
            if (attr.externalUrl) continue

            const lang = attr.translatedLanguage
            const chapNum = parseFloat(attr.chapter) || 0
            const title = attr.title ? `${attr.title}` : (attr.chapter ? `Chapter ${attr.chapter}` : 'Oneshot')
            
            // Aggiungiamo bandiera al titolo per chiarezza se ci sono più lingue
            let flag = ''
            if (lang === 'it') flag = '🇮🇹 '
            else if (lang === 'en') flag = '🇬🇧 '
            else flag = `[${lang}] `

            chapters.push(App.createChapter({
                id: chapter.id,
                name: flag + title,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: lang,
                group: '' // MangaDex ha i gruppi nelle relationships, si potrebbe estrarre ma rallenta
            }))
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // 1. Chiedi al server "At-Home" dove trovare le immagini
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const baseUrl = data.baseUrl
        const hash = data.chapter.hash
        const fileNames = data.chapter.data // Usa 'data' per alta qualità, 'dataSaver' per risparmio dati

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
        
        const url = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', limit.toString())
            .addQueryParameter('offset', offset.toString())
            .addQueryParameter('title', query.title ?? '')
            .addQueryParameter('includes[]', 'cover_art') // Per avere la copertina subito
            .addQueryParameter('order[relevance]', 'desc') // Ordina per rilevanza

        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
        for (const manga of data.data) {
            const attr = manga.attributes
            const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
            
            // Trova la copertina nelle relationships
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

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Sezione 1: Popolari (Titoli con più Follows)
        const section1 = App.createHomeSection({
            id: 'popular',
            title: 'Popular on MangaDex',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section1)

        // Sezione 2: Ultime Aggiunte (per le lingue selezionate)
        const section2 = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates (Filtered)',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section2)

        // Recupera Popolari
        const popularUrl = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[followedCount]', 'desc')
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl()
            
        const popularRequest = App.createRequest({ url: popularUrl, method: 'GET' })
        const popularResponse = await this.requestManager.schedule(popularRequest, 1)
        const popularData = JSON.parse(popularResponse.data ?? '{}')
        
        const popularItems: PartialSourceManga[] = []
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
        section1.items = popularItems
        sectionCallback(section1)

        // Recupera Recenti (Qui servirebbe una logica complessa per prendere i manga dai capitoli, 
        // ma per semplicità prendiamo i manga creati di recente o aggiornati)
        const latestUrl = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[createdAt]', 'desc') // Manga creati di recente
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl()

        const latestRequest = App.createRequest({ url: latestUrl, method: 'GET' })
        const latestResponse = await this.requestManager.schedule(latestRequest, 1)
        const latestData = JSON.parse(latestResponse.data ?? '{}')
        
        const latestItems: PartialSourceManga[] = []
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
        section2.items = latestItems
        sectionCallback(section2)
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
}