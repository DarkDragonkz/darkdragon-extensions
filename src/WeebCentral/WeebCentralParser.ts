import {
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
} from '@paperback/types'

export class WeebCentralParser {

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        // 1. Hot Updates
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal,
        })
        
        // 2. Latest Updates
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // Parsing Hot Updates (cerca la sezione con h2 "Hot Updates")
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

        // Parsing Latest Updates (cerca la sezione con h2 "Latest Updates")
        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()

        $('article', latestContainer).each((_: any, manga: any) => {
            // Latest updates structure is slightly different (flex row)
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