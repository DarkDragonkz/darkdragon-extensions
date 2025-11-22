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

export class NineMangaITParser {

    // HELPER: Gestisce Lazy Loading e URL relativi per le immagini
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        // Cerca l'immagine vera in vari attributi usati da NineManga
        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original')
        
        if (!src) return 'https://paperback.moe/icons/logo-alt.svg' // Fallback icona

        // Se l'immagine è un placeholder di caricamento, cerca ancora
        if (src.includes('loading') || src.includes('blank')) {
             src = img.attr('data-src') || img.attr('original') || src
        }

        // Corregge URL relativi (es: /images/cover.jpg -> https://it.ninemanga.com/images/cover.jpg)
        if (src.startsWith('//')) {
            src = `https:${src}`
        } else if (src.startsWith('/')) {
            src = `https://it.ninemanga.com${src}`
        }

        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        // Usa l'helper per l'immagine
        let image = this.getImageSrc($('.bookintro, .book-cover, .manga-cover, div.bookintro'))

        const author = $('a[itemprop="author"]').first().text().trim() ?? 'Unknown'
        const artist = author 
        let desc = $('.bookintro p[itemprop="description"]').text().trim()
        if (!desc) desc = $('.bookintro').text().trim().split('Sommario:')[1] ?? ''
        if (!desc) desc = 'No description available'
        
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a').each((_: any, el: any) => {
            const id = $(el).attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $(el).text().trim()
            if (id && label) arrayTags.push({ id, label })
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
                desc: desc,
                tags: tagSections
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        const selector = '.chapterbox ul.sub_vol_ul li a.chapter_list_a, .chapter-box li a, ul.chapter-list li a'
        let linkElements = $(selector).toArray()

        if (linkElements.length === 0) {
            linkElements = $('a[href*="/chapter/"]').toArray()
        }

        for (const link of linkElements) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.split('?')[0].replace('.html', '')

            if (seenIds.has(chapterId)) continue
            if (!href.includes('/chapter/')) continue

            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            titleRaw = titleRaw.replace(new RegExp(`^${mangaId.replace(/-/g, ' ')}\\s+`, 'i'), '')
            
            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c|one piece)\.?\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: titleRaw,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }
        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string, requestManager: any, baseUrl: string, cheerio: any): ChapterDetails {
        const pages: string[] = []
        let foundInScript = false
        
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && (content.includes('p_urls') || content.includes('img_url'))) {
                const matches = content.match(/(https?:\/\/[^"']+\.(?:jpg|png|webp|jpeg))/gi)
                if (matches && matches.length > 0) {
                    for(const m of matches) pages.push(m)
                    foundInScript = true
                    break
                }
            }
        }

        if (!foundInScript) {
            const imgElements = $('img.manga_pic').toArray()
            for (const img of imgElements) {
                const src = $(img).attr('src')
                if (src) pages.push(src)
            }
            
            if (pages.length === 0) {
                 const centerImages = $('div[align="center"] img').toArray()
                 for (const img of centerImages) {
                    const src = $(img).attr('src')
                    if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                        pages.push(src)
                    }
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)]
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // FIX: Aggiunto selettore per dl (usato spesso nella ricerca mobile)
        const items = $('.book-list li, .book-list dl, .comic-item, dd.book-list, div.bookinfo').toArray()

        for (const item of items) {
            const $item = $(item)
            let link = $item.find('a').first()
            
            // A volte il primo link è l'immagine, controlliamo
            if (!link.attr('href')) link = $item.find('dt a').first()

            const href = link.attr('href')
            
            let id = ''
            if (href && href.includes('/manga/')) {
                 id = href.split('/manga/')[1].replace('.html', '')
            }

            if (!id) continue

            // FIX: Usa il nuovo helper per trovare l'immagine corretta
            const image = this.getImageSrc($item)
            
            let title = link.attr('title') || link.text().trim()
            if (!title) title = $item.find('dd.book-list b').text().trim() // Struttura dl > dd > b
            if (!title) title = 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, $updates: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        const cleanTitle = (t: string) => t.replace(/(\s+(Vol\.|Ch\.|Chapter\.)?\s*\d+(\.\d+)?)+$/i, '').trim()

        // POPOLARI
        const popularList = $home('#tab_content_3 li').toArray()
        for (const item of popularList) {
            const $item = $home(item)
            const link = $item.find('a').first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            
            // FIX: Usa helper immagine
            const image = this.getImageSrc($item)
            
            let title = link.attr('title') || $item.find('span').text().trim()
            title = cleanTitle(title)

            if (id) popularItems.push(App.createPartialSourceManga({ mangaId: id, image, title, subtitle: undefined }))
        }
        popularSection.items = popularItems
        sectionCallback(popularSection)

        // NUOVI
        const newList = $home('#tab_content_1 li').toArray()
        for (const item of newList) {
            const $item = $home(item)
            const link = $item.find('a').first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = this.getImageSrc($item)
            let title = link.attr('title') || $item.find('span').text().trim()
            title = cleanTitle(title)

            if (id) newItems.push(App.createPartialSourceManga({ mangaId: id, image, title, subtitle: undefined }))
        }
        newSection.items = newItems
        sectionCallback(newSection)

        // ULTIMI
        const latestList = $home('#tab_content_2 li').toArray()
        for (const item of latestList) {
            const $item = $home(item)
            const link = $item.find('a').first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = this.getImageSrc($item)
            const rawTitle = link.attr('title') || $item.find('span').text().trim()
            const title = cleanTitle(rawTitle)
            
            let subtitle = undefined
            const numMatch = rawTitle.match(/(\d+(\.\d+)?)$/)
            if (numMatch) subtitle = `Ch. ${numMatch[0]}`

            if (id) latestItems.push(App.createPartialSourceManga({ mangaId: id, image, title, subtitle }))
        }
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}