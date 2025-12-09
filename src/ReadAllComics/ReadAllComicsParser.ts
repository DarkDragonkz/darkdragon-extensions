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
        
        // Descrizione
        let tempDesc = context.clone()
        tempDesc.find('b, strong, div, img').remove()
        desc = tempDesc.text().trim()

        // Metadati
        const publisherLabel = context.find('b:contains("Publisher:"), strong:contains("Publisher:")')
        if (publisherLabel.length > 0) {
            author = publisherLabel[0].nextSibling?.nodeValue?.trim() || 
                     publisherLabel.next().text().trim() || 
                     'Unknown'
        }

        // --- FIX ERRORE TAGS ---
        const genreLabel = context.find('b:contains("Genres:"), strong:contains("Genres:")')
        if (genreLabel.length > 0) {
            let genreContainer = genreLabel.parent()
            genreContainer.find('a').each((_: any, a: any) => {
                const label = $(a).text().trim()
                const href = $(a).attr('href')
                const id = href?.split('/').filter(Boolean).pop() ?? label
                
                // Controllo rigoroso per evitare crash
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

            // --- FIX CAPITOLI (Ch. 0 e Ordine) ---
            let chapNum = 0
            
            // 1. Rimuovi l'anno tra parentesi es. "(2025)" o "(2024)"
            const titleClean = title.replace(/\(\d{4}\)/g, '').trim()
            
            // 2. Cerca numeri nel titolo pulito (es. "Werewolf... 006")
            const numMatch = titleClean.match(/(\d+(\.\d+)?)/g)
            
            if (numMatch && numMatch.length > 0) {
                 // Prendi l'ultimo numero trovato. Es: "Vol 2 006" -> prende 6
                 chapNum = parseFloat(numMatch[numMatch.length - 1]!)
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: new Date(),
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        const imgRegex = /<img[^>]+src="([^">]+)"/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1]
            if (url && !url.includes('logo') && !url.includes('facebook') && !url.includes('twitter') && !url.includes('preloader')) {
                
                if (url.startsWith('/')) {
                    url = `https://2.bp.blogspot.com${url}`
                } else if (!url.startsWith('http')) {
                     url = url.startsWith('//') ? `https:${url}` : BASE_URL + url
                }
                pages.push(url.trim())
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

        // Caso 1: Griglia immagini (se presente)
        if ($('#post-area .post').length > 0) {
            $('#post-area .post').each((_: any, item: any) => {
                const link = $('.pinbin-copy a', item).first()
                const title = link.text().trim() || link.attr('title')
                
                const classAttr = $(item).attr('class') ?? ''
                const categoryMatch = classAttr.match(/category-([^\s]+)/)
                const id = categoryMatch ? categoryMatch[1] : null

                if (!id || !title) return

                const img = $('img', item).first()
                let image = img.attr('src') ?? img.attr('data-src') ?? ''
                if (image.startsWith('/')) image = `https://2.bp.blogspot.com${image}`
                
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        } 
        // Caso 2: Lista testuale (Come da tuo screenshot)
        else if ($('.list-story li').length > 0) {
            $('.list-story li').each((_: any, li: any) => {
                const link = $('a', li).first()
                const title = link.text().trim()
                const href = link.attr('href')
                
                if (!href || !title) return

                const urlParts = href.split('/').filter(Boolean)
                const id = urlParts[urlParts.length - 1]

                // Immagine FALLBACK per la lista testuale
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

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Catalogue', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const items: PartialSourceManga[] = []

        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const title = link.text().trim() || link.attr('title')
            
            const classAttr = $(item).attr('class') ?? ''
            const categoryMatch = classAttr.match(/category-([^\s]+)/)
            const id = categoryMatch ? categoryMatch[1] : null

            if (!id || !title) return

            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }

            const dateText = $('.pinbin-copy span', item).text().trim()

            items.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: dateText
            }))
        })

        latestSection.items = items
        sectionCallback(latestSection)
    }
}