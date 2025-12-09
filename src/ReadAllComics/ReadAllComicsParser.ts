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

const BASE_URL = 'https://readallcomics.com'

export class ReadAllComicsParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim() || 'Unknown'
        
        // Gestione immagine robusta per WordPress
        const img = $('div.summary_image img').first()
        let image = img.attr('data-src') ?? img.attr('src') ?? ''
        if (image && !image.startsWith('http')) image = image.startsWith('//') ? `https:${image}` : BASE_URL + image

        // Info
        const author = $('.author-content a').map((_: any, a: any) => $(a).text().trim()).get().join(', ') || 'Unknown'
        const status = $('.post-status .summary-content').text().trim().includes('OnGoing') ? 'Ongoing' : 'Completed'
        const desc = $('.description-summary .summary__content').text().trim()

        // Generi
        const arrayTags: Tag[] = []
        $('.genres-content a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // I capitoli sono in ul.main-version-ul li
        $('.main-version-ul li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            // ID del capitolo è l'intero URL per ReadAllComics
            const chapterId = href

            // Cerca di estrarre un numero dal titolo
            const numMatch = title.match(/(\d+(\.\d+)?)/g)
            const chapNum = numMatch ? parseFloat(numMatch[numMatch.length - 1]!) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: new Date(), // Sito non fornisce date precise nei listing
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // ReadAllComics mette tutte le immagini <img> dentro un div, spesso .entry-content o semplice lista
        // Cerchiamo tutte le immagini nel body per sicurezza, filtrando quelle piccole
        // Oppure usiamo una regex per trovare i tag img nell'HTML grezzo
        
        // Regex per catturare src nelle immagini
        const imgRegex = /<img[^>]+src="([^">]+)"/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1]
            if (url && !url.includes('logo') && !url.includes('facebook') && !url.includes('twitter')) {
                // Pulisce URL
                if (!url.startsWith('http')) url = url.startsWith('//') ? `https:${url}` : BASE_URL + url
                pages.push(url)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        // ReadAllComics ha diversi layout di ricerca. Cerchiamo di essere generici.
        // Solitamente sono dentro 'article' o 'div.post-item'
        
        $('article, div.post-item, div.item-summary').each((_: any, item: any) => {
            const link = $('a', item).first()
            const href = link.attr('href')
            const title = link.attr('title') || $('h3, h4, h5', item).text().trim() || link.text().trim()
            
            if (!href || !title) return

            // ID è l'URL
            const id = href

            // Immagine: Cerchiamo in modo aggressivo
            const img = $('img', item).first()
            let image = img.attr('data-src') ?? 
                        img.attr('src') ?? 
                        img.attr('srcset')?.split(',')[0]?.split(' ')[0] ?? 
                        ''

            // Fix URL immagine
            if (image && !image.startsWith('http')) {
                 image = image.startsWith('//') ? `https:${image}` : BASE_URL + image
            }

            // FALLBACK: Se non c'è immagine (risultato testuale), usa logo placeholder
            if (!image || image.includes('blank') || image === '') {
                image = 'https://readallcomics.com/wp-content/uploads/2020/09/logo.png' 
            }

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Added', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const items: PartialSourceManga[] = []

        // Home page items
        $('ul.list-story li, div.item-summary').each((_: any, item: any) => {
            const link = $('a', item).first()
            const href = link.attr('href')
            const title = link.attr('title') || $('h3', item).text().trim()
            
            if (!href || !title) return

            const img = $('img', item).first()
            let image = img.attr('data-src') ?? img.attr('src') ?? ''
            if (image && !image.startsWith('http')) image = image.startsWith('//') ? `https:${image}` : BASE_URL + image

            items.push(App.createPartialSourceManga({
                mangaId: href,
                image: image,
                title: title,
                subtitle: 'New'
            }))
        })

        latestSection.items = items
        sectionCallback(latestSection)
    }
}