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

const BASE_URL = 'https://readcomiconline.li'

export class ReadComicsOnlineParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('div.barContent a.bigChar').first().text().trim() || 'Unknown'
        
        let image = $('.rightBox .barContent img').first().attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image
        
        let author = 'Unknown'
        let status = 'Ongoing'
        let desc = ''
        const arrayTags: Tag[] = []

        $('.barContent p').each((_: any, p: any) => {
            const text = $(p).text().trim()
            const $p = $(p)
            
            if (text.includes('Genres:')) {
                $p.find('a').each((__: any, a: any) => {
                    const label = $(a).text().trim()
                    const id = $(a).attr('href')?.split('/').pop() ?? label
                    if (label) arrayTags.push(App.createTag({ id, label }))
                })
            } else if (text.includes('Writer:')) {
                author = $p.find('a').text().trim() || 'Unknown'
            } else if (text.includes('Status:')) {
                if (text.includes('Completed')) status = 'Completed'
            } else if (!text.includes('Artist:') && !text.includes('Publication date:')) {
                if (text.length > 20) desc += text + '\n'
            }
        })

        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc.trim() || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const rows = $('table.listing tr').toArray()

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const link = $(row).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) continue

            const chapterId = href
            const dateText = $(row).find('td').eq(1).text().trim()
            const time = dateText ? new Date(dateText) : new Date()

            let chapNum = 0
            const numMatch = title.match(/#(\d+(\.\d+)?)/)
            if (numMatch) {
                chapNum = parseFloat(numMatch[1])
            } else {
                const looseMatch = title.match(/(\d+)/)
                if (looseMatch) chapNum = parseFloat(looseMatch[1])
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        }
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        let scriptMatch = html.match(/var lstImages = new Array\((.*?)\);/)
        if (!scriptMatch) {
             scriptMatch = html.match(/new Array\((.*?)\);/)
        }

        if (scriptMatch && scriptMatch[1]) {
            const rawUrls = scriptMatch[1].split(',')
            for (const rawUrl of rawUrls) {
                const url = rawUrl.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
                if (url.startsWith('http')) {
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

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('.list-comic .item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const title = $('span.title', link).text().trim() || link.text().trim()
            
            let id = link.attr('href') ?? ''
            id = id.replace(/^\/Comic\//, '').replace(/^\//, '')

            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

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
        
        // 1. Latest Updates
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const latestItems: PartialSourceManga[] = []
        
        // I link dei fumetti sono dentro .items > div > a
        // Esempio HTML: <a href="Comic/Titolo">...</a>
        $('.bigBarContainer .items a').each((_: any, a: any) => {
            const href = $(a).attr('href')
            // Filtra: deve contenere "Comic/" e NON contenere "?id=" (che sono i capitoli)
            if (href && href.indexOf('Comic/') !== -1 && href.indexOf('?id=') === -1) {
                
                let id = href.replace(/^\/Comic\//, '').replace(/^Comic\//, '').replace(/^\//, '')
                
                let title = $(a).text().trim()
                if (title.includes('Issue')) title = title.split('Issue')[0].trim()
                if (!title) return

                const img = $('img', a)
                let image = img.attr('src') ?? ''
                // Supporto srcTemp per lazy loading
                if (!image || image.includes('loader') || image.startsWith('data:')) {
                    image = img.attr('srcTemp') ?? ''
                }
                if (image.startsWith('/')) image = BASE_URL + image

                if (id && !latestItems.some(x => x.mangaId === id)) {
                    latestItems.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: 'Updated'
                    }))
                }
            }
        })
        
        if (latestItems.length > 0) {
            latestSection.items = latestItems
            sectionCallback(latestSection)
        }

        // 2. Newest Comics
        const newSection = App.createHomeSection({ 
            id: 'newest', 
            title: 'New Series', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const newItems: PartialSourceManga[] = []

        $('#tab-newest > div').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            if (!href) return

            let id = href.replace(/^\/Comic\//, '').replace(/^Comic\//, '').replace(/^\//, '')
            const title = $(div).find('.title').text().trim() || link.text().trim()
            
            let image = $('img', div).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                newItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        
        if (newItems.length > 0) {
            newSection.items = newItems
            sectionCallback(newSection)
        }

        // 3. Most Popular
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Most Popular', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        const popularItems: PartialSourceManga[] = []

        $('#tab-mostview > div').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            if (!href) return

            let id = href.replace(/^\/Comic\//, '').replace(/^Comic\//, '').replace(/^\//, '')
            const title = $(div).find('.title').text().trim() || link.text().trim()
            
            let image = $('img', div).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        if (popularItems.length > 0) {
            popularSection.items = popularItems
            sectionCallback(popularSection)
        }
    }
}