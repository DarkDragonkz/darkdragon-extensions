import {
    Chapter,
    ChapterDetails,
    Tag,
    TagSection,
    SourceManga,
    PartialSourceManga
} from '@paperback/types'

const MD_UPLOADS = 'https://uploads.mangadex.org'

export class MangaDexParser {

    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        // Titolo: Preferenza EN -> Primo disponibile
        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        
        let desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''
        
        // Estrazione Autori e Artisti
        const authors = relationships
            .filter((r: any) => r.type === 'author')
            .map((r: any) => r.attributes?.name)
            .filter((n: any) => n)
        
        const artists = relationships
            .filter((r: any) => r.type === 'artist')
            .map((r: any) => r.attributes?.name)
            .filter((n: any) => n)

        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const coverFileName = coverRel?.attributes?.fileName
        const image = coverFileName ? `${MD_UPLOADS}/covers/${mangaId}/${coverFileName}.512.jpg` : 'https://paperback.moe/icons/logo-alt.svg'

        // Tags
        const tags: Tag[] = []
        for (const tag of attributes.tags) {
            tags.push(App.createTag({ id: tag.id, label: tag.attributes.name.en }))
        }
        
        let status = 'Ongoing'
        if (attributes.status === 'completed') status = 'Completed'
        if (attributes.status === 'hiatus') status = 'Hiatus'
        if (attributes.status === 'cancelled') status = 'Cancelled'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: tags })],
                desc: desc
            })
        })
    }

    parseChapters(data: any): Chapter[] {
        const chapters: Chapter[] = []
        
        // Mapping codici ISO a bandiere/nomi Paperback se necessario (di solito PB gestisce ISO standard)
        // 'it' -> Italian, 'en' -> English, etc.

        for (const chapter of data.data) {
            const attr = chapter.attributes
            const rels = chapter.relationships
            
            const scanGroup = rels.find((r: any) => r.type === 'scanlation_group')?.attributes?.name
            
            let title = ''
            if (attr.title) title = attr.title
            // Se non c'è titolo, usa "Chapter X"
            if (!title && attr.chapter) title = `Chapter ${attr.chapter}`
            if (!title) title = 'Oneshot'

            // Se c'è un gruppo scan, aggiungilo al nome (opzionale, ma utile)
            // if (scanGroup) title += ` [${scanGroup}]`

            const time = new Date(attr.publishAt)
            
            chapters.push(App.createChapter({
                id: chapter.id,
                name: title,
                chapNum: parseFloat(attr.chapter) || 0,
                volume: parseFloat(attr.volume) || undefined,
                time: time,
                langCode: attr.translatedLanguage, // 'it', 'en', etc.
                group: scanGroup
            }))
        }

        return chapters
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        const baseUrl = data.baseUrl
        const hash = data.chapter.hash
        const files = data.chapter.data // Usa 'data' per alta qualità, 'dataSaver' per bassa qualità

        const pages = files.map((file: string) => `${baseUrl}/data/${hash}/${file}`)

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults(data: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        for (const manga of data.data) {
            const attr = manga.attributes
            const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
            
            const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
            const fileName = coverRel?.attributes?.fileName
            
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            if (fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` // Thumbnails più piccole per le liste
            }

            // Subtitle: Status
            const subtitle = attr.status === 'ongoing' ? 'Ongoing' : 'Completed'

            results.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: image,
                title: title,
                subtitle: subtitle
            }))
        }
        return results
    }
}