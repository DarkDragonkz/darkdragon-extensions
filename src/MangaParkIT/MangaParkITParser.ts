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

export class MangaParkITParser {

    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hour') || timeAgo.includes('ore')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('day') || timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h3 a').first().text().trim() || $('h1').text().trim() || 'Unknown'
        
        let image = $('img').attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image

        const author = $('.opacity-80 a').first().text().trim() || 'Unknown'
        const desc = $('.limit-height-body').text().trim() || 'No description available'
        const status = 'Ongoing' 

        const arrayTags: Tag[] = []
        $('.opacity-70 span, .genres a').each((_: any, el: any) => {
            const label = $(el).text().trim().replace(/,$/, '')
            if (label) {
                arrayTags.push(App.createTag({ id: label, label: label }))
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
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapter/"]').each((_: any, obj: any) => {
            const link = $(obj)
            const href = link.attr('href')
            const id = href?.split('/').pop() || href

            if (!id) return

            const title = link.text().trim()
            const timeStr = link.find('time').text().trim()
            
            const chapNumMatch = title.match(/(\d+(\.\d+)?)/)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[0]) : 0

            chapters.push(App.createChapter({
                id: id,
                name: title,
                chapNum: chapNum,
                time: this.convertTime(timeStr),
                langCode: 'it'
            }))
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        let foundInScript = false

        // 1. Metodo Script JSON (Nuovo MangaPark)
        // Cerca qualsiasi script che contenga URL di immagini in un array
        $('script').each((_: any, script: any) => {
            if (foundInScript) return
            const content = $(script).html()
            if (!content) return

            // Cerca array di stringhe che iniziano con http e finiscono con estensioni immagine
            const matches = content.match(/"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi)
            if (matches && matches.length > 0) {
                for (const m of matches) {
                    // Rimuovi le virgolette
                    pages.push(m.replace(/"/g, ''))
                }
                foundInScript = true
            }
        })

        // 2. Fallback DOM
        if (pages.length === 0) {
             $('img[loading="lazy"], img.w-full').each((_: any, img: any) => {
                 let src = $(img).attr('src')
                 if (src && src.startsWith('http')) pages.push(src)
             })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('.flex.border-b.border-b-base-200').each((_: any, item: any) => {
            const titleLink = $('h3.font-bold a', item)
            const title = titleLink.text().trim()
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $('img', item).attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image

            const subtitle = $('div.flex.flex-nowrap.justify-between a', item).first().text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari in Italia', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Aggiornamenti Recenti (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const mangas = this.parseSearchResults($)
        
        popularSection.items = mangas
        sectionCallback(popularSection)
        
        latestSection.items = mangas
        sectionCallback(latestSection)
    }
}