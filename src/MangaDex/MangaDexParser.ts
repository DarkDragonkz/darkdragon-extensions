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
        const attributes = data.data?.attributes || {}
        const relationships = data.data?.relationships || []

        const title = attributes.title?.en ?? Object.values(attributes.title || {})[0] ?? 'Unknown Title'
        const desc = attributes.description?.en ?? Object.values(attributes.description || {})[0] ?? ''
        
        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)

        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const coverFileName = coverRel?.attributes?.fileName
        
        const image = coverFileName ? `${MD_UPLOADS}/covers/${mangaId}/${coverFileName}.512.jpg` : 'https://paperback.moe/icons/logo-alt.svg'

        const tags: Tag[] = []
        if (attributes.tags) {
            for (const tag of attributes.tags) {
                tags.push(App.createTag({ id: tag.id, label: tag.attributes.name.en }))
            }
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

    parseChapters(data: any[]): Chapter[] {
        const chapters: Chapter[] = []
        
        for (const chapter of data) {
            const attr = chapter.attributes
            
            // Filtro capitoli esterni
            if (attr.externalUrl) {
                continue 
            }

            const rels = chapter.relationships || []
            const scanGroup = rels.find((r: any) => r.type === 'scanlation_group')?.attributes?.name
            
            const chapNum = parseFloat(attr.chapter) || 0
            
            // Costruzione Nome:
            // MD spesso ritorna un titolo vuoto o null.
            // Se c'è un titolo, lo usiamo. Se no, lasciamo gestire all'app "Ch. X".
            let name = attr.title ? String(attr.title).trim() : ''

            // Se il titolo è solo il numero del capitolo, lo puliamo
            if (name === String(chapNum)) name = ''

            const time = new Date(attr.publishAt)
            
            chapters.push(App.createChapter({
                id: chapter.id,
                name: name,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || undefined,
                time: time,
                langCode: attr.translatedLanguage || 'en', 
                group: scanGroup // Aggiunge il gruppo di scanlation
            }))
        }
        
        // Sorting Client-Side per sicurezza (Descending)
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        const baseUrl = data.baseUrl
        const hash = data.chapter.hash
        const files = data.chapter.data 

        const pages = files.map((file: string) => `${baseUrl}/data/${hash}/${file}`)

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults(data: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const mangaList = data.data || []
        
        for (const manga of mangaList) {
            const attr = manga.attributes
            const title = attr.title?.en ?? Object.values(attr.title || {})[0] ?? 'Unknown'
            
            const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
            const fileName = coverRel?.attributes?.fileName
            
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            if (fileName) {
                image = `${MD_UPLOADS}/covers/${manga.id}/${fileName}.512.jpg`
            }

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