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

// IMPORTANTE: Mancava questa riga che causava l'errore!
import * as cheerio from 'cheerio'

const BASE_URL = 'https://readcomicsonline.ru'

export class ReadComicsOnlineParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h2.listmanga-header').first().text().trim() || 'Unknown'
        
        let image = $('img', 'div.boxed').attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image
        
        const author = $('dd', 'dt:contains("Type")').parent().text().replace('Type', '').trim() || 'Unknown'
        
        const statusText = $('span.label').text().trim().toLowerCase()
        const status = statusText.includes('completed') ? 'Completed' : 'Ongoing'

        let desc = $('div.manga.well p').text().trim()
        desc = desc.replace(/^Summary:\s*/i, '')

        const arrayTags: Tag[] = []
        $('a', 'dd.tag-links').each((_: any, a: any) => {
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
                artist: author,
                tags: tagSections,
                desc: desc || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('ul.chapters li').each((_: any, li: any) => {
            const title = $('h5.chapter-title-rtl', li).text().trim()
            const link = $('a', li).attr('href')
            
            // Estrazione ID pulita
            let chapterId = link?.split('/').pop() ?? ''
            // Rimuove eventuali query params o ancore
            if (chapterId.includes('?')) chapterId = chapterId.split('?')[0]
            if (chapterId.includes('#')) chapterId = chapterId.split('#')[0]

            if (!chapterId) return

            const dateText = $('div.date-chapter-title-rtl', li).last().text().trim()
            const time = new Date(dateText)

            const numMatch = chapterId.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

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
        // Qui usiamo cheerio, quindi l'import in alto è fondamentale
        const $ = cheerio.load(html)
        
        $('img', 'div#all').each((_: any, img: any) => {
            let url = $(img).attr('data-src')?.trim()
            if (url) {
                // Rimuove spazi bianchi all'inizio/fine URL
                url = url.trim();
                if (url.startsWith('/')) url = BASE_URL + url
                pages.push(url)
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchJson(json: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        if (json.suggestions) {
            for (const item of json.suggestions) {
                const title = item.value
                const id = item.data
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
        
        // 1. Hot Comics
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Comics', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        const hotItems: PartialSourceManga[] = []
        
        $('li.schedule-item', 'div.carousel').each((_: any, item: any) => {
            const id = $('div.schedule-name a', item).attr('href')?.split('/').pop()
            const title = $('div.schedule-name', item).text().trim()
            let image = $('div.schedule-avatar img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Hot'
                }))
            }
        })
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // 2. Latest Comics
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Comics', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []

        $('div.media', 'div.list-container > div.row').each((_: any, item: any) => {
            const link = $('h5.media-heading a', item)
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            let image = $('div.media-left img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}