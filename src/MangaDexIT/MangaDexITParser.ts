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
        const attr = data.data.attributes
        const relationships = data.data.relationships

        // Titolo: Priorità IT -> EN -> Primo disponibile
        // Spesso il titolo IT è negli altTitles se non è quello principale
        const altTitleIT = attr.altTitles.find((t: any) => t.it)?.it
        const title = attr.title.it ?? altTitleIT ?? attr.title.en ?? Object.values(attr.title)[0] ?? 'Titolo Sconosciuto'
        
        const desc = attr.description.it ?? attr.description.en ?? Object.values(attr.description)[0] ?? 'Nessuna descrizione disponibile.'
        
        // Autori e Artisti
        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)

        // Copertina: Usa qualità originale per la pagina dettagli
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        // Status tradotto
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
                App.createTag({ id: tag.id, label: tag.attributes.name.en }) // Mantengo EN per i tag (più standard)
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
     * Parsa i capitoli. Include il gruppo di scanlation nel titolo per chiarezza.
     */
    parseChapters(data: any): Chapter[] {
        const chapters: Chapter[] = []
        if (!data.data) return []

        for (const chapter of data.data) {
            const attr = chapter.attributes
            
            // Saltiamo capitoli esterni o senza pagine
            if (attr.pages === 0 || attr.externalUrl !== null) continue;

            const relationships = chapter.relationships || []
            const group = relationships.find((r: any) => r.type === 'scanlation_group')?.attributes?.name

            // Logica Titolo: "Vol.1 Ch.10 - Titolo [Gruppo]"
            let name = ''
            if (attr.volume) name += `Vol.${attr.volume} `
            name += `Ch.${attr.chapter ?? '?'}`
            
            if (attr.title) {
                name += ` - ${attr.title}`
            }

            chapters.push(App.createChapter({
                id: chapter.id,
                name: name,
                chapNum: parseFloat(attr.chapter) || 0,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: 'it',
                group: group // Paperback lo mostrerà sotto il titolo
            }))
        }

        return chapters
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

    /**
     * Parsa risultati di ricerca e home.
     * @param useHighQualityCover Se true usa .512.jpg, altrimenti .256.jpg
     */
    parseSearchResults(data: any, useHighQualityCover: boolean = false): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (data.data) {
            for (const manga of data.data) {
                const attr = manga.attributes
                
                // Titolo: Priorità IT -> EN
                const altTitleIT = attr.altTitles?.find((t: any) => t.it)?.it
                const title = attr.title.it ?? altTitleIT ?? attr.title.en ?? Object.values(attr.title)[0] ?? 'Sconosciuto'
                
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
        }
        return results
    }
}