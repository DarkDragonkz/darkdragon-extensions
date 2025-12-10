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

    /**
     * Helper centralizzato per parsare la griglia dei fumetti.
     * Gestisce sia il layout standard (.post) che quello di ricerca.
     */
    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        // Layout Standard (Home / Search Griglia)
        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const title = link.text().trim() || link.attr('title')
            
            // Estrazione ID dalla classe CSS (es. category-batman)
            const classAttr = $(item).attr('class') ?? ''
            const categoryMatch = classAttr.match(/category-([^\s]+)/)
            const id = categoryMatch ? categoryMatch[1] : null

            if (!id || !title) return

            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            // Fix per immagini relative ospitate su blogspot
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }

            const dateText = $('.pinbin-copy span', item).text().trim()

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: dateText || undefined
            }))
        })

        // Layout Lista (Fallback per alcuni risultati di ricerca)
        if (results.length === 0 && $('.list-story li').length > 0) {
            $('.list-story li').each((_: any, li: any) => {
                const link = $('a', li).first()
                const title = link.text().trim()
                const href = link.attr('href')
                
                if (!href || !title) return

                const urlParts = href.split('/').filter(Boolean)
                const id = urlParts[urlParts.length - 1]

                // Placeholder perché la lista testuale non ha immagini
                const image = 'https://readallcomics.com/wp-content/uploads/2020/09/logo.png'

                if (id) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: undefined
                    }))
                }
            })
        }

        return results
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim() || 'Unknown'
        
        const img = $('.description-archive img').first()
        let image = img.attr('src') ?? img.attr('data-src') ?? ''
        if (image.startsWith('/')) {
            image = `https://2.bp.blogspot.com${image}`
        }

        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        const context = $('.description-archive')
        
        // Pulizia Descrizione Avanzata
        let tempDesc = context.clone()
        tempDesc.find('b, strong, div, img, script, style').remove() // Rimuove elementi strutturali
        desc = tempDesc.text().replace(/Publisher:|Genres:|Author:/g, '').trim()

        const publisherLabel = context.find('b:contains("Publisher:"), strong:contains("Publisher:")')
        if (publisherLabel.length > 0) {
            author = publisherLabel[0].nextSibling?.nodeValue?.trim() || 
                     publisherLabel.next().text().trim() || 
                     'Unknown'
        }

        const genreLabel = context.find('b:contains("Genres:"), strong:contains("Genres:")')
        if (genreLabel.length > 0) {
            let genreContainer = genreLabel.parent()
            genreContainer.find('a').each((_: any, a: any) => {
                const label = $(a).text().trim()
                const href = $(a).attr('href')
                const id = href?.split('/').filter(Boolean).pop() ?? label
                
                if (id && label) {
                    arrayTags.push(App.createTag({ id: String(id), label: String(label) }))
                }
            })
        }

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('.list-story li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href

            let chapNum = 0
            // Rimuove l'anno tra parentesi es: (2023) per parsare meglio il numero
            const titleClean = title.replace(/\(\d{4}\)/g, '').trim()
            const numMatch = titleClean.match(/(\d+(\.\d+)?)/g)
            
            if (numMatch && numMatch.length > 0) {
                 chapNum = parseFloat(numMatch[numMatch.length - 1]!)
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: new Date(), // Il sito non fornisce date precise nella lista
                langCode: 'en'
            }))
        })

        return chapters
    }

    // MODIFICATO: Ora accetta $ (Cheerio) invece di html string per robustezza
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca tutte le immagini nel content area
        $('img').each((_: any, img: any) => {
            let url = $(img).attr('src') ?? $(img).attr('data-src')
            
            if (url && !url.includes('logo') && !url.includes('facebook') && !url.includes('twitter') && !url.includes('preloader')) {
                
                // Normalizzazione URL
                if (url.startsWith('/')) {
                    url = `https://2.bp.blogspot.com${url}`
                } else if (!url.startsWith('http')) {
                     url = url.startsWith('//') ? `https:${url}` : BASE_URL + url
                }
                
                // Evita duplicati
                if (!pages.includes(url.trim())) {
                    pages.push(url.trim())
                }
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Added 🔥', 
            containsMoreItems: true, // ABILITATO: Permette "View More"
            type: HomeSectionType.continuous // MODIFICATO: Scroll verticale infinito
        })
        
        latestSection.items = this.parseGridItems($)
        sectionCallback(latestSection)
    }

    parseSearchResults($: any): PartialSourceManga[] {
        return this.parseGridItems($)
    }
}