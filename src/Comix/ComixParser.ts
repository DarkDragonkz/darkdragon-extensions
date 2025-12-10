import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://comix.to'

export class ComixParser {

    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const manga = data.result
        
        const title = manga.title || 'Unknown'
        const image = manga.poster?.large || manga.poster?.medium || manga.poster?.small || 'https://paperback.moe/icons/logo-alt.svg'
        const desc = manga.synopsis || 'No description available'
        
        let status = 'Ongoing'
        if (manga.status === 'finished') status = 'Completed'
        else if (manga.status === 'on_hiatus') status = 'Hiatus'

        // Autori e Artisti
        const authors = manga.author?.map((a: any) => a.title).join(', ') || 'Unknown'
        const artists = manga.artist?.map((a: any) => a.title).join(', ') || 'Unknown'

        // Tags
        const arrayTags: Tag[] = []
        // Non abbiamo la lista completa dei tag ID-Name qui senza fare altre chiamate, 
        // ma possiamo mapparli se il JSON li fornisce in altro modo o ignorarli per ora se non critici.
        // L'API V2 di solito restituisce "term_ids", che richiederebbero una mappa ID->Nome.
        // Per semplicità, in questa versione base API, saltiamo i tag se non sono espliciti nel JSON dettagli.
        
        const tagSections: TagSection[] = []
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors,
                artist: artists,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters(data: any): Chapter[] {
        // L'API restituisce i capitoli in data.result.items
        const chapters: Chapter[] = []
        const items = data.result?.items || []

        for (const chap of items) {
            // L'ID del capitolo è numerico (chapter_id)
            const id = String(chap.chapter_id)
            
            let title = chap.name || ''
            if (!title) title = `Chapter ${chap.number}`
            if (chap.volume > 0) title = `Vol.${chap.volume} ${title}`

            const time = new Date(chap.created_at * 1000) // Timestamp UNIX
            const chapNum = parseFloat(chap.number) || 0

            chapters.push(App.createChapter({
                id: id,
                name: title,
                chapNum: chapNum,
                volume: chap.volume || 0,
                time: time,
                langCode: 'en'
            }))
        }
        
        return chapters
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const images = data.result?.images || []
        
        for (const img of images) {
            if (img.url) pages.push(img.url)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults(data: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = data.result?.items || []

        for (const item of items) {
            const id = item.hash_id // Comix usa hash_id per i link (es. /title/hash_id-slug)
            const title = item.title
            const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'
            
            // Sottotitolo: Ultimo capitolo
            const subtitle = item.latest_chapter ? `Ch. ${item.latest_chapter}` : undefined

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        return results
    }

    parseHomeSection(data: any, sectionId: string): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        const list = data.result?.items || []

        for (const item of list) {
            const id = item.hash_id
            const title = item.title
            const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'
            const subtitle = item.latest_chapter ? `Ch. ${item.latest_chapter}` : undefined

            if (id && title) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        return items
    }
}