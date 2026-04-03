import {
    Chapter,
    ChapterDetails,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const DEFAULT_IMAGE = 'https://paperback.moe/icons/logo-alt.svg'

export class MangaBallParser {
    parseCsrfToken(html: string): string {
        const match = html?.match(/name="csrf-token"\s+content="([^"]+)"/i)
        return match?.[1] ?? ''
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const detailRoot = $('.featured-comic-carousel').first()
        const title = this.extractTitle($)
        const altTitles = this.extractAltTitles($)
        const image = this.extractImage($)
        const statusText = detailRoot.find('.badge-status').first().text().trim()
            || $('.badge-status').first().text().trim()
        const status = this.parseStatus(statusText)

        const authorList = this.extractAuthors($, detailRoot)
        const author = authorList.join(', ')

        const tags = this.extractTags($, detailRoot)
        const hentai = tags.some((tag) => this.isAdultTag(tag.label))

        const desc = this.extractDescription($)

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title, ...altTitles],
                image,
                status,
                author: author || 'Unknown',
                artist: author || 'Unknown',
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags })],
                desc,
                hentai,
            }),
        })
    }

    parseSearchResults(data: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = data?.data ?? []

        for (const item of items) {
            const id = item?._id
            const title = item?.name?.trim()
            if (!id || !title) continue

            const image = item.cover || item.background || DEFAULT_IMAGE
            const subtitle = this.stripHtml(item.status ?? '')

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image,
                title,
                subtitle: subtitle || undefined,
            }))
        }

        return results
    }

    parseChapters(data: any): Chapter[] {
        const chaptersData = data?.ALL_CHAPTERS ?? []
        const chapterMap = new Map<string, { chapter: any, translation: any, time: Date, score: number }>()

        for (const chapter of chaptersData) {
            const translations = chapter?.translations ?? []
            for (const translation of translations) {
                if ((translation?.language ?? '').toLowerCase() !== 'en') continue

                const key = String(chapter?.number_float ?? chapter?.number ?? translation?.id ?? '')
                if (!key) continue

                const time = this.parseDate(translation?.date)
                const score = (translation?.views ?? 0) * 1000 + (translation?.likes ?? 0)

                const existing = chapterMap.get(key)
                if (!existing || score > existing.score || time > existing.time) {
                    chapterMap.set(key, { chapter, translation, time, score })
                }
            }
        }

        const chapters: Chapter[] = []
        for (const entry of chapterMap.values()) {
            const chapNumRaw = String(entry.chapter?.number_float ?? entry.chapter?.number ?? '')
            let chapNum = parseFloat(chapNumRaw.replace(',', '.'))
            if (Number.isNaN(chapNum)) {
                const match = chapNumRaw.match(/(\d+(?:\.\d+)?)/)
                chapNum = match ? parseFloat(match[1]) : 0
            }
            const volumeRaw = entry.translation?.volume
            const volume = volumeRaw ? parseFloat(volumeRaw) : undefined

            let name = (entry.translation?.name ?? '').trim()
            if (!name || name === String(chapNumRaw) || name === String(entry.chapter?.number ?? '')) {
                name = ''
            }

            chapters.push(App.createChapter({
                id: String(entry.translation?.id ?? ''),
                name,
                chapNum,
                volume: Number.isNaN(volume ?? NaN) ? undefined : volume,
                time: entry.time,
                langCode: 'en',
            }))
        }

        chapters.sort((a, b) => b.chapNum - a.chapNum)
        return chapters.map((chapter, index) => {
            chapter.sortingIndex = index
            return chapter
        })
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const match = html?.match(/chapterImages\s*=\s*JSON\.parse\(`([^`]+)`\)/)

        if (match?.[1]) {
            try {
                const parsed = JSON.parse(match[1])
                if (Array.isArray(parsed)) {
                    pages.push(...parsed.filter((url) => typeof url === 'string'))
                }
            } catch {}
        }

        if (pages.length === 0) {
            const matches = html?.match(/https?:\/\/[^"'\\s]+\\.(?:jpg|jpeg|png|webp)/gi) ?? []
            for (const url of matches) {
                if (!pages.includes(url)) pages.push(url)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages,
        })
    }

    private extractTitle($: any): string {
        const title = $('.fw-bold.mb-1.text-center').first().text().trim()
        if (title) return title

        const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? ''
        if (!ogTitle) return 'Unknown'

        return ogTitle
            .replace(/\s+-\s+Manga Ball$/i, '')
            .replace(/\s+Online Free\s+-\s+.*/i, '')
            .trim() || 'Unknown'
    }

    private extractAltTitles($: any): string[] {
        const raw = $('.alternate-name-container').first().text().replace(/\s+/g, ' ').trim()
        if (!raw) return []

        const parts = raw.split('/').map((part: string) => part.trim()).filter(Boolean)
        return Array.from(new Set(parts))
    }

    private extractImage($: any): string {
        let image = $('img.featured-cover').first().attr('src') ?? ''
        if (!image) {
            image = $('meta[property="og:image"]').attr('content') ?? ''
        }
        if (!image) return DEFAULT_IMAGE
        if (image.startsWith('/')) return `https://mangaball.net${image}`
        return image
    }

    private extractDescription($: any): string {
        const paragraphs: string[] = []
        $('.description-text p').each((_: any, p: any) => {
            const text = $(p).text().trim()
            if (text) paragraphs.push(text)
        })
        if (paragraphs.length > 0) return paragraphs.join('\n')

        const meta = $('meta[name="description"]').attr('content')?.trim()
        return meta ?? ''
    }

    private extractTags($: any, root: any): Tag[] {
        const tags: Tag[] = []
        const scope = root && root.length ? root : $.root()
        scope.find('[data-tag-id]').each((_: any, item: any) => {
            const id = $(item).attr('data-tag-id') ?? ''
            const label = $(item).text().trim()
            if (id && label) tags.push(App.createTag({ id, label }))
        })
        return tags
    }

    private extractAuthors($: any, root: any): string[] {
        const authors: string[] = []
        const scope = root && root.length ? root : $.root()
        scope.find('[data-person-id]').each((_: any, item: any) => {
            const name = $(item).text().trim()
            if (name) authors.push(name)
        })
        return Array.from(new Set(authors))
    }

    private parseStatus(raw: string): string {
        const value = raw.toLowerCase()
        if (value.includes('completed')) return 'Completed'
        if (value.includes('hiatus') || value.includes('paused')) return 'Hiatus'
        if (value.includes('cancelled') || value.includes('canceled') || value.includes('dropped')) return 'Dropped'
        return 'Ongoing'
    }

    private isAdultTag(label: string): boolean {
        const value = label.toLowerCase()
        return ['adult', 'smut', 'hentai', 'ecchi', 'mature', '18+'].some((tag) => value.includes(tag))
    }

    private stripHtml(text: string): string {
        return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    private parseDate(value: string | undefined): Date {
        if (!value) return new Date()
        const normalized = value.replace(' ', 'T')
        const date = new Date(normalized)
        return Number.isNaN(date.getTime()) ? new Date() : date
    }
}
