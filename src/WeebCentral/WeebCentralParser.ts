import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Title is in h1, usually hidden on desktop but present
        // In provided HTML: <h1 class="md:hidden text-2xl font-bold text-center">Kingdom</h1>
        // Also <h1 class="hidden md:block text-2xl font-bold">Kingdom</h1>
        const title = $('h1').first().text().trim()

        // Image
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'

        // Description
        const desc = $('strong:contains("Description")').next('p').text().trim()

        // Author
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim()

        // Status
        const statusStr = $('strong:contains("Status")').next('a').text().trim()
        let status = 'Unknown'
        if (statusStr.toLowerCase().includes('ongoing')) status = 'Ongoing'
        else if (statusStr.toLowerCase().includes('complete')) status = 'Completed'

        // Tags
        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const a = $('a', span)
            const id = a.text().trim()
            const label = a.text().trim()
            arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // The HTML contains a list of links to chapters
        // <a href="https://weebcentral.com/chapters/01KAGRKGDS2NTSVE5FRKXJ7KTP" class="hover:bg-base-300 flex-1 flex items-center p-2">
        // <span class="grow flex items-center gap-2"><span class="">Chapter 857</span>...</span>
        // <time ...>...</time>

        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const href = $(element).attr('href')
            const id = href?.split('/chapters/')[1]
            
            const chapterTextSpan = $(element).find('span.grow span').first()
            const name = chapterTextSpan.text().trim() // "Chapter 857"
            
            // Extract number
            const numMatch = name.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            const timeStr = $(element).find('time').attr('datetime')
            const time = timeStr ? new Date(timeStr) : new Date()

            if (id) {
                chapters.push(App.createChapter({
                    id: id,
                    name: name,
                    chapNum: chapNum,
                    langCode: 'en',
                    time: time
                }))
            }
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // The response from /chapters/{id}/images?reading_style=long_strip is a fragment with images
        $('img').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src) pages.push(src)
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Search results structure is similar to "Latest Updates"
        // <article ...><a href="/series/ID/Slug">...<div ...>Title</div></a></article>
        
        $('article').each((_: any, article: any) => {
            const link = $('a', article).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            // Title can be in different places depending on view mode, but usually in a div with text
            let title = $('.font-semibold', article).text().trim()
            if (!title) title = $('.text-white', article).text().trim()
            
            const image = $('img', article).attr('src') ?? ''

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
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal,
        })
        
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // Hot Updates
        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        
        $('article', hotContainer).each((_: any, manga: any) => {
            const link = $('a', manga).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            const title = $('.text-white.text-center.text-lg', manga).first().text().trim()
            const image = $('img', manga).attr('src')
            
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image ?? '',
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        // Latest Updates
        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()

        $('article', latestContainer).each((_: any, manga: any) => {
            const linkElement = $('a[href*="/series/"]', manga)
            const link = linkElement.attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            const title = $('.font-semibold.text-lg', manga).text().trim()
            const image = $('img', manga).attr('src')
            const chapter = $('span', manga).last().text().trim()

            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image ?? '',
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }
}