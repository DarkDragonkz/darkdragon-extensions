import {
    Chapter,
    ChapterDetails,
    Tag,
    TagSection,
    SourceManga,
    PartialSourceManga
} from '@paperback/types'

const MD_UPLOADS = 'https://uploads.mangadex.org'

export class MangaDexITParser {

    /**
     * Parsa i dettagli del manga dando priorità assoluta ai metadati Italiani.
     */
    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const attr = data.data?.attributes || {}
        const relationships = data.data?.relationships || []

        // Titolo: Priorità IT -> EN -> Primo disponibile
        const altTitleIT = attr.altTitles?.find((t: any) => t.it)?.it
        const title = attr.title?.it ?? altTitleIT ?? attr.title?.en ?? Object.values(attr.title || {})[0] ?? 'Titolo Sconosciuto'
        
        const desc = attr.description?.it ?? attr.description?.en ?? Object.values(attr.description || {})[0] ?? 'Nessuna descrizione disponibile.'
        
        // Autori e Artisti
        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)

        // Copertina
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        // Status
        let status = 'Ongoing'
        switch (attr.status) {
            case 'completed': status = 'Completed'; break;
            case 'hiatus': status = 'Hiatus'; break;
            case 'cancelled': status = 'Cancelled'; break;
        }

        // Tags
        const tags: TagSection[] = []
        if (attr.tags && Array.isArray(attr.tags)) {
            const mappedTags = attr.tags.map((tag: any) => 
                App.createTag({ id: tag.id, label: tag.attributes.name.en }) 
            )
            tags.push(App.createTagSection({ id: '0', label: 'Generi', tags: mappedTags }))
        }

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

    /**
     * Parsa i capitoli con deduplicazione (Latest Version Wins).
     */
    parseChapters(data: any[]): Chapter[] {
        const chapters: Chapter[] = []
        if (!data) return []

        const seenChapters = new Set<string>()

        // 1. Ordiniamo per data di pubblicazione (dal più recente)
        // Così il primo capitolo che processiamo per ogni numero è l'ultima versione caricata.
        data.sort((a, b) => {
            const dateA = new Date(a.attributes.publishAt).getTime()
            const dateB = new Date(b.attributes.publishAt).getTime()
            return dateB - dateA
        })

        for (const chapter of data) {
            const attr = chapter.attributes
            
            // Saltiamo capitoli esterni o senza pagine
            if (attr.pages === 0 || attr.externalUrl !== null) continue;

            const chapNum = parseFloat(attr.chapter)
            // Usa una chiave univoca per il numero (gestisce decimali es. 10.5)
            // Se è NaN (oneshot), usiamo l'ID per non nasconderlo
            const chapNumId = !isNaN(chapNum) ? String(chapNum) : `id:${chapter.id}`

            // --- DEDUPLICAZIONE ---
            if (seenChapters.has(chapNumId) && !isNaN(chapNum)) {
                continue
            }
            seenChapters.add(chapNumId)
            // ----------------------

            const relationships = chapter.relationships || []
            const group = relationships.find((r: any) => r.type === 'scanlation_group')?.attributes?.name

            // Logica Titolo Pulita
            // Non mettiamo "Vol." o "Ch." nel nome, Paperback lo fa da solo usando i metadati.
            // Mettiamo solo il titolo del capitolo se esiste.
            let name = attr.title ? String(attr.title).trim() : ''
            
            // Se il titolo è uguale al numero, lo svuotiamo (es. "1")
            if (name === String(chapNum)) name = ''

            chapters.push(App.createChapter({
                id: chapter.id,
                name: name, // Solo il titolo reale o vuoto
                chapNum: isNaN(chapNum) ? 0 : chapNum,
                volume: parseFloat(attr.volume) || undefined,
                time: new Date(attr.publishAt),
                langCode: 'it',
                group: group // Paperback lo mostrerà sotto
            }))
        }

        // Sorting finale per l'App (dal più alto al più basso)
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        if (data.baseUrl && data.chapter?.data) {
            const baseUrl = data.baseUrl
            const hash = data.chapter.hash
            const fileNames = data.chapter.data

            const pages = fileNames.map((file: string) => `${baseUrl}/data/${hash}/${file}`)

            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: pages
            })
        }
        throw new Error('Dati capitolo non validi o mancanti')
    }

    parseSearchResults(data: any, useHighQualityCover: boolean = false): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const mangaList = data.data || []

        for (const manga of mangaList) {
            const attr = manga.attributes
            
            // Titolo: Priorità IT -> EN
            const altTitleIT = attr.altTitles?.find((t: any) => t.it)?.it
            const title = attr.title?.it ?? altTitleIT ?? attr.title?.en ?? Object.values(attr.title || {})[0] ?? 'Sconosciuto'
            
            const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
            const fileName = coverRel?.attributes?.fileName
            
            let image = 'https://paperback.moe/icons/logo-alt.svg'
            if (fileName) {
                const qualitySuffix = useHighQualityCover ? '.512.jpg' : '.256.jpg'
                image = `${MD_UPLOADS}/covers/${manga.id}/${fileName}${qualitySuffix}`
            }

            results.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: image,
                title: title,
                subtitle: attr.status === 'ongoing' ? 'In corso' : (attr.status === 'completed' ? 'Completato' : undefined)
            }))
        }
        return results
    }
}