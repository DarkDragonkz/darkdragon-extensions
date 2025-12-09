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
        
        // Selettore specifico per le pagine "Category" di ReadAllComics
        const img = $('.description-archive img').first()
        let image = img.attr('src') ?? img.attr('data-src') ?? ''
        
        // Fix per immagini blogspot
        if (image.startsWith('/')) {
            image = `https://2.bp.blogspot.com${image}`
        }

        // Info
        // Cerchiamo i tag <b> o <strong> dentro la descrizione
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        // Parsing descrizione e metadati
        const context = $('.description-archive')
        
        // Estrai testo puro per la descrizione (rimuovendo i tag b/strong che sono label)
        let tempDesc = context.clone()
        tempDesc.find('b, strong, div, img').remove()
        desc = tempDesc.text().trim()

        // Parsing Autore/Publisher
        const publisherLabel = context.find('b:contains("Publisher:"), strong:contains("Publisher:")')
        if (publisherLabel.length > 0) {
            author = publisherLabel[0].nextSibling?.nodeValue?.trim() || 
                     publisherLabel.next().text().trim() || 
                     'Unknown'
        }

        // Parsing Generi
        const genreLabel = context.find('b:contains("Genres:"), strong:contains("Genres:")')
        if (genreLabel.length > 0) {
            // I generi sono link <a> che seguono il label
            // A volte sono dentro uno span o direttamente dopo
            let genreContainer = genreLabel.parent()
            genreContainer.find('a').each((_: any, a: any) => {
                const label = $(a).text().trim()
                const id = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? label
                if (label) arrayTags.push(App.createTag({ id, label }))
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
        
        // Selettore della lista capitoli
        $('.list-story li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            // IMPORTANTE: L'ID del capitolo deve essere lo slug finale
            // Es: https://readallcomics.com/batman-issue-1/ -> batman-issue-1
            const urlParts = href.split('/').filter(Boolean)
            const chapterId = urlParts[urlParts.length - 1]

            if (!chapterId) return

            let chapNum = 0
            const numMatch = title.match(/(\d+(\.\d+)?)/g)
            if (numMatch && numMatch.length > 0) {
                 const lastNum = parseFloat(numMatch[numMatch.length - 1]!)
                 // Evita di prendere l'anno (es. 2023) come numero capitolo
                 chapNum = lastNum < 1900 ? lastNum : 0
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
        
        // Regex per trovare tutte le immagini, filtrando quelle inutili
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

        // Cerca i post nella griglia dei risultati
        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const href = link.attr('href')
            const title = link.text().trim() || link.attr('title')
            
            if (!href || !title) return

            // PULIZIA ID CRITICA: Estrai solo lo slug (es: "batman-2016")
            const urlParts = href.split('/').filter(Boolean)
            const id = urlParts[urlParts.length - 1]

            // Immagine
            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }
            if (!image) image = 'https://readallcomics.com/wp-content/uploads/2020/09/logo.png'

            if (id) {
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
            title: 'Catalogue', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const items: PartialSourceManga[] = []

        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const href = link.attr('href')
            const title = link.text().trim() || link.attr('title')
            
            if (!href || !title) return

            // PULIZIA ID CRITICA
            const urlParts = href.split('/').filter(Boolean)
            const id = urlParts[urlParts.length - 1]

            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }

            const dateText = $('.pinbin-copy span', item).text().trim()

            if (id) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: dateText
                }))
            }
        })

        latestSection.items = items
        sectionCallback(latestSection)
    }
}