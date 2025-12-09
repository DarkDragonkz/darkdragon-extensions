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
        
        // Logica immagine migliorata (ispirata al codice fornito)
        const img = $('div.summary_image img').first()
        let image = img.attr('data-src') || img.attr('src') || ''
        if (image.startsWith('/')) {
            image = `https://2.bp.blogspot.com${image}`
        }

        // Info
        const author = $('.author-content a').map((_: any, a: any) => $(a).text().trim()).get().join(', ') || 'Unknown'
        const status = $('.post-status .summary-content').text().trim().includes('OnGoing') ? 'Ongoing' : 'Completed'
        
        // Descrizione pulita dai tag interni
        let desc = $('.description-summary .summary__content').text().trim()

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
        
        $('.main-version-ul li').each((_: any, li: any) => {
            const link = $('a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href

            // Parsing numero capitolo
            const numMatch = title.match(/(\d+(\.\d+)?)/g)
            const chapNum = numMatch ? parseFloat(numMatch[numMatch.length - 1]!) : 0

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
        
        // Regex per trovare le immagini nel contenuto
        const imgRegex = /<img[^>]+src="([^">]+)"/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1]
            if (url && !url.includes('logo') && !url.includes('facebook') && !url.includes('twitter')) {
                // Fix URL relativi come nel codice di Karrot
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

        // Usiamo il selettore del codice che mi hai mandato (#post-area .post) 
        // perché è quello che contiene le immagini nel layout a griglia
        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const href = link.attr('href')
            const title = link.text().trim() || link.attr('title')
            
            if (!href || !title) return

            const id = href

            // Logica immagine PRESA DAL CODICE CHE MI HAI MANDATO
            const img = $('img', item).first()
            let image = img.attr('data-src') || img.attr('src') || ''
            
            if (image.startsWith('/')) {
                image = `https://2.bp.blogspot.com${image}`
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
            title: 'Catalogue', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const items: PartialSourceManga[] = []

        // Stesso selettore robusto per la home
        $('#post-area .post').each((_: any, item: any) => {
            const link = $('.pinbin-copy a', item).first()
            const href = link.attr('href')
            const title = link.text().trim() || link.attr('title')
            
            if (!href || !title) return

            const img = $('img', item).first()
            let image = img.attr('data-src') || img.attr('src') || ''
            
            // Fix per immagini relative blogspot
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