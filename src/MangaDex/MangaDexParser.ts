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

    /**
     * Parsa i dettagli completi di un manga.
     */
    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        // Titolo: Preferenza EN -> Primo disponibile -> Fallback
        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        
        let desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''
        const availableLanguages = attributes.availableTranslatedLanguages || []
        if (!availableLanguages.includes('en')) {
            desc = `⚠️ [NO ENGLISH CHAPTERS AVAILABLE]\n\n${desc}`
        }

        // Estrazione Autori e Artisti
        const authors = relationships
            .filter((r: any) => r.type === 'author')
            .map((r: any) => r.attributes?.name)
            .filter((n: any) => n)
        
        const artists = relationships
            .filter((r: any) => r.type === 'artist')
            .map((r: any) => r.attributes?.name)
            .filter((n: any) => n)
        
        // Copertina: Usa qualità originale per la pagina dettagli
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        // Status
        let status = 'Ongoing'
        switch (attributes.status) {
            case 'completed': status = 'Completed'; break;
            case 'hiatus': status = 'Hiatus'; break;
            case 'cancelled': status = 'Cancelled'; break;
        }

        // Tags
        const tags: TagSection[] = []
        if (attributes.tags && Array.isArray(attributes.tags)) {
            const mappedTags = attributes.tags.map((tag: any) => 
                App.createTag({ id: tag.id, label: tag.attributes.name.en })
            )
            tags.push(App.createTagSection({ id: '0', label: 'Genres', tags: mappedTags }))
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
     * Parsa la lista dei capitoli includendo i gruppi di scanlation.
     */
    parseChapters(data: any): Chapter[] {
        const chapters: Chapter[] = []
        if (!data.data) return []

        for (const chapter of data.data) {
            const attr = chapter.attributes
            const relationships = chapter.relationships || []

            // Trova il gruppo di scanlation
            const groups = relationships
                .filter((r: any) => r.type === 'scanlation_group')
                .map((r: any) => r.attributes?.name)
                .filter((n: any) => n)
            
            const groupName = groups.length > 0 ? groups.join(' & ') : undefined

            // Logica Titolo
            let title = ''
            if (attr.title) {
                // Se c'è un titolo specifico (es. "The Final Battle")
                title = attr.title
            } 
            
            // Se non c'è titolo o è corto, aggiungiamo "Chapter X" se serve, ma Paperback lo gestisce con chapNum.
            // Costruiamo un nome visualizzato pulito:
            let displayName = ''
            if (attr.volume) displayName += `Vol.${attr.volume} `
            displayName += `Ch.${attr.chapter ?? '?'}`
            if (title) displayName += ` - ${title}`

            // External handling
            if (attr.externalUrl !== null || attr.pages === 0) {
                displayName = `🚫 [External] ${displayName}`
            }

            chapters.push(App.createChapter({
                id: chapter.id,
                name: displayName, // Es: "Vol.1 Ch.10 - Battle [Asura Scans]"
                chapNum: parseFloat(attr.chapter) || 0,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: 'en',
                group: groupName
            }))
        }

        return chapters
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        if (data.baseUrl) {
            const baseUrl = data.baseUrl
            const hash = data.chapter.hash
            const fileNames = data.chapter.data // 'data' = alta qualità, 'dataSaver' = bassa

            const pages = fileNames.map((file: string) => `${baseUrl}/data/${hash}/${file}`)

            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: pages
            })
        }
        
        throw new Error('Chapter data not found or external')
    }

    /**
     * Parsa i risultati di ricerca/home.
     * @param useHighQualityCover Se true, usa .512.jpg invece di .256.jpg (per sezioni grandi)
     */
    parseSearchResults(data: any, useHighQualityCover: boolean = false): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (data.data) {
            for (const manga of data.data) {
                const attr = manga.attributes
                const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
                
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                
                // UX TWEAK: Qualità copertina adattiva
                let image = 'https://paperback.moe/icons/logo-alt.svg'
                if (fileName) {
                    const qualitySuffix = useHighQualityCover ? '.512.jpg' : '.256.jpg'
                    image = `${MD_UPLOADS}/covers/${manga.id}/${fileName}${qualitySuffix}`
                }

                // Subtitle: Status o info utili
                let subtitle = undefined
                const availableLanguages = attr.availableTranslatedLanguages || []
                if (!availableLanguages.includes('en')) {
                    subtitle = '🚫 No EN'
                } else {
                    // Mostra l'ultimo update se disponibile (nei risultati di ricerca rating/follows sono più comuni)
                    subtitle = attr.status === 'ongoing' ? 'Ongoing' : attr.status
                }

                results.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        return results
    }
}