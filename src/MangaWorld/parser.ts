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

export class Parser {
    parseMangaDetails($: any, mangaId: string): SourceManga {
        // FIX: Usa attr('title') se possibile, altrimenti text().trim()
        let title = $('.name.bigger').text().trim() ?? ''
        if (!title) title = $('h1').first().text().trim()

        const imgElement = $('.thumb.mb-3.text-center img')
        let image = imgElement.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = 'https://www.mangaworld.mx' + image
        }
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = $('#noidungm').text().trim() ?? ''
        let hentai = false
        let author = ''
        let artist = ''
        
        $('.meta-data .row').each((_: any, row: any) => {
            const label = $('label', row).text().toLowerCase()
            const value = $('span, a', row).text().trim()
            if (label.includes('autore')) author = value
            if (label.includes('artista')) artist = value
        })

        const arrayTags: Tag[] = []
        $('.meta-data .row').each((_: any, row: any) => {
             const label = $('label', row).text().toLowerCase()
             if(label.includes('generi')) {
                 $('a', row).each((__: any, tag: any) => {
                     const id = $(tag).attr('href')?.split('/').pop() ?? ''
                     const tagName = $(tag).text().trim()
                     if(id && tagName) arrayTags.push({id, label: tagName})
                 })
             }
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
        
        let status = 'Ongoing'
        const statusText = $('.meta-data').text().toLowerCase()
        if (statusText.includes('finito') || statusText.includes('completato')) status = 'Completed'
        if (statusText.includes('droppato')) status = 'Unknown'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                author,
                artist,
                tags: tagSections,
                desc,
                hentai
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const arrChapters = $('.chapter').toArray()
        
        for (const item of arrChapters) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const chapterId = href?.split('/').pop()
            
            if (!chapterId) continue

            const title = link.attr('title') ?? link.text().trim()
            const dateText = $('.chapter-release-date i', item).text().trim()
            
            const chapNumMatch = title.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch[1]) chapNum = parseFloat(chapNumMatch[1])

            chapters.push(App.createChapter({
                id: href, 
                name: title,
                chapNum: chapNum,
                time: this.convertTime(dateText),
                langCode: 'it'
            }))
        }
        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        $('#page img').each((_: any, img: any) => {
             let src = $(img).attr('src') || $(img).attr('data-src')
             if (src && !src.includes('loading')) {
                 if (src.startsWith('/')) src = 'https://www.mangaworld.mx' + src
                 pages.push(src.trim())
             }
        })
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Manga del Mese', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        
        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // HOT
        const hotArr = $('.owl-carousel .entry').toArray()
        for (const item of hotArr) {
            const link = $('a', item).first()
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            let title = link.attr('title')
            if (!title) title = $('.name', item).text().trim()
            
            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // LATEST
        const latestArr = $('.comics-grid .entry').toArray()
        for (const item of latestArr) {
            const link = $('a.thumb', item)
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            let title = link.attr('title') 
            if (!title) title = $('.name a', item).text().trim()

            const chapter = $('.chapter-number', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: chapter
                }))
            }
        }
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.comics-grid .entry').toArray()

        for (const item of items) {
            const link = $('a.thumb', item)
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            let title = link.attr('title')
            if (!title) title = $('.name a', item).text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        return results
    }

    // FIX: Funzione aggiunta per risolvere il crash
    parseViewMore($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.comics-grid .entry').toArray()

        for (const item of items) {
            const link = $('a.thumb', item)
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            let title = link.attr('title')
            if (!title) title = $('.name a', item).text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? 'https://www.mangaworld.mx' + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        return results
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('or')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('anno') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}