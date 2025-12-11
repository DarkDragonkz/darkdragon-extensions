import {
    Chapter,
    ChapterDetails,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

// Mappatura generi statica per evitare chiamate API inutili
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
        const item = data.result
        
        // Titoli e Autori
        const titles = [item.title]
        if (item.alt_titles && Array.isArray(item.alt_titles)) {
            titles.push(...item.alt_titles)
        }

        const authors = item.author?.map((a: any) => a.title) || []
        const artists = item.artist?.map((a: any) => a.title) || []

        // Immagine
        const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'

        // Descrizione Arricchita
        let desc = item.synopsis || 'No synopsis available.'
        
        // Aggiungiamo info extra alla descrizione per l'utente
        if (item.rated_avg) {
            desc = `⭐ Rating: ${item.rated_avg}/10\n\n${desc}`
        }
        if (item.alt_titles && item.alt_titles.length > 0) {
            desc += `\n\nAlt Titles:\n${item.alt_titles.join(', ')}`
        }

        // Status
        let status = 'Ongoing'
        if (item.status === 'finished') status = 'Completed'
        if (item.status === 'canceled') status = 'Dropped' // Mapping extra se supportato

        // Tags
        const tags: Tag[] = []
        if (item.term_ids && Array.isArray(item.term_ids)) {
            for (const id of item.term_ids) {
                const genre = GENRES.find(g => g.id === String(id))
                if (genre) {
                    tags.push(App.createTag({ id: genre.id, label: genre.value }))
                }
            }
        }
        
        // Aggiunge flag NSFW come tag se necessario
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
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            
            // Gestione Data: Le API PHP di solito ritornano secondi, JS vuole millisecondi
            let time = new Date()
            if (item.created_at) {
                time = new Date(item.created_at * 1000) 
            }

            // Nome Capitolo Pulito
            let name = item.name ? `${item.name}` : `Chapter ${item.number}`
            if (item.number && !name.includes(String(item.number))) {
                name = `Ch. ${item.number} - ${name}`
            }

            chapters.push(App.createChapter({
                id: String(item.chapter_id),
                name: name,
                chapNum: parseFloat(item.number),
                volume: item.volume ? parseFloat(item.volume) : undefined, // Supporto Volumi
                time: time,
                langCode: item.language || 'en',
                sortingIndex: i 
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

    // Aggiunto parametro 'context' per sottotitoli intelligenti
    parseSearchResults(data: any, context: 'search' | 'popular' | 'latest' = 'search'): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = data.result?.items || []

        for (const item of items) {
            const id = item.hash_id
            const title = item.title
            const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'
            
            // SOTTOTITOLI INTELLIGENTI
            let subtitle = undefined
            
            if (context === 'latest' || context === 'search') {
                // Per gli ultimi aggiornamenti, l'utente vuole vedere il numero del capitolo
                if (item.latest_chapter) {
                    subtitle = `Ch. ${item.latest_chapter}`
                }
            } else if (context === 'popular') {
                // Per i popolari, è meglio vedere l'autore o lo stato
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