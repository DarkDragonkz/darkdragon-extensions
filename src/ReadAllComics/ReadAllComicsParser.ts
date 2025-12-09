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
        // Su ReadAllComics, la pagina del fumetto è una "Category Archive"
        
        const title = $('h1').first().text().trim() || 'Unknown'
        
        // Immagine: si trova dentro .description-archive
        const img = $('.description-archive img').first()
        let image = img.attr('src') ?? img.attr('data-src') ?? ''
        
        // Fix per immagini blogspot
        if (image.startsWith('/')) {
            image = `https://2.bp.blogspot.com${image}`
        }

        // Descrizione e Info: Sono mischiate in paragrafi con tag <b> o <strong>
        // Esempio: <b>Publisher:</b> DC Comics
        
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        // Estrazione descrizione pulita
        // Cerchiamo il testo che non è un metadato
        let rawDesc = $('.description-archive').clone()
        rawDesc.find('div, img, script, style, b, strong').remove()
        desc = rawDesc.text().trim()

        // Parsing metadati specifici
        $('.description-archive b, .description-archive strong').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el)[0].nextSibling?.nodeType === 3 ? $(el)[0].nextSibling.nodeValue.trim() : $(el).next().text().trim()

            if (label.includes('Publisher')) {
                author = value
            } else if (label.includes('Genres')) {
                // I generi sono spesso link dopo il label
                const parent = $(el).parent()
                parent.find('a').each((__: any, a: any) => {
                    const tagLabel = $(a).text().trim()
                    const tagId = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? tagLabel
                    if (tagLabel) arrayTags.push(App.createTag({ id: tagId, label: tagLabel }))
                })
            } else if (label.includes('Status')) {
                 if (value.includes('Completed')) status = 'Completed'
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
        
        // I capitoli sono nella lista .list-story o .main-version-ul
        // Il codice di Karrot usa .list-story, usiamo quello per sicurezza
        $('.list-story li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href

            // Parsing numero capitolo
            // Cerca "Issue #1", "v1", "1990" etc.
            let chapNum = 0
            const numMatch = title.match(/(\d+(\.\d+)?)/g)
            if (numMatch && numMatch.length > 0) {
                 // Prendi l'ultimo numero trovato che sia ragionevole (< 2000 per evitare anni)
                 const lastNum = parseFloat(numMatch[numMatch.length - 1]!)
                 chapNum = lastNum < 2000 ? lastNum : 0
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
        
        // Metodo Regex più robusto per trovare tutte le immagini nel contenuto
        const imgRegex = /<img[^>]+src="([^">]+)"/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1]
            // Filtra loghi e icone social
            if (url && !url.includes('logo') && !url.includes('facebook') && !url.includes('twitter') && !url.includes('preloader')) {
                
                // Fix URL relativi
                if (url.startsWith('/')) {
                    url = `https://2.bp.blogspot.com${url}`
                } else if (!url.startsWith('http')) {
                     url = url.startsWith('//') ? `https:${url}` : BASE_URL + url
                }
                
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

        // La ricerca di ReadAllComics restituisce una griglia simile alla Home
        // Selettore: #post-area .post
        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const href = link.attr('href')
            const title = link.text().trim() || link.attr('title')
            
            if (!href || !title) return

            const id = href

            // Gestione Immagine
            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }
            if (image && !image.startsWith('http')) {
                image = BASE_URL + image
            }

            // Fallback se immagine manca
            if (!image) image = 'https://readallcomics.com/wp-content/uploads/2020/09/logo.png'

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

            const img = $('img', item).first()
            let image = img.attr('src') ?? img.attr('data-src') ?? ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
            }

            const dateText = $('.pinbin-copy span', item).text().trim()

            items.push(App.createPartialSourceManga({
                mangaId: href,
                image: image,
                title: title,
                subtitle: dateText
            }))
        })

        latestSection.items = items
        sectionCallback(latestSection)
    }
}