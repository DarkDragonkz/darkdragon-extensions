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

const BASE_URL = 'https://xoxocomic.com'

export class XoxoComicParser {

    /**
     * Helper per pulire gli URL delle immagini e gestire i path relativi
     */
    private getImageSrc(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h2.listmanga-header').text().trim() || 'Unknown'
        
        const imageElement = $('.col-md-4 .img-responsive')
        const image = this.getImageSrc(imageElement.attr('src'))

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'
        let desc = ''

        // Parsing Metadati
        $('.dl-horizontal dt').each((i: number, dt: any) => {
            const label = $(dt).text().toLowerCase()
            const value = $(dt).next('dd').text().trim()

            if (label.includes('author')) author = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Descrizione
        const descElement = $('.manga-content p')
        if (descElement.length > 0) {
            desc = descElement.text().trim()
        } else {
            // Fallback se la struttura cambia
            desc = $('.well p').text().trim()
        }

        // Generi
        const arrayTags: Tag[] = []
        $('.dl-horizontal dd a[href*="/genre/"]').each((_: any, a: any) => {
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
                desc: desc || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('ul.chapters li').each((_: any, li: any) => {
            const link = $('h5.chapter-title-rtl a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            
            // Estrai ID dall'URL: /comic/comic-name/issue-1 -> issue-1
            // Nota: XoxoComic usa gli slug completi come ID spesso
            let chapterId = href?.replace(BASE_URL, '') ?? ''
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            if (!chapterId) return

            const dateText = $('.date-chapter-title-rtl', li).text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            // Parsing Numero Capitolo (Issue X, Chapter X)
            const numMatch = title.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            chapters.push(App.createChapter({
                id: chapterId, // Passiamo l'URL relativo come ID
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // SENIOR TRICK: Estrazione diretta da JavaScript
        // Cerca: var lstImages = new Array("url1", "url2");
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        
        if (scriptMatch && scriptMatch[1]) {
            // Pulisce la stringa: "url1", "url2" -> [url1, url2]
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            
            for (const url of urls) {
                if (url) {
                    pages.push(this.getImageSrc(url))
                }
            }
        } else {
            // Fallback DOM se lo script cambia
            // Potrebbe essere necessario cheerio qui, ma proviamo una regex veloce prima
            const imgRegex = /<img[^>]+src="([^">]+)"[^>]+class="img-responsive"/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                if (match[1]) pages.push(this.getImageSrc(match[1]))
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
        
        // Selettore per lista risultati (solitamente simile alla home o category page)
        $('.item').each((_: any, item: any) => {
            const link = $('h3 a', item)
            const title = link.text().trim()
            
            // ID: /comic/batman -> batman
            const href = link.attr('href')
            const id = href?.split('/').pop()

            const img = $('img', item)
            const image = this.getImageSrc(img.attr('src'))

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
            title: 'Latest Updates 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        
        const latestItems: PartialSourceManga[] = []

        // Selettore Home: .latest-updates .item
        $('.latest-updates .item').each((_: any, item: any) => {
            const link = $('h3 a', item)
            const title = link.text().trim()
            const href = link.attr('href')
            const id = href?.split('/').pop()

            const img = $('img', item)
            const image = this.getImageSrc(img.attr('src'))
            
            // Ultimo capitolo come sottotitolo
            const chapter = $('.chapter a', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })

        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}