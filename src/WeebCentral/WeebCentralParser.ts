import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
    MangaInfo
} from '@paperback/types'

// Nota: Assicurati di avere 'entities' installato o gestito nel tuo bundle
import { decodeHTML } from 'entities'

export class Parser {

    decodeHTMLEntity(str: string): string {
        return decodeHTML(str)
    }

    isLastPage($: any): boolean {
        return $('span:contains("View More Results...")').toArray().length === 0
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim()
        const image = $('picture > img').attr('src') ?? ''
        const description = this.decodeHTMLEntity($('.whitespace-pre-wrap').text().trim())
        
        const authors: string[] = []
        for (const authorObj of $('strong:contains("Author")').siblings().toArray()) {
            const author = $('a', authorObj).text().trim()
            authors.push(author)
        }
        const author = authors.join(', ')

        const parsedStatus = $('strong:contains("Status")').next().text().trim()
        let status = 'Unknown'
        switch (parsedStatus) {
            case 'Ongoing': status = 'Ongoing'; break
            case 'Complete': status = 'Completed'; break
            case 'Canceled': status = 'Dropped'; break
            case 'Hiatus': status = 'Hiatus'; break
            default: status = 'Unknown'; break
        }

        const genres: Tag[] = []
        for (const genreObj of $('a', $('strong:contains("Tags")').siblings()).toArray()) {
            const genre = $(genreObj).text().trim()
            const id = encodeURI(genre)
            genres.push(App.createTag({ id, label: genre }))
        }

        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'genres', tags: genres })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [this.decodeHTMLEntity(title)],
                image,
                rating: 0,
                status: status as any,
                artist: '',
                author: author,
                tags: tagSections,
                desc: description,
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const floatRegex = /(\d+\.\d+|\d+)/g
        const chapters: Chapter[] = []
        const arrChapters = $('a.flex.items-center').toArray()
        
        const types: Record<string, number> = {}
        let currTypeId = 0
        let sortingIndex = 0

        for (const chapterObj of arrChapters) {
            const chapterId = $(chapterObj).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
            if (!chapterId) continue

            const time = new Date($('time.opacity-50', chapterObj).attr('datetime') ?? '')
            
            let chapName = $('span.grow.flex.gap-2 span', chapterObj).first().text().trim()
            let chapNum = 0
            let chapType = ''

            const matches = chapName.match(floatRegex)
            if (matches && matches[matches.length - 1]) {
                chapNum = parseFloat(matches[matches.length - 1] ?? '0')
                chapType = chapName.slice(0, -matches[matches.length - 1]!.length).trim()
            }

            sortingIndex--

            if (!(chapType in types)) {
                types[chapType] = currTypeId--
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: chapName,
                chapNum,
                time,
                sortingIndex,
                langCode: 'en',
            }))
        }

        if (chapters.length === 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}`)
        }

        const totalTypes = Object.keys(types).length

        return chapters.map((chapter) => {
            chapter.volume = 0
            const matches = chapter.name.match(floatRegex)
            if (matches && matches.length > 0) {
                let chapType = chapter.name.slice(0, -matches[matches.length - 1]!.length).trim()
                // Nota: in Paperback i volumi devono essere numeri, qui usiamo l'ID del tipo mappato
                chapter.volume = totalTypes + (types[chapType] ?? 0)
            }
            chapter.sortingIndex += chapters.length
            return App.createChapter(chapter)
        })
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        for (const img of $('img', 'section.cursor-pointer').toArray()) {
            let image = $(img).attr('src') ?? ''
            if (!image) image = $(img).attr('data-src') ?? ''
            if (!image) continue
            pages.push(image)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
        })
    }

    parseTags($: any): TagSection[] {
        const genres: Tag[] = []
        for (const genreObj of $('span', $('div.collapse-content').last()).toArray()) {
            const label = $(genreObj).text().trim()
            const id = label
            genres.push(App.createTag({ id, label }))
        }
        return [
            App.createTagSection({ id: '0', label: 'genres', tags: genres }),
        ]
    }

    async parseSearchResults($: any): Promise<PartialSourceManga[]> {
        const results: PartialSourceManga[] = []
        for (const item of $('article.flex.gap-4').toArray()) {
            const id = $('a', item).attr('href')?.split('/series/')[1]?.split('/')[0] ?? ''
            if (id == '' || typeof id != 'string') continue
            
            const title = $('a.link.link-hover', item).first().text().trim() ?? ''
            const image = $('img', item).attr('src') ?? $('img', item).attr('data-src') ?? ''
            
            results.push(App.createPartialSourceManga({
                image,
                title: this.decodeHTMLEntity(title),
                mangaId: id,
                subtitle: '',
            }))
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const recommendationSection = App.createHomeSection({
            id: 'recommendation',
            title: 'Recommended Mangas',
            type: HomeSectionType.singleRowNormal,
            containsMoreItems: false,
        })
        const hotSection = App.createHomeSection({
            id: 'hot',
            title: 'Hot Updates',
            type: HomeSectionType.singleRowLarge,
            containsMoreItems: true,
        })
        const recentSection = App.createHomeSection({
            id: 'recent',
            title: 'Latest Updates',
            type: HomeSectionType.singleRowNormal,
            containsMoreItems: true,
        })

        // Popolamento Hot Updates
        const hot: PartialSourceManga[] = []
        for (const hotObj of $('article.flex.gap-4', 'section.bg-base-200.max-w-7xl').toArray()) {
            const id = $('a', hotObj).first().attr('href')?.replace(/\/$/, '')?.split('/').slice(-2)[0] ?? ''
            const title = $('div.font-semibold', hotObj).first().text().trim() ?? ''
            const image = $('source', hotObj).first().attr('srcset') ?? ''
            const subtitle = $('span', hotObj).last().text().trim() ?? ''
            
            hot.push(App.createPartialSourceManga({
                image,
                title: this.decodeHTMLEntity(title),
                mangaId: id,
                subtitle: this.decodeHTMLEntity(subtitle),
            }))
        }
        hotSection.items = hot
        sectionCallback(hotSection)

        // Popolamento Recent Updates
        const recent: PartialSourceManga[] = []
        for (const recentObj of $('article', 'section.bg-base-200.rounded-sm').toArray()) {
            const id = $('a.aspect-square', recentObj).attr('href')?.replace(/\/$/, '')?.split('/').slice(-2)[0] ?? ''
            const title = $('div.font-semibold', recentObj).text().trim() ?? ''
            const image = $('a img', recentObj).attr('src') ?? $('a img', recentObj).attr('data-src') ?? ''
            const subtitle = $('span', recentObj).last().text().trim() ?? ''
            
            recent.push(App.createPartialSourceManga({
                image,
                title: this.decodeHTMLEntity(title),
                mangaId: id,
                subtitle: this.decodeHTMLEntity(subtitle),
            }))
        }
        recentSection.items = recent
        sectionCallback(recentSection)

        // Popolamento Recommendations
        const recommendation: PartialSourceManga[] = []
        for (const recommendationObj of $('.glide__slide:not(.glide__slide--clone)').toArray()) {
            const id = $('a', recommendationObj).attr('href')?.replace(/\/$/, '')?.split('/').slice(-2)[0] ?? ''
            const title = $('.text-white', recommendationObj).text().trim() ?? ''
            const image = $('source', recommendationObj).first().attr('srcset') ?? $('img', recommendationObj).attr('src') ?? ''
            
            recommendation.push(App.createPartialSourceManga({
                image,
                title: this.decodeHTMLEntity(title),
                mangaId: id,
                subtitle: '',
            }))
        }
        recommendationSection.items = recommendation
        sectionCallback(recommendationSection)
    }

    parseViewMore($: any, homepageSectionId: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        const collectedIds: string[] = []
        const selector = homepageSectionId === 'hot' ? 'article.flex' : 'article'

        for (const obj of $(selector).toArray()) {
            const image = $('source', obj).attr('srcset') ?? ''
            const title = $('img', obj).attr('alt') ?? ''
            const id = $('a', obj).first().attr('href')?.replace(/\/$/, '')?.split('/').slice(-2)[0] ?? ''
            const subtitle = $('div.opacity-70', obj).first().text().trim()

            if (!id || !title || collectedIds.includes(id)) continue

            manga.push(App.createPartialSourceManga({
                image: image,
                title: this.decodeHTMLEntity(title),
                mangaId: id,
                subtitle: this.decodeHTMLEntity(subtitle),
            }))
            collectedIds.push(id)
        }
        return manga
    }
}
