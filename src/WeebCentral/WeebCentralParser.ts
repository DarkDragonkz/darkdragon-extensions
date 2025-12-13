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

const BASE_URL = 'https://weebcentral.com'

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Titolo: Cerca l'H1 (Desktop standard) oppure l'alt dell'immagine come fallback
        let title = $('h1').first().text().trim() 
        if (!title) title = $('picture img').attr('alt')?.replace(' cover', '') ?? 'Unknown'

        // Immagine: Prendiamo quella dentro il blocco desktop se possibile
        // Cerca source con media query min-width o semplicemente l'immagine di fallback
        let image = $('picture source[media*="min-width"]').attr('srcset') ?? ''
        if (!image) image = $('picture img').attr('src') ?? ''
        
        const desc = $('p.text-lg').text().trim() || 'No description'

        let status = 'Ongoing'
        let author = 'Unknown'
        let artist = 'Unknown'
        const arrayTags: Tag[] = []

        // Parsing Metadata Desktop
        // Cerca la lista di info
        $('ul.flex.flex-col.gap-4 li').each((_: any, li: any) => {
            const label = $('strong', li).text().trim()
            const links = $('a', li)

            if (label.includes('Author')) {
                author = links.map((_: any, a: any) => $(a).text().trim()).get().join(', ')
            }
            if (label.includes('Status')) {
                const statusText = links.first().text().trim().toLowerCase()
                if (statusText.includes('complete')) status = 'Completed'
                else if (statusText.includes('ongoing')) status = 'Ongoing'
                else if (statusText.includes('hiatus')) status = 'Hiatus'
            }
            if (label.includes('Tags') || label.includes('Type')) {
                links.each((_: any, a: any) => {
                    const tagLabel = $(a).text().trim()
                    if (tagLabel) {
                        arrayTags.push(App.createTag({ id: tagLabel, label: tagLabel }))
                    }
                })
            }
        })

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []

        // Selettore lista capitoli
        $('#chapter-list > div').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            // Titolo: "Chapter 200"
            const name = link.find('span.grow span').first().text().trim()
            const chapNumMatch = name.match(/Chapter\s+(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            const dateStr = link.find('time').attr('datetime')
            const time = dateStr ? new Date(dateStr) : new Date()

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        // Iteriamo su ogni articolo (riga di risultato)
        $('article.bg-base-300').each((_: any, article: any) => {
            // -- LOGICA DESKTOP --
            
            // 1. Trova il blocco INFO Desktop (quello con class "hidden lg:block")
            // Usiamo il selettore che cerca la colonna di testo larga
            const desktopInfo = $(article).find('section.lg\\:w-\\[75\\%\\]') 
            // Nota: Se il selettore sopra fallisce per i caratteri speciali, usiamo un approccio più generico:
            // Cerchiamo il div che ha il titolo con classe "text-lg font-semibold"
            const titleBlock = $(article).find('.text-lg.font-semibold').first()
            
            // Link e Titolo
            const titleLink = titleBlock.find('a')
            const title = titleLink.text().trim()
            const href = titleLink.attr('href')
            
            // ID Manga
            const id = href?.split('/series/')[1]?.split('/')[0]
            
            if (!id || !title) return

            // Immagine Desktop
            // È dentro section > a > article.hidden.lg:block
            // Ma per sicurezza prendiamo il primo tag <source> o <img> che troviamo nell'articolo,
            // dando priorità alle immagini "normal" (non small)
            let image = $('source[media*="min-width"]', article).attr('srcset')
            if (!image) image = $('img', article).attr('src') ?? ''

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })

        return results
    }
    
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }
}