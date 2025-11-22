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
    Response,
    HomeSectionType,
    PartialSourceManga
} from '@paperback/types'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.2.0', // Major bump per il supporto Multi-Lingua
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    description: 'Extension for MangaDex (IT + EN)',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'IT/EN',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
    })

    getMangaShareUrl(mangaId: string): string { return `https://mangadex.org/title/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data)
        const data = json.data
        const attr = data.attributes

        // Titolo: Priorità IT -> EN -> Qualsiasi
        const title = attr.title.it ?? attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
        const desc = attr.description.it ?? attr.description.en ?? Object.values(attr.description)[0] ?? 'No description'
        
        let image = 'https://paperback.moe/icons/logo-alt.svg'
        const coverRel = data.relationships.find((x: any) => x.type === 'cover_art')
        if (coverRel?.attributes?.fileName) {
            image = `${MD_UPLOADS}/covers/${mangaId}/${coverRel.attributes.fileName}`
        }

        const authorRel = data.relationships.find((x: any) => x.type === 'author')
        const author = authorRel?.attributes?.name ?? 'Unknown'

        let status = 'Ongoing'
        if (attr.status === 'completed') status = 'Completed'
        if (attr.status === 'hiatus') status = 'Hiatus'
        if (attr.status === 'cancelled') status = 'Unknown'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                desc: desc,
                tags: [] 
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // FIX: Ora richiediamo sia Italiano (it) che Inglese (en)
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=it&translatedLanguage[]=en&order[volume]=desc&order[chapter]=desc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data)
        const chapters: Chapter[] = []

        for (const ch of json.data) {
            const attr = ch.attributes
            
            // Saltiamo i capitoli esterni (che farebbero crashare l'app)
            if (attr.pages === 0 || attr.externalUrl !== null) continue;

            const chapNum = parseFloat(attr.chapter) || 0
            const volNum = parseFloat(attr.volume) || undefined
            
            let name = ''
            if (attr.title) name = attr.title
            if (!name && attr.chapter) name = `Chapter ${attr.chapter}`
            if (!name) name = 'Oneshot'

            // Aggiungi Lingua e Gruppo al titolo
            const lang = attr.translatedLanguage === 'it' ? '🇮🇹' : '🇬🇧'
            const groupRel = ch.relationships.find((x: any) => x.type === 'scanlation_group')
            if (groupRel?.attributes?.name) {
                name = `${lang} ${name} [${groupRel.attributes.name}]`
            } else {
                name = `${lang} ${name}`
            }

            chapters.push(App.createChapter({
                id: ch.id,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: new Date(attr.publishAt),
                langCode: attr.translatedLanguage 
            }))
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        
        if (response.status !== 200) {
             throw new Error(`MangaDex API Error: ${response.status}`)
        }

        const json = JSON.parse(response.data)
        
        if (json.result !== 'ok' || !json.baseUrl || !json.chapter?.data) {
            throw new Error('Failed to load chapter images')
        }
        
        const baseUrl = json.baseUrl
        const hash = json.chapter.hash
        const files = json.chapter.data

        const pages: string[] = []
        for (const file of files) {
            pages.push(`${baseUrl}/data/${hash}/${file}`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        const limit = 20
        const offset = page * limit

        // FIX: Aggiunto supporto IT e tutti i content rating
        const request = App.createRequest({
            url: `${MD_API}/manga?limit=${limit}&offset=${offset}&title=${encodeURIComponent(query.title ?? '')}&includes[]=cover_art&availableTranslatedLanguage[]=it&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data)
        const results: PartialSourceManga[] = []

        for (const manga of json.data) {
            const title = manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown'
            
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            const coverRel = manga.relationships.find((x: any) => x.type === 'cover_art')
            if (coverRel?.attributes?.fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
            }

            results.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }

        return App.createPagedResults({
            results: results,
            metadata: { page: page + 1 }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Titles', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        // FIX: Aggiunto supporto IT e rating
        const popRequest = App.createRequest({
            url: `${MD_API}/manga?limit=10&includes[]=cover_art&order[followedCount]=desc&availableTranslatedLanguage[]=it&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })
        
        const latRequest = App.createRequest({
            url: `${MD_API}/manga?limit=10&includes[]=cover_art&order[updatedAt]=desc&availableTranslatedLanguage[]=it&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })

        const popResponse = await this.requestManager.schedule(popRequest, 1)
        const latResponse = await this.requestManager.schedule(latRequest, 1)

        const popJson = JSON.parse(popResponse.data)
        const popItems: PartialSourceManga[] = []
        for (const manga of popJson.data) {
            const title = manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown'
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            const coverRel = manga.relationships.find((x: any) => x.type === 'cover_art')
            if (coverRel?.attributes?.fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
            }
            popItems.push(App.createPartialSourceManga({ mangaId: manga.id, image, title, subtitle: 'Popular' }))
        }
        popularSection.items = popItems
        sectionCallback(popularSection)

        const latJson = JSON.parse(latResponse.data)
        const latItems: PartialSourceManga[] = []
        for (const manga of latJson.data) {
            const title = manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown'
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            const coverRel = manga.relationships.find((x: any) => x.type === 'cover_art')
            if (coverRel?.attributes?.fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
            }
            latItems.push(App.createPartialSourceManga({ mangaId: manga.id, image, title, subtitle: 'Latest' }))
        }
        latestSection.items = latItems
        sectionCallback(latestSection)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        const limit = 20
        const offset = page * limit
        let order = ''
        if (homepageSectionId === 'popular') order = '&order[followedCount]=desc'
        else order = '&order[updatedAt]=desc'

        // FIX: Aggiunto supporto IT e rating
        const request = App.createRequest({
            url: `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&availableTranslatedLanguage[]=it&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic${order}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data)
        const results: PartialSourceManga[] = []

        for (const manga of json.data) {
            const title = manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown'
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            const coverRel = manga.relationships.find((x: any) => x.type === 'cover_art')
            if (coverRel?.attributes?.fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
            }
            results.push(App.createPartialSourceManga({ mangaId: manga.id, image, title, subtitle: undefined }))
        }

        return App.createPagedResults({
            results: results,
            metadata: { page: page + 1 }
        })
    }
}