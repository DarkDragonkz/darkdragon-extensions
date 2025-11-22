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

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        let image = $('.bookintro img[itemprop="image"]').attr('src') ?? ''
        if (!image) image = $('.book-cover img').attr('src') ?? ''
        if (!image) image = $('div.bookintro img').attr('src') ?? ''

        const author = $('a[itemprop="author"]').first().text().trim() ?? 'Unknown'
        const artist = author 
        let desc = $('.bookintro p[itemprop="description"]').text().trim()
        if (!desc) desc = $('.bookintro').text().trim().split('Sommario:')[1] ?? ''
        if (!desc) desc = 'No description available'
        
        let status = 'Ongoing'
        const statusText = $('.red').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        const tagLinks = $('li[itemprop="genre"] a').toArray()
        for (const el of tagLinks) {
            const href = $(el).attr('href')
            const id = href?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $(el).text().trim()
            if (id && label) arrayTags.push({ id, label })
        }
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
        const items = $('.book-list li, .comic-item, dd.book-list').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            
            let id = ''
            if (href && href.includes('/manga/')) {
                 id = href.split('/manga/')[1].replace('.html', '')
            }

            if (!id) continue

            const image = $('img', item).attr('src') ?? ''
            const title = link.attr('title') || link.text().trim()

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

        const popularList = $home('#tab_content_3 li').toArray()
        for (const item of popularList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            let title = link.attr('title') || $home('span', item).text().trim()
            title = cleanTitle(title)

            if (id) popularItems.push(App.createPartialSourceManga({ mangaId: id, image, title, subtitle: undefined }))
        }
        popularSection.items = popularItems
        sectionCallback(popularSection)

        const newList = $home('#tab_content_1 li').toArray()
        for (const item of newList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            let title = link.attr('title') || $home('span', item).text().trim()
            title = cleanTitle(title)

            if (id) newItems.push(App.createPartialSourceManga({ mangaId: id, image, title, subtitle: undefined }))
        }
        newSection.items = newItems
        sectionCallback(newSection)

        const latestList = $home('#tab_content_2 li').toArray()
        for (const item of latestList) {
            const link = $home('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            const image = $home('img', item).attr('src') ?? ''
            const rawTitle = link.attr('title') || $home('span', item).text().trim()
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