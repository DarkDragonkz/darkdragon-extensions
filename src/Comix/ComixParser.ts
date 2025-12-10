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

const GENRES = [
    { id: "6", value: "Action" }, { id: "87264", value: "Adult" }, { id: "7", value: "Adventure" },
    { id: "8", value: "Boys Love" }, { id: "9", value: "Comedy" }, { id: "10", value: "Crime" },
    { id: "11", value: "Drama" }, { id: "87265", value: "Ecchi" }, { id: "12", value: "Fantasy" },
    { id: "13", value: "Girls Love" }, { id: "87266", value: "Hentai" }, { id: "14", value: "Historical" },
    { id: "15", value: "Horror" }, { id: "16", value: "Isekai" }, { id: "17", value: "Magical Girls" },
    { id: "87267", value: "Mature" }, { id: "18", value: "Mecha" }, { id: "19", value: "Medical" },
    { id: "20", value: "Mystery" }, { id: "21", value: "Philosophical" }, { id: "22", value: "Psychological" },
    { id: "23", value: "Romance" }, { id: "24", value: "Sci-Fi" }, { id: "25", value: "Slice of Life" },
    { id: "87268", value: "Smut" }, { id: "26", value: "Sports" }, { id: "27", value: "Superhero" },
    { id: "28", value: "Thriller" }, { id: "29", value: "Tragedy" }, { id: "30", value: "Wuxia" }
]

const THEMES = [
    { id: "31", value: "Aliens" }, { id: "32", value: "Animals" }, { id: "33", value: "Cooking" },
    { id: "34", value: "Crossdressing" }, { id: "35", value: "Delinquents" }, { id: "36", value: "Demons" },
    { id: "37", value: "Genderswap" }, { id: "38", value: "Ghosts" }, { id: "39", value: "Gyaru" },
    { id: "40", value: "Harem" }, { id: "41", value: "Incest" }, { id: "42", value: "Loli" },
    { id: "43", value: "Mafia" }, { id: "44", value: "Magic" }, { id: "45", value: "Martial Arts" },
    { id: "46", value: "Military" }, { id: "47", value: "Monster Girls" }, { id: "48", value: "Monsters" },
    { id: "49", value: "Music" }, { id: "50", value: "Ninja" }, { id: "51", value: "Office Workers" },
    { id: "52", value: "Police" }, { id: "53", value: "Post-Apocalyptic" }, { id: "54", value: "Reincarnation" },
    { id: "55", value: "Reverse Harem" }, { id: "56", value: "Samurai" }, { id: "57", value: "School Life" },
    { id: "58", value: "Shota" }, { id: "59", value: "Supernatural" }, { id: "60", value: "Survival" },
    { id: "61", value: "Time Travel" }, { id: "62", value: "Traditional Games" }, { id: "63", value: "Vampires" },
    { id: "64", value: "Video Games" }, { id: "65", value: "Villainess" }, { id: "66", value: "Virtual Reality" },
    { id: "67", value: "Zombies" }
]

export class ComixParser {

    parseMangaDetails(data: any, mangaId: string): SourceManga {
        const manga = data.result
        
        const title = manga.title || 'Unknown'
        const image = manga.poster?.large || manga.poster?.medium || manga.poster?.small || 'https://paperback.moe/icons/logo-alt.svg'
        const desc = manga.synopsis || 'No description available'
        
        let status = 'Ongoing'
        if (manga.status === 'finished') status = 'Completed'
        else if (manga.status === 'on_hiatus') status = 'Hiatus'
        else if (manga.status === 'discontinued') status = 'Discontinued'

        const authors = manga.author?.map((a: any) => a.title).join(', ') || 'Unknown'
        const artists = manga.artist?.map((a: any) => a.title).join(', ') || 'Unknown'

        const termIds: number[] = manga.term_ids || []
        const genresTags: Tag[] = []
        const themesTags: Tag[] = []

        GENRES.forEach(g => {
            if (termIds.includes(Number(g.id))) genresTags.push(App.createTag({ id: g.id, label: g.value }))
        })
        THEMES.forEach(t => {
            if (termIds.includes(Number(t.id))) themesTags.push(App.createTag({ id: t.id, label: t.value }))
        })
        
        const tagSections: TagSection[] = []
        if (genresTags.length > 0) tagSections.push(App.createTagSection({ id: 'genres', label: 'Genres', tags: genresTags }))
        if (themesTags.length > 0) tagSections.push(App.createTagSection({ id: 'themes', label: 'Themes', tags: themesTags }))

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

    parseChapters(chaptersData: any[]): Chapter[] {
        const chapters: Chapter[] = []

        for (let i = 0; i < chaptersData.length; i++) {
            const chap = chaptersData[i]
            const id = String(chap.chapter_id)
            
            let title = chap.name || ''
            const num = parseFloat(chap.number) || 0
            
            if (!title) title = `Chapter ${chap.number}`
            
            let volStr = ''
            if (chap.volume > 0) volStr = `Vol.${chap.volume} `

            let finalTitle = `${volStr}${title}`
            if (chap.name && !chap.name.includes('Chapter')) {
                 finalTitle = `${volStr}Ch. ${chap.number} - ${chap.name}`
            }

            const time = new Date(chap.updated_at * 1000)

            chapters.push(App.createChapter({
                id: id,
                name: finalTitle,
                chapNum: num,
                volume: chap.volume || 0,
                time: time,
                langCode: chap.language || 'en',
                group: chap.scanlation_group?.name || undefined,
                sortingIndex: i // FIX: Ordine forzato basato sulla lista (0 = primo/più recente)
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
            const id = item.hash_id
            const title = item.title
            const image = item.poster?.large || item.poster?.medium || 'https://paperback.moe/icons/logo-alt.svg'
            
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

    parseHomeSectionItems(data: any): PartialSourceManga[] {
        return this.parseSearchResults(data)
    }
}