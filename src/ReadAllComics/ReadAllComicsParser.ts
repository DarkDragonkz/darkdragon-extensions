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

export class ReadAllComicsParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = 'Unknown Title'
        
        // Pulizia: Rimuovi "Comic" o "Read"
        title = title.replace(/^Read\s+/i, '').replace(/\s+Comic$/i, '')

        // L'immagine è spesso nella descrizione o in un div specifico
        let image = $('.entry-content img').first().attr('src')
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        let desc = $('.description').text().trim()
        if (!desc) desc = $('.entry-content p').first().text().trim()
        if (!desc) desc = 'No description available.'

        // Tentativo di estrazione generi (WordPress tags)
        const arrayTags: Tag[] = []
        // Selettore generico per i tag in fondo ai post WP
        $('a[rel="tag"]').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const id = label.toLowerCase().replace(/\s+/g, '-')
            if (label) arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: 'Ongoing', // Default sicuro per questo sito
                author: 'Unknown',
                artist: 'Unknown',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // ReadAllComics elenca i capitoli in una lista <ul> o <p> dentro entry-content
        const links = $('.entry-content li a, .entry-content p a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            const titleRaw = $link.text().trim()

            if (!href) continue

            // Questo sito usa l'URL completo come ID del capitolo perché non ha ID numerici chiari
            const chapterId = href

            // Estrazione numero capitolo
            // Regex cerca "Issue 5", "Chapter 5", "#5" o solo il numero alla fine
            const chapNumMatch = titleRaw.match(/(?:chapter|ch|issue|no\.|#)\.?\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            } else {
                // Fallback: cerca l'ultimo numero nella stringa
                const numMatch = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (numMatch && numMatch.length > 0) {
                    chapNum = parseFloat(numMatch[numMatch.length - 1])
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: titleRaw,
                chapNum: chapNum,
                time: new Date(), // Data non disponibile facilmente
                langCode: 'en'
            }))
        }

        // ORDINAMENTO DECRESCENTE (Fondamentale)
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // Le immagini sono dirette nel contenuto del post
        $('.entry-content img').each((_: any, el: any) => {
            const $img = $(el)
            // Priorità attributi lazy load se presenti, altrimenti src
            let src = $img.attr('data-src') || $img.attr('data-original') || $img.attr('src')
            
            if (src && !src.includes('logo') && !src.includes('pixel') && !src.includes('facebook')) {
                src = src.trim()
                // Fix URL relativi se necessario (raro su WP)
                if (src.startsWith('//')) src = `https:${src}`
                pages.push(src)
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('article').each((_: any, el: any) => {
            const $el = $(el)
            const titleLink = $el.find('h2.entry-title a').first()
            const title = titleLink.text().trim()
            const href = titleLink.attr('href')
            
            // L'ID del manga è lo slug della categoria
            // Es: readallcomics.com/category/batman-2016/ -> batman-2016
            const idMatch = href?.match(/\/category\/([^\/]+)\/?$/)
            const id = idMatch ? idMatch[1] : undefined

            const image = $el.find('img').first().attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'New Comics 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })

        // ReadAllComics non ha una vera sezione "Popolari" fissa nella home, 
        // a volte è un widget laterale. Implementiamo solo Latest per sicurezza.
        // Se volessimo i popolari, dovremmo cercare in '.widget_text ul li' ma è fragile.

        const latestItems: PartialSourceManga[] = []

        // WP loop standard: #content .post o .type-post
        $('.type-post').each((_: any, el: any) => {
            const $el = $(el)
            
            // Cerchiamo link al manga (di solito nei tag o nel titolo se è un post di "uscita")
            // ReadAllComics posta i singoli capitoli come post del blog.
            // Il link del manga (serie) è spesso nei breadcrumbs o nei tag.
            // MA per la home, mostriamo i singoli post come entry point.
            
            // Tuttavia, Paperback vuole ID Manga.
            // Se clicco su un post "Batman #50", quello è un capitolo.
            // Dobbiamo estrarre la SERIE di appartenenza.
            
            // Solitamente c'è un link alla categoria
            const categoryLink = $el.find('a[rel="category tag"]').first()
            const categoryHref = categoryLink.attr('href')
            const title = categoryLink.text().trim() || $el.find('h2 a').text().trim()
            
            const idMatch = categoryHref?.match(/\/category\/([^\/]+)\/?$/)
            const id = idMatch ? idMatch[1] : undefined
            
            const image = $el.find('img').first().attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: $el.find('h2 a').text().trim() // Mostra il titolo del capitolo come sottotitolo
                }))
            }
        })

        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}