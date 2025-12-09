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

const BASE_URL = 'https://readcomicsonline.ru'

export class ReadComicsOnlineParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Su .ru il titolo è spesso in h2.listmanga-header o simile nella pagina dettaglio
        const title = $('h2.listmanga-header').first().text().trim() || 
                      $('.media-heading').first().text().trim() || 
                      'Unknown'
        
        let image = $('.boxed img').first().attr('src') ?? 
                    $('.media-left img').first().attr('src') ?? ''
        
        // Fix URL immagini (spesso sono //readcomicsonline.ru/...)
        if (image.startsWith('//')) {
            image = 'https:' + image
        } else if (image.startsWith('/')) {
            image = BASE_URL + image
        }
        
        // Info (Autore, Stato, ecc sono spesso in una dl-horizontal)
        const author = $('dt:contains("Writer")').next('dd').text().trim() || 'Unknown'
        const artist = $('dt:contains("Artist")').next('dd').text().trim()
        const status = $('dt:contains("Status")').next('dd').text().trim().includes('Completed') ? 'Completed' : 'Ongoing'
        const desc = $('.manga.well p').text().trim() || 'No description available'

        // Generi
        const arrayTags: Tag[] = []
        $('.tag-links a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop() ?? label
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
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // La lista capitoli è in ul.chapters
        $('ul.chapters li').each((_: any, li: any) => {
            const link = $('h5.chapter-title-rtl a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) return

            // L'ID del capitolo in .ru è l'ultimo segmento dell'URL
            // es: https://readcomicsonline.ru/comic/batman-2016/105 -> 105
            const chapterId = href.split('/').pop()

            if (!chapterId) return

            const dateText = $('.date-chapter-title-rtl', li).text().trim()
            let time = new Date()
            if (dateText) {
                 time = new Date(dateText)
            }

            // Estrazione numero capitolo
            // Spesso l'ID è il numero, ma controlliamo il titolo
            let chapNum = parseFloat(chapterId)
            if (isNaN(chapNum)) {
                const numMatch = title.match(/(\d+(\.\d+)?)/)
                chapNum = numMatch ? parseFloat(numMatch[0]) : 0
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: isNaN(time.getTime()) ? new Date() : time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // In .ru le immagini sono spesso dentro #all img o .img-responsive
        // Usiamo una regex per trovare tutte le immagini caricate
        const imgRegex = /<img[^>]+src=['"]([^'"]+)['"][^>]+class=['"]img-responsive['"]/g
        let match
        
        // Metodo 1: Regex su HTML grezzo (più veloce)
        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1]
            if (url) {
                url = url.trim()
                if (url.startsWith('//')) url = 'https:' + url
                else if (url.startsWith('/')) url = BASE_URL + url
                
                pages.push(url)
            }
        }

        // Metodo 2: Se regex fallisce, fallback su data-src (lazy load)
        if (pages.length === 0) {
            const imgLazyRegex = /data-src=['"]([^'"]+)['"]/g
            while ((match = imgLazyRegex.exec(html)) !== null) {
                 let url = match[1]
                 if (url && !url.includes('loader')) {
                    url = url.trim()
                    if (url.startsWith('//')) url = 'https:' + url
                    else if (url.startsWith('/')) url = BASE_URL + url
                    pages.push(url)
                 }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchJson(json: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Il JSON di .ru è: { "suggestions": [ { "value": "Batman", "data": "batman-2016" }, ... ] }
        if (json.suggestions) {
            for (const item of json.suggestions) {
                const title = item.value
                const id = item.data // lo slug
                
                // .ru non fornisce l'immagine nel JSON di ricerca, dobbiamo costruirla
                // Pattern: uploads/manga/{slug}/cover/cover_250x350.jpg
                const image = `${BASE_URL}/uploads/manga/${id}/cover/cover_250x350.jpg`

                if (id && title) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: undefined
                    }))
                }
            }
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Hot Comic Updates (Carousel)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Comic Updates', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const hotItems: PartialSourceManga[] = []
        
        $('#schedule li.schedule-item').each((_: any, item: any) => {
            const link = $('.schedule-name a', item)
            const title = link.text().trim()
            // Estrai ID dall'href: https://readcomicsonline.ru/comic/slug -> slug
            const href = link.attr('href')
            const id = href?.split('/').pop()

            let image = $('.schedule-avatar img', item).attr('src') ?? ''
            if (image.startsWith('//')) image = 'https:' + image

            const subtitle = $('.schedule-date', item).text().trim()

            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // 2. Latest Comic Updates
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Comic Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []

        // Si trovano in .list-container .row .media
        $('.list-container .row .media').each((_: any, item: any) => {
            const link = $('h5.media-heading a', item)
            const title = link.text().trim()
            const href = link.attr('href')
            const id = href?.split('/').pop()

            let image = $('.media-left img', item).attr('src') ?? ''
            if (image.startsWith('//')) image = 'https:' + image

            // Ultimo capitolo come sottotitolo
            const subtitle = $('div a', $('.media-body', item)).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)

        // 3. Most Viewed
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Most Viewed', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const popularItems: PartialSourceManga[] = []

        // Si trovano nel widget a destra: .panel-success ul li.list-group-item
        $('.panel-success ul li.list-group-item .media').each((_: any, item: any) => {
            const link = $('h5.media-heading a', item)
            const title = link.text().trim()
            const href = link.attr('href')
            const id = href?.split('/').pop()

            let image = $('.media-left img', item).attr('src') ?? ''
            if (image.startsWith('//')) image = 'https:' + image

            if (id && title) {
                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        popularSection.items = popularItems
        sectionCallback(popularSection)
    }
}