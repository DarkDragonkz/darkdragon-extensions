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
        
        // Immagine: Cerca nel box descrizione tipico delle categorie
        const img = $('.description-archive img').first()
        let image = img.attr('src') ?? img.attr('data-src') ?? ''
        
        if (image.startsWith('/')) {
            image = `https://2.bp.blogspot.com${image}`
        }

        // Info
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        // Estrai descrizione pulita
        let tempDesc = $('.description-archive').clone()
        tempDesc.find('b, strong, div, img').remove()
        desc = tempDesc.text().trim()

        // Parsing Autore e Generi dai label
        $('.description-archive b, .description-archive strong').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el)[0].nextSibling?.nodeType === 3 ? $(el)[0].nextSibling.nodeValue.trim() : $(el).next().text().trim()

            if (label.includes('Publisher')) {
                author = value
            } else if (label.includes('Genres')) {
                $(el).parent().find('a').each((__: any, a: any) => {
                    const tagLabel = $(a).text().trim()
                    const tagId = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? tagLabel
                    if (tagLabel) arrayTags.push(App.createTag({ id: tagId, label: tagLabel }))
                })
            } else if (label.includes('Status') && value.includes('Completed')) {
                status = 'Completed'
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
                tags: tagSections,
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Selettore capitoli
        $('.list-story li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            // L'ID del capitolo è l'URL completo relativo
            // es: https://readallcomics.com/batman-issue-1/
            // Paperback gestirà questo URL nella getChapterDetails
            const chapterId = href

            // Parsing numero capitolo dal titolo
            let chapNum = 0
            const numMatch = title.match(/(\d+(\.\d+)?)/g)
            if (numMatch && numMatch.length > 0) {
                 const lastNum = parseFloat(numMatch[numMatch.length - 1]!)
                 // Se il numero è un anno (es. 2024), probabilmente non è il numero del capitolo
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
        
        // Regex per estrarre le immagini dal codice HTML grezzo
        // Questo bypassa problemi di lazy loading lato client
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

        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const title = link.text().trim() || link.attr('title')
            
            // TRUCCO DI KARROT: Estrai ID dalla classe CSS invece che dall'URL
            // Esempio classe: "post-123 post type-post status-publish format-standard has-post-thumbnail hentry category-batman"
            // Noi vogliamo "batman"
            const classAttr = $(item).attr('class') ?? ''
            const categoryMatch = classAttr.match(/category-([^\s]+)/)
            const id = categoryMatch ? categoryMatch[1] : null

            if (!id || !title) return

            // Immagine
            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }

            results.push(App.createPartialSourceManga({
                mangaId: id, // Questo ID pulito (es "batman") funzionerà con /category/
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
            title: 'Catalogue', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const items: PartialSourceManga[] = []

        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const title = link.text().trim() || link.attr('title')
            
            // Estrazione ID dalla classe
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