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
        const seenChapters = new Set<string>() // Set per tracciare i numeri già visti

        // 1. Ordiniamo i dati grezzi per DATA DI PUBBLICAZIONE (dal più recente al più vecchio).
        // Questo assicura che quando incontriamo un duplicato, il primo che processiamo (e teniamo)
        // sia l'ultima versione caricata (es. v2 o fix).
        data.sort((a, b) => {
            const dateA = new Date(a.attributes.publishAt).getTime()
            const dateB = new Date(b.attributes.publishAt).getTime()
            return dateB - dateA
        })
        
        for (const chapter of data) {
            const attr = chapter.attributes
            
            // Filtro capitoli esterni
            if (attr.externalUrl) continue 

            const chapNum = parseFloat(attr.chapter)
            // Usa una stringa univoca per il numero (gestisce anche i decimali come 10.5)
            // Se chapNum è NaN (es. Oneshots senza numero), usiamo l'ID come fallback per non nasconderli
            const chapNumId = !isNaN(chapNum) ? String(chapNum) : `id:${chapter.id}`

            // --- LOGICA DEDUPLICAZIONE ---
            // Se abbiamo già aggiunto questo numero di capitolo, saltiamo (perché abbiamo già preso il più recente)
            if (seenChapters.has(chapNumId) && !isNaN(chapNum)) {
                continue
            }
            seenChapters.add(chapNumId)
            // -----------------------------

            const rels = chapter.relationships || []
            const scanGroup = rels.find((r: any) => r.type === 'scanlation_group')?.attributes?.name
            
            // Nomenclatura Pulita
            let name = attr.title ? String(attr.title).trim() : ''
            if (name === String(chapNum)) name = ''

            const time = new Date(attr.publishAt)
            
            chapters.push(App.createChapter({
                id: chapter.id,
                name: name,
                chapNum: isNaN(chapNum) ? 0 : chapNum,
                volume: parseFloat(attr.volume) || undefined,
                time: time,
                langCode: attr.translatedLanguage || 'en', 
                group: scanGroup
            }))
        }
        
        // Sorting finale per l'App (dal più alto al più basso)
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        const baseUrl = data.baseUrl
        const chapter = data.chapter
        const hash = chapter?.hash
        const files = chapter?.data

        if (!baseUrl || !hash || !Array.isArray(files)) {
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: []
            })
        }

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
            
            const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art')
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
