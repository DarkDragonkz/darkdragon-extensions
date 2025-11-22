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

    // HELPER: Pulisce i titoli duplicati (es "One PieceOne Piece" -> "One Piece")
    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        // Se la stringa è pari e la prima metà è uguale alla seconda, è un duplicato
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) {
                return half
            }
        }
        return title
    }

    // HELPER: Gestione Immagini sicura
    private getImage(element: any, baseUrl: string): string {
        let src = element.attr('src') || element.attr('data-src') || element.attr('data-original')
        if (!src || src.includes('loading') || src.startsWith('data:')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }
        if (src.startsWith('/')) {
            return baseUrl + src
        }
        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.name.bigger').text().trim() ?? ''
        if (!title) title = $('h1').first().text().trim()
        title = this.cleanTitle(title)

        const imgElement = $('.thumb.mb-3.text-center img')
        const image = this.getImage(imgElement, 'https://www.mangaworld.mx')

        const desc = $('#noidungm').text().trim() ?? ''
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
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const arrChapters = $('.chapter').toArray()
        
        for (const item of arrChapters) {
            const link = $('a', item).first()
            const href = link.attr('href')
            
            if (!href) continue

            let title = link.attr('title') ?? link.text().trim()
            title = title.replace(mangaId, '').trim() // Pulizia extra
            
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
        
        // FIX: Selettore più ampio e ciclo FOR per evitare problemi con .each
        const images = $('#page img, .read-content img, .reading-content img').toArray()

        for (const img of images) {
             const $img = $(img)
             let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original')
             
             if (src && !src.includes('loading')) {
                 src = src.trim()
                 if (src.startsWith('/')) src = 'https://www.mangaworld.mx' + src
                 pages.push(src)
             }
        }
        
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
            const href = link.attr('href')
            const id = href?.split('/').pop()
            const image = this.getImage($('img', item), baseUrl)
            
            let title = link.attr('title') || $('.name', item).text().trim() || 'Unknown'
            title = this.cleanTitle(title)
            
            if (id) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
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
            const href = link.attr('href')
            const id = href?.split('/').pop()
            const image = this.getImage($('img', item), baseUrl)
            
            let title = link.attr('title') || $('.name a', item).text().trim() || 'Unknown'
            title = this.cleanTitle(title)

            const chapter = $('.chapter-number', item).first().text().trim()

            if (id) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
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
            const href = link.attr('href')
            const id = href?.split('/').pop()
            const image = this.getImage($('img', item), baseUrl)
            
            let title = link.attr('title') || $('.name a', item).text().trim() || 'Unknown'
            title = this.cleanTitle(title)

            if (id) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        return results
    }

    parseViewMore($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.comics-grid .entry').toArray()

        for (const item of items) {
            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.split('/').pop()
            const image = this.getImage($('img', item), 'https://www.mangaworld.mx')
            
            let title = link.attr('title') || $('.name a', item).text().trim() || 'Unknown'
            title = this.cleanTitle(title)

            if (id) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
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