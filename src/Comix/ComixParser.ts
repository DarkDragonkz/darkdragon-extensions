import {
    Chapter,
    ChapterDetails,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

// Mappatura generi statica
const GENRES = [
    { id: "6", value: "Action" }, { id: "87264", value: "Adult" }, { id: "7", value: "Adventure" },
    { id: "8", value: "Boys Love" }, { id: "9", value: "Comedy" }, { id: "10", value: "Crime" },
    { id: "11", value: "Drama" }, { id: "87265", value: "Ecchi" }, { id: "12", value: "Fantasy" },
    { id: "13", value: "Girls Love" }, { id: "87266", value: "Hentai" }, { id: "14", value: "Historical" },
    { id: "15", value: "Horror" }, { id: "16", value: "Isekai" }, { id: "17", value: "Magical Girls" },
    { id: "87267", value: "Mature" }, { id: "18", value: "Mecha" }, { id: "19", value: "Medical" },
    { id: "20", value: "Mystery" }, { id: "21", value: "Philosophical" }, { id: "22", value: "Psychological" },
    { id: "23", value: "Romance" }, { id: "87268", value: "Sci-Fi" }, { id: "25", value: "Seinen" },
    { id: "26", value: "Shoujo" }, { id: "27", value: "Shoujo Ai" }, { id: "28", value: "Shounen" },
    { id: "29", value: "Shounen Ai" }, { id: "30", value: "Slice of Life" }, { id: "87269", value: "Smut" },
    { id: "32", value: "Sports" }, { id: "33", value: "Superhero" }, { id: "34", value: "Thriller" },
    { id: "35", value: "Tragedy" }, { id: "36", value: "Wuxia" }, { id: "37", value: "Yaoi" },
    { id: "38", value: "Yuri" }
]

export class ComixParser {

    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const item = data.result || {}
        
        const titles = [item.title ?? 'Unknown']
        if (item.alt_titles && Array.isArray(item.alt_titles)) {
            titles.push(...item.alt_titles)
        }

        const authors = item.author?.map((a: any) => a.title) || []
        const artists = item.artist?.map((a: any) => a.title) || []

        const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'

        let desc = item.synopsis || 'No synopsis available.'
        
        if (item.rated_avg) {
            desc = `⭐ Rating: ${item.rated_avg}/10\n\n${desc}`
        }
        if (item.alt_titles && item.alt_titles.length > 0) {
            desc += `\n\nAlt Titles:\n${item.alt_titles.join(', ')}`
        }

        let status = 'Ongoing'
        if (item.status === 'finished') status = 'Completed'
        if (item.status === 'canceled') status = 'Dropped' 
        if (item.status === 'on_hiatus') status = 'Hiatus'

        const tags: Tag[] = []
        if (item.term_ids && Array.isArray(item.term_ids)) {
            for (const id of item.term_ids) {
                const genre = GENRES.find(g => g.id === String(id))
                if (genre) {
                    tags.push(App.createTag({ id: genre.id, label: genre.value }))
                }
            }
        }
        
        if (item.is_nsfw) {
            tags.push(App.createTag({ id: 'nsfw', label: 'NSFW' }))
        }

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: titles,
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: tags })],
                desc: desc,
                rating: item.rated_avg ? parseFloat(item.rated_avg) : undefined
            })
        })
    }

    parseChapters(items: any[]): Chapter[] {
        const chapters: Chapter[] = []
        
        // --- LOGICA DI DEDUPLICAZIONE (BEST VERSION) ---
        const chapterMap = new Map<string, any>()

        for (const item of items) {
            const chapNumStr = String(item.number) // Usiamo stringa per evitare problemi float

            // Se è il primo che incontriamo con questo numero, lo salviamo
            if (!chapterMap.has(chapNumStr)) {
                chapterMap.set(chapNumStr, item)
            } else {
                // Se ne esiste già uno, facciamo la "battaglia"
                const existing = chapterMap.get(chapNumStr)
                const isOfficial = (entry: any) =>
                    Boolean(entry.is_official ?? entry.isOfficial ?? entry.official)

                // Punteggio: Likes (priorità) + Views (fallback)
                // Usiamo 0 se il campo manca
                const scoreExisting = (existing.likes ?? existing.up_count ?? 0) * 1000 + (existing.views ?? 0)
                const scoreCurrent = (item.likes ?? item.up_count ?? 0) * 1000 + (item.views ?? 0)
                const existingOfficial = isOfficial(existing)
                const currentOfficial = isOfficial(item)

                // Priorita': official > punteggio (likes/views)
                if (currentOfficial && !existingOfficial) {
                    chapterMap.set(chapNumStr, item)
                } else if (currentOfficial === existingOfficial && scoreCurrent > scoreExisting) {
                    chapterMap.set(chapNumStr, item)
                }
            }
        }

        // Convertiamo la Map filtrata di nuovo in un array da processare
        const uniqueItems = Array.from(chapterMap.values())

        // --- FINE DEDUPLICAZIONE ---

        for (let i = 0; i < uniqueItems.length; i++) {
            const item = uniqueItems[i]
            
            let time = new Date()
            if (item.created_at) {
                time = new Date(item.created_at * 1000) 
            }

            const chapNum = parseFloat(item.number)
            const chapNumStr = String(item.number)
            const volumeNum = item.volume ? parseFloat(item.volume) : undefined
            const volumeStr = item.volume ? String(item.volume) : ''

            // FIX NOMENCLATURA
            let name = item.name ? String(item.name).trim() : ''

            if (name === chapNumStr) name = ''

            name = name.replace(new RegExp(`^(chapter|ch\\.?)\\s*${chapNum}`, 'i'), '').trim()
            name = name.replace(/^[---]\s*/, '').trim()

            if (volumeStr && name) {
                const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const volPattern = escapeRegExp(volumeStr)
                const chPattern = escapeRegExp(chapNumStr)
                const volChRegex = new RegExp(`^vol(?:ume)?\\.?\\s*${volPattern}\\s*ch(?:apter)?\\.?\\s*${chPattern}$`, 'i')
                if (volChRegex.test(name)) {
                    name = `Ch. ${chapNumStr} Vol. ${volumeStr}`
                }
            }

            chapters.push(App.createChapter({
                id: String(item.chapter_id),
                name: name,
                chapNum: chapNum,
                volume: volumeNum,
                time: time,
                langCode: item.language || 'en',
                sortingIndex: i 
            }))
        }
        
        // Ordiniamo per sicurezza (descending)
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
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

    parseSearchResults(data: any, context: 'search' | 'popular' | 'latest' = 'search'): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = data.result?.items || []

        for (const item of items) {
            const id = item.hash_id
            const title = item.title
            const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'
            
            let subtitle = undefined
            
            if (context === 'latest' || context === 'search') {
                if (item.latest_chapter) {
                    subtitle = `Ch. ${item.latest_chapter}`
                }
            } else if (context === 'popular') {
                if (item.author && item.author.length > 0) {
                    subtitle = item.author[0].title
                } else if (item.status) {
                    subtitle = item.status === 'finished' ? 'Completed' : 'Ongoing'
                }
            }

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
}

